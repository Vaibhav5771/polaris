import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { createGroq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { put } from "@vercel/blob";

import type { Json } from "@liveblocks/core";
import { liveblocks } from "@/lib/liveblocks";
import { prisma } from "@/lib/prisma";
import {
  NODE_COLOR_PALETTE,
  DEFAULT_NODE_BACKGROUND,
  DEFAULT_NODE_TEXT,
  SHAPE_SIZES,
  type CanvasAction,
  type CanvasShape,
} from "@/types/canvas";
import { layoutCanvas, type LayoutEdge, type LayoutNode } from "@/lib/canvas-layout";

const AI_USER_ID = "polaris";

// Step 1 of the run: pure routing. This call deliberately has NO diagram schema
// and NO drawing rules in front of it — when the model is asked to fill in a
// nodes/edges array it will reach for one even for "hey", which is exactly the
// bug this split fixes.
const ROUTER_SYSTEM_PROMPT = `You are Polaris, an AI companion inside a collaborative system-architecture canvas. You can talk with the user, and separately you can draw diagrams for them.

Right now you are NOT drawing anything. Your only job is to decide what this message wants, and to answer it if it is just conversation.

Set "intent":
- "design" — ONLY when the user is actually asking you to create, extend, or change a diagram. For example: "build a CI/CD pipeline", "design an e-commerce backend", "add a Redis cache in front of the DB", "make this microservices".
- "chat" — EVERYTHING else. Greetings ("hey", "hi", "yo"), questions ("what does an API gateway do?", "why postgres?"), opinions, feedback, thanks, small talk, and vague prompts you cannot act on ("do something more", "make it better").

If you are even slightly unsure, choose "chat". A greeting is always "chat". A question is always "chat". Only an explicit request for a diagram is "design".

Set "reply":
- For "chat" this IS your entire answer, so make it genuinely useful. Warm, direct, a couple of sentences at most, like a sharp teammate. Answer the actual question. If the request is too vague to draw, say what you'd need to know instead of guessing.
- For "design" just write one short line saying you're on it; it gets replaced by the real summary once the diagram is drawn.

Set "suggestions": 2 to 4 very short follow-up prompts (6 words or fewer each) the user could sensibly send next, phrased as if they typed them. Make them specific to this conversation and to what is already on the canvas. Examples: "Add a Redis cache", "Explain the order queue", "Generate a spec".`;

const DIAGRAM_SYSTEM_PROMPT = `You are Polaris, a system architecture diagram assistant. The user has asked for a diagram. Output it as nodes and edges.

Use the current canvas (if any is listed in the prompt) as context — never reuse an existing node ID, and if the user is extending an existing design, output ONLY the new nodes and edges to add (you cannot move, restyle, or delete existing nodes, only add to them).

"summary": one or two plain-language sentences describing what you just built or added. Warm and direct, not a status log.

"suggestions": 2 to 4 very short follow-up prompts (6 words or fewer each) the user could sensibly send next, phrased as if they typed them. Specific to what you just drew. Examples: "Add a Redis cache", "Explain the order queue", "Generate a spec".

SHAPES (pick by role):
- rectangle: services, APIs, controllers, backends
- circle: users, actors, external clients
- diamond: load balancers, routers, gateways, decision points
- pill: queues, event streams, pub/sub, caches
- cylinder: databases, file storage, blob stores
- hexagon: microservices, third-party systems, external APIs

PALETTE IDs (pick by type to visually group):
- "default": dark gray — general nodes
- "blue": services, APIs
- "emerald": databases, storage
- "amber": queues, caches, async systems
- "rose": critical paths, warnings
- "violet": important decisions, gateways
- "cyan": external systems, third-party

LAYOUT: do not think about it. You do not choose positions — a layout engine arranges the diagram left-to-right after you, and it does that far better than coordinates in prose ever did. Just get the nodes and the connections between them right.

SIZES: leave width and height null unless a label is unusually long and genuinely needs a wider box.

RULES:
- Generate 4–20 nodes for a fresh design (fewer for a small addition). Keep it readable.
- Node IDs: kebab-case, descriptive (e.g. "api-gateway", "user-db").
- Edge IDs: "e-{source}-{target}".`;

const shapeEnum = z.enum(["rectangle", "circle", "diamond", "pill", "cylinder", "hexagon"]);
const paletteEnum = z.enum(["default", "blue", "emerald", "amber", "rose", "violet", "cyan"]);

const routeSchema = z.object({
  intent: z.enum(["chat", "design"]),
  reply: z.string(),
  suggestions: z.array(z.string()),
});

const diagramSchema = z.object({
  summary: z.string(),
  suggestions: z.array(z.string()),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: shapeEnum,
      paletteId: paletteEnum,
      // No x/y: placement belongs to layoutCanvas, not the model.
      width: z.number().nullable(),
      height: z.number().nullable(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().nullable(),
    })
  ),
});

// Keeps the chips short and the UI predictable.
function cleanSuggestions(raw: string[]): string[] {
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60)
    .slice(0, 4);
}

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

