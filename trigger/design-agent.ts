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
  type CanvasAction,
} from "@/types/canvas";

const AI_USER_ID = "polaris";

const SHAPE_SIZES = {
  rectangle: { width: 160, height: 80 },
  circle:    { width: 100, height: 100 },
  diamond:   { width: 120, height: 80 },
  pill:      { width: 160, height: 60 },
  cylinder:  { width: 120, height: 100 },
  hexagon:   { width: 120, height: 100 },
} as const;

const SYSTEM_PROMPT = `You are Polaris, a system architecture diagram assistant.
Given a user description, output a canvas diagram as nodes and edges.

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

LAYOUT:
- Start at x=100, y=100. Flow left-to-right.
- Horizontal spacing: 220px between node centers.
- Vertical spacing: 180px between rows.
- Group related nodes on the same row.

DEFAULT SIZES (use unless the label is very long):
- rectangle 160×80, circle 100×100, diamond 120×80
- pill 160×60, cylinder 120×100, hexagon 120×100

RULES:
- Generate 4–12 nodes. Keep it readable.
- Node IDs: kebab-case, descriptive (e.g. "api-gateway", "user-db").
- Edge IDs: "e-{source}-{target}".
- summary: one sentence describing what was designed.`;

const shapeEnum = z.enum(["rectangle", "circle", "diamond", "pill", "cylinder", "hexagon"]);
const paletteEnum = z.enum(["default", "blue", "emerald", "amber", "rose", "violet", "cyan"]);

const geminiSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      shape: shapeEnum,
      paletteId: paletteEnum,
      x: z.number(),
      y: z.number(),
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
  summary: z.string(),
});

async function trySetPresence(roomId: string, data: Record<string, Json | undefined>) {
  try {
    await liveblocks.setPresence(roomId, { userId: AI_USER_ID, data });
  } catch {
    // setPresence only affects connected users; ignore if AI has no connection
  }
}

async function safeBroadcast(roomId: string, event: Json) {
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
  }),
  run: async ({ prompt, roomId }) => {
    logger.log("design-agent started", { roomId, promptLength: prompt.length });

    await trySetPresence(roomId, { cursor: { x: 500, y: 300 }, thinking: true });
    await safeBroadcast(roomId, {
      type: "ai:status",
      message: "Analyzing your design request…",
      thinking: true,
    });

    try {
      const model = createGroq({
        apiKey: process.env.GROQ_API_KEY,
      })("openai/gpt-oss-120b");

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Generating your architecture…",
        thinking: true,
      });

      const { object } = await generateObject({
        model,
        schema: geminiSchema,
        system: SYSTEM_PROMPT,
        prompt,
      });

      logger.log("design-agent generated", {
        nodeCount: object.nodes.length,
        edgeCount: object.edges.length,
      });

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Placing nodes on the canvas…",
        thinking: true,
      });

      // Build canvas nodes for both broadcast and direct persistence
      const canvasNodes: object[] = [];
      for (const node of object.nodes) {
        const palette = NODE_COLOR_PALETTE.find((p) => p.id === node.paletteId);
        const defaultSize = SHAPE_SIZES[node.shape as keyof typeof SHAPE_SIZES];
        const color = palette?.background ?? DEFAULT_NODE_BACKGROUND;
        const textColor = palette?.text ?? DEFAULT_NODE_TEXT;
        const width = node.width ?? defaultSize.width;
        const height = node.height ?? defaultSize.height;

        const action: CanvasAction = {
          type: "addNode",
          id: node.id,
          label: node.label,
          shape: node.shape,
          color,
          textColor,
          x: node.x,
          y: node.y,
          width,
          height,
        };
        await safeBroadcast(roomId, { type: "ai:action", action });

        canvasNodes.push({
          id: node.id,
          type: "canvasNode",
          position: { x: node.x, y: node.y },
          data: { label: node.label, shape: node.shape, color, textColor },
          width,
          height,
        });
      }

      await new Promise((r) => setTimeout(r, 200));

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Connecting the nodes…",
        thinking: true,
      });

      // Build canvas edges for both broadcast and direct persistence
      const canvasEdges: object[] = [];
      for (const edge of object.edges) {
        const action: CanvasAction = {
          type: "addEdge",
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label ?? undefined,
        };
        await safeBroadcast(roomId, { type: "ai:action", action });

        canvasEdges.push({
          id: edge.id,
          type: "canvasEdge",
          source: edge.source,
          target: edge.target,
          sourceHandle: "right",
          targetHandle: "left",
          data: {},
        });
      }

      // Persist canvas directly to blob — works whether or not browser is open
      const blob = await put(
        `projects/${roomId}/canvas.json`,
        JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }),
        { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" }
      );
      await prisma.project.update({ where: { id: roomId }, data: { canvasBlobUrl: blob.url } });

      await safeBroadcast(roomId, {
        type: "ai:status",
        message: object.summary,
        thinking: false,
      });

      return {
        roomId,
        nodeCount: object.nodes.length,
        edgeCount: object.edges.length,
      };
    } catch (err) {
      logger.error("design-agent failed", { error: String(err) });
      await safeBroadcast(roomId, {
        type: "ai:status",
        message: "Something went wrong. Please try again.",
        thinking: false,
      });
      throw err;
    } finally {
      await trySetPresence(roomId, { cursor: null, thinking: false });
    }
  },
});
