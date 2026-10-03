import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { put } from "@vercel/blob";

import { prisma } from "@/lib/prisma";

const canvasNodeSchema = z.object({
  id: z.string(),
  data: z
    .object({
      label: z.string().optional(),
      shape: z.string().optional(),
      color: z.string().optional(),
    })
    .passthrough()
    .optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  type: z.string().optional(),
}).passthrough();

const canvasEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  data: z
    .object({ label: z.string().optional() })
    .passthrough()
    .optional(),
  type: z.string().optional(),
}).passthrough();

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const SYSTEM_PROMPT = `You are Polaris, a technical documentation assistant.
Given a system architecture canvas (nodes and edges) and a conversation history, produce a concise Markdown technical specification.

Structure the spec as:
# <Project Title> — Technical Specification

## Overview
One paragraph describing the system purpose and key characteristics.

## Components
For each node on the canvas: its role, responsibilities, and any notable properties.

## Data Flow
Describe the connections between components and how data moves through the system.

## Technical Notes
Any implementation details, constraints, or recommendations inferred from the architecture.

Keep the tone professional and precise. Use bullet points inside sections where appropriate.`;

export const generateSpecTask = schemaTask({
  id: "generate-spec",
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  schema: z.object({
    projectId: z.string().min(1),
    projectName: z.string().default("project"),
    roomId: z.string().min(1),
    chatHistory: z.array(chatMessageSchema).default([]),
    nodes: z.array(canvasNodeSchema).default([]),
    edges: z.array(canvasEdgeSchema).default([]),
  }),
  run: async ({ projectId, projectName, chatHistory, nodes, edges }) => {
    logger.log("generate-spec started", {
      projectId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      chatHistoryLength: chatHistory.length,
    });

    metadata.set("status", "starting");

    const nodeDescriptions = nodes.length
      ? nodes
          .map((n) => {
            const label = n.data?.label ?? n.id;
            const shape = n.data?.shape ?? "rectangle";
            return `- ${label} (id: ${n.id}, shape: ${shape})`;
          })
          .join("\n")
      : "No nodes on the canvas yet.";

    const edgeDescriptions = edges.length
      ? edges
          .map((e) => {
            const label = e.data?.label ? ` [${e.data.label}]` : "";
            return `- ${e.source} → ${e.target}${label}`;
          })
          .join("\n")
      : "No connections yet.";

    const canvasContext = [
      "## Canvas Nodes",
      nodeDescriptions,
      "",
      "## Canvas Connections",
      edgeDescriptions,
    ].join("\n");

    const conversationContext =
      chatHistory.length > 0
        ? chatHistory
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n")
        : "No prior conversation.";

    const userPrompt = [
      "Generate a technical specification for this system architecture.",
      "",
      "### Conversation History",
      conversationContext,
      "",
      "### Canvas State",
      canvasContext,
    ].join("\n");

    metadata.set("status", "generating");

    try {
      const groq = createGroq({
        apiKey: process.env.GROQ_API_KEY,
      });

      logger.log("generate-spec:groq-start");
      const { text } = await generateText({
        model: groq("llama-3.3-70b-versatile"),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
      });

      logger.log("generate-spec:groq-done", { specLength: text.length });
      metadata.set("status", "uploading");

      logger.log("generate-spec:blob-start");
      const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "project";
      const blob = await put(
        `projects/${projectId}/specs/${Date.now()}/${slug}-spec.md`,
        text,
        {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "text/markdown; charset=utf-8",
        },
      );
      logger.log("generate-spec:blob-done", { url: blob.url });

      logger.log("generate-spec:db-start");
      const specRecord = await prisma.projectSpec.create({
        data: { projectId, filePath: blob.url },
      });

      logger.log("generate-spec:persisted", { specId: specRecord.id, blobUrl: blob.url });
      metadata.set("status", "complete");

      return { spec: text, specId: specRecord.id };
    } catch (err) {
      logger.error("generate-spec failed", {
        message: (err as Error).message,
        stack: (err as Error).stack,
      });
      throw err;
    }
  },
});
