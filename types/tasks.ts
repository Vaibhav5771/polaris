import { z } from "zod"

export const aiStatusPayloadSchema = z.object({
  thinking: z.boolean(),
  // True only once the router has committed to drawing, so the canvas overlay
  // can stay away while Polaris is merely routing or answering in words.
  // Absent on events from older task versions, which read as "not drawing".
  drawing: z.boolean().optional(),
  text: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  // Stable per-run id for Polaris's final reply; see liveblocks.config.ts.
  messageId: z.string().optional(),
})

export type AiStatusPayload = z.infer<typeof aiStatusPayloadSchema>

export const chatMessageSchema = z.object({
  id: z.string(),
  sender: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
  // Follow-up prompts Polaris offers after a reply; rendered as chips under
  // the latest assistant message.
  suggestions: z.array(z.string()).optional(),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>