// Passthrough keeps every field the client sent, so the blob write can put an
// existing node back exactly as it came in apart from its new position.
// position/width/height are declared because the layout reads them.
const canvasNodeSchema = z
  .object({
    id: z.string(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    data: z
      .object({ label: z.string().optional(), shape: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const canvasEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  })
  .passthrough();

async function trySetPresence(roomId: string, data: Record<string, Json | undefined>) {
  try {
    await liveblocks.setPresence(roomId, { userId: AI_USER_ID, data });
  } catch {
    // setPresence only affects connected users; ignore if AI has no connection
  }
}

async function safeBroadcast(roomId: string, event: Liveblocks["RoomEvent"]) {
  try {
    await liveblocks.broadcastEvent(roomId, event);
  } catch {
    // No active connections — room may not exist yet; silently skip
  }
}

export const designAgentTask = schemaTask({
  id: "design-agent",
  maxDuration: 300,
  schema: z.object({
    prompt: z.string().min(1),
    roomId: z.string().min(1),
    chatHistory: z.array(chatMessageSchema).default([]),
    nodes: z.array(canvasNodeSchema).default([]),
    edges: z.array(canvasEdgeSchema).default([]),
  }),
  run: async ({ prompt, roomId, chatHistory, nodes, edges: existingEdges }, { ctx }) => {
    logger.log("design-agent started", { roomId, promptLength: prompt.length });

    // One stable id for this run's final reply. Every client in the room
    // receives the same ai:status broadcast and each one writes it into the
    // shared chat feed, so without a shared id two tabs produce two identical
    // messages. Keyed on the run, so the id is the same for every receiver
    // and different for every run.
    const replyId = `ai-${ctx.run.id}`;

    await trySetPresence(roomId, { cursor: { x: 500, y: 300 }, thinking: true });
    await safeBroadcast(roomId, {
      type: "ai:status",
      message: "Thinking…",
      thinking: true,
    });

    try {
      const model = createGroq({
        apiKey: process.env.GROQ_API_KEY,
      })("openai/gpt-oss-120b");

      const contextLines: string[] = [];
      if (nodes.length > 0) {
        contextLines.push(
          "Current canvas already has these nodes:",
          ...nodes.map((n) => `- ${n.id} (${n.data?.shape ?? "rectangle"}): "${n.data?.label ?? n.id}"`),
        );
      }
      if (chatHistory.length > 0) {
        contextLines.push(
          "Recent conversation:",
          ...chatHistory.slice(-8).map((m) => `${m.role === "user" ? "User" : "Polaris"}: ${m.content}`),
        );
      }
      const fullPrompt = contextLines.length > 0
        ? `${contextLines.join("\n")}\n\nLatest message: ${prompt}`
        : prompt;

      const { object: route } = await generateObject({
        model,
        schema: routeSchema,
        system: ROUTER_SYSTEM_PROMPT,
        prompt: fullPrompt,
      });

      logger.log("design-agent routed", { intent: route.intent });

      if (route.intent === "chat") {
        const suggestions = cleanSuggestions(route.suggestions);
        await safeBroadcast(roomId, {
          type: "ai:status",
          message: route.reply,
          thinking: false,
          suggestions,
          messageId: replyId,
        });
        return { roomId, intent: "chat" as const, reply: route.reply, suggestions };
      }

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Designing your architecture…",
        thinking: true,
        // From here on the run is committed to changing the canvas, so the
        // on-canvas overlay is honest. Everything before this point is
        // routing, which may still turn out to be a plain chat reply.
        drawing: true,
      });

      const { object } = await generateObject({
        model,
        schema: diagramSchema,
        system: DIAGRAM_SYSTEM_PROMPT,
        prompt: fullPrompt,
      });

      const suggestions = cleanSuggestions(object.suggestions);

      logger.log("design-agent generated", {
        nodeCount: object.nodes.length,
        edgeCount: object.edges.length,
      });

      // The router said "design" but nothing came back to draw — answer in
      // words rather than leaving the user with a silent, empty canvas.
      if (object.nodes.length === 0) {
        await safeBroadcast(roomId, {
          type: "ai:status",
          message: object.summary || route.reply,
          thinking: false,
          suggestions,
          messageId: replyId,
        });
        return { roomId, intent: "chat" as const, reply: object.summary, suggestions };
      }

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Placing nodes on the canvas…",
        thinking: true,
        drawing: true,
      });

      // Resolve each new node's colours and box before any layout runs — the
      // engine is told how big every box is, so sizes have to be settled first.
      const newNodes = object.nodes.map((node) => {
        const palette = NODE_COLOR_PALETTE.find((p) => p.id === node.paletteId);
        const defaultSize = SHAPE_SIZES[node.shape as CanvasShape];
        return {
          id: node.id,
          label: node.label,
          shape: node.shape,
          color: palette?.background ?? DEFAULT_NODE_BACKGROUND,
          textColor: palette?.text ?? DEFAULT_NODE_TEXT,
          width: node.width ?? defaultSize.width,
          height: node.height ?? defaultSize.height,
        };
      });

      // Lay out what is already on the canvas together with what was just
      // generated, as one graph. Two tidy islands would be the alternative,
      // and that is the problem this feature exists to remove.
      const layoutNodes: LayoutNode[] = [
        ...nodes.map((n) => ({
          id: n.id,
          position: n.position ?? { x: 0, y: 0 },
          width: n.width,
          height: n.height,
          data: n.data,
        })),
        ...newNodes.map((n) => ({
          // New nodes have no position yet; the engine gives them one, so the
          // placeholder below is never read.
          id: n.id,
          position: { x: 0, y: 0 },
          width: n.width,
          height: n.height,
          data: { shape: n.shape },
        })),
      ];
      const layoutEdges: LayoutEdge[] = [
        ...existingEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        ...object.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      ];

      const layout = layoutCanvas(layoutNodes, layoutEdges);
      const positionById = new Map(layout.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
      const sidesById = new Map(layout.edges.map((e) => [e.id, e]));

      // Move what is already there out of the way first, so the canvas makes
      // room before new nodes start landing in it. An older client has no
      // matching case for this action and simply ignores it.
      const existingNodeIds = new Set(nodes.map((n) => n.id));
      const existingEdgeIds = new Set(existingEdges.map((e) => e.id));
      const movedExisting = layout.nodes.filter((n) => existingNodeIds.has(n.id));
      const residedExisting = layout.edges.filter((e) => existingEdgeIds.has(e.id));
      if (movedExisting.length > 0 || residedExisting.length > 0) {
        await safeBroadcast(roomId, {
          type: "ai:action",
          action: { type: "applyLayout", nodes: movedExisting, edges: residedExisting },
        });
      }

      // Stream the new nodes in one at a time, each already at its final
      // position, so the diagram still builds up visibly for anyone watching.
      const canvasNodes: object[] = [];
      for (const node of newNodes) {
        const position = positionById.get(node.id) ?? { x: 0, y: 0 };

        const action: CanvasAction = {
          type: "addNode",
          id: node.id,
          label: node.label,
          shape: node.shape,
          color: node.color,
          textColor: node.textColor,
          x: position.x,
          y: position.y,
          width: node.width,
          height: node.height,
        };
        await safeBroadcast(roomId, { type: "ai:action", action });

        canvasNodes.push({
          id: node.id,
          type: "canvasNode",
          position,
          data: { label: node.label, shape: node.shape, color: node.color, textColor: node.textColor },
          width: node.width,
          height: node.height,
        });
      }

      await new Promise((r) => setTimeout(r, 200));

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Connecting the nodes…",
        thinking: true,
        drawing: true,
      });

      // Build canvas edges for both broadcast and direct persistence
      const canvasEdges: object[] = [];
      for (const edge of object.edges) {
        // The layout drops an edge whose endpoints do not both exist, which a
        // model occasionally produces. Falling back keeps such an edge valid
        // rather than giving it an undefined handle React Flow cannot resolve.
        const sides = sidesById.get(edge.id);
        const sourceHandle = sides?.sourceHandle ?? "right";
        const targetHandle = sides?.targetHandle ?? "left";

        const action: CanvasAction = {
          type: "addEdge",
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label ?? undefined,
          sourceHandle,
          targetHandle,
        };
        await safeBroadcast(roomId, { type: "ai:action", action });

        canvasEdges.push({
          id: edge.id,
          type: "canvasEdge",
          source: edge.source,
          target: edge.target,
          sourceHandle,
          targetHandle,
          data: edge.label ? { label: edge.label } : {},
        });
      }

      // Persist the full canvas (existing + newly added) directly to blob —
      // works whether or not a browser is open. Existing nodes and edges are
      // written back carrying the layout's positions and sides, not the stale
      // ones they came in with: a browser that was never open has to find the
      // tidy canvas here, not a tidy overlay on old coordinates.
      const blob = await put(
        `projects/${roomId}/canvas.json`,
        JSON.stringify({
          nodes: [
            ...nodes.map((n) => ({ ...n, position: positionById.get(n.id) ?? n.position })),
            ...canvasNodes,
          ],
          edges: [
            ...existingEdges.map((e) => {
              const sides = sidesById.get(e.id);
              return sides
                ? { ...e, sourceHandle: sides.sourceHandle, targetHandle: sides.targetHandle }
                : e;
            }),
            ...canvasEdges,
          ],
        }),
        { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }
      );
      await prisma.project.update({ where: { id: roomId }, data: { canvasBlobUrl: blob.url } });

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: object.summary,
        thinking: false,
        suggestions,
        messageId: replyId,
      });

      return {
        roomId,
        intent: "design" as const,
        nodeCount: object.nodes.length,
        edgeCount: object.edges.length,
        reply: object.summary,
        suggestions,
      };
    } catch (err) {
      logger.error("design-agent failed", { error: String(err) });
      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Something went wrong. Please try again.",
        thinking: false,
        messageId: replyId,
      });
      throw err;
    } finally {
      await trySetPresence(roomId, { cursor: null, thinking: false });
    }
  },
});
