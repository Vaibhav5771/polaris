import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { designAgentTask } from "@/trigger/design-agent";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const { prompt, roomId, projectId, chatHistory, nodes, edges } = body as {
    prompt?: unknown;
    roomId?: unknown;
    projectId?: unknown;
    chatHistory?: unknown;
    nodes?: unknown;
    edges?: unknown;
  };

  if (typeof prompt !== "string" || !prompt.trim()) {
    return jsonError("prompt is required", 400);
  }
  if (typeof roomId !== "string" || !roomId.trim()) {
    return jsonError("roomId is required", 400);
  }
  if (typeof projectId !== "string" || !projectId.trim()) {
    return jsonError("projectId is required", 400);
  }

  const handle = await designAgentTask.trigger({
    prompt: prompt.trim(),
    roomId: roomId.trim(),
    chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
  });

  await prisma.taskRun.create({
    data: {
      runId: handle.id,
      projectId: projectId.trim(),
      userId,
    },
  });

  return Response.json({ runId: handle.id }, { status: 201 });
}
