"use client"

import { useMemo } from "react"
import { Bot, Loader2, Sparkles } from "lucide-react"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { chatMessageSchema, type ChatMessage } from "@/types/tasks"

interface AiArchitectTabProps {
  messages: ChatMessage[]
  onSend?: (prompt: string) => void
  isThinking?: boolean
  statusMessage?: string
}

const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
] as const

export function AiArchitectTab({ messages, onSend, isThinking, statusMessage }: AiArchitectTabProps) {
  // Validate messages before rendering — drop any that don't match the schema.
  const validMessages = useMemo(
    () => messages.filter((m) => chatMessageSchema.safeParse(m).success),
    [messages]
  )

  function handleSubmit(message: PromptInputMessage) {
    const trimmed = message.text.trim()
    if (!trimmed || isThinking) return
    // Fire-and-forget — the composer clears immediately rather than waiting
    // on the round trip, matching the previous optimistic-send behavior.
    onSend?.(trimmed)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Conversation className="flex-1">
        <ConversationContent>
          {validMessages.length === 0 ? (
            <ConversationEmptyState>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">Design with Polaris</h3>
                <p className="text-xs text-muted-foreground">
                  Describe a system, ask a question, or just say hi — Polaris will chat or draw, whichever fits.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-2 pt-2">
                <p className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Try one of these
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onSend?.(prompt)}
                      className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            validMessages.map((message, index) => (
              <ChatBubble
                key={message.id}
                message={message}
                // Only the newest message offers follow-ups — older chips are
                // stale once the conversation has moved on.
                onSuggestionClick={index === validMessages.length - 1 && !isThinking ? onSend : undefined}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {isThinking && (
        <div className="shrink-0 flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-4 py-2">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          <span className="truncate text-xs text-primary">
            {statusMessage ?? "Polaris is working…"}
          </span>
        </div>
      )}

      <div className="shrink-0 border-t border-border bg-background/60 p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask Polaris to design, refine, or just chat…"
              aria-label="Chat with Polaris"
              disabled={isThinking}
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={isThinking ? "submitted" : "ready"} disabled={isThinking} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  )
}

function ChatBubble({
  message,
  onSuggestionClick,
}: {
  message: ChatMessage
  onSuggestionClick?: (suggestion: string) => void
}) {
  const isUser = message.role === "user"
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
  const suggestions = message.suggestions ?? []

  return (
    <Message from={message.role}>
      <div className={`flex items-center gap-1.5 px-1 ${isUser ? "flex-row-reverse" : ""}`}>
        <span className="text-[11px] font-medium text-muted-foreground">{message.sender}</span>
        <span className="text-[10px] text-muted-foreground/50">{time}</span>
      </div>
      <MessageContent>
        <MessageResponse>{message.content}</MessageResponse>
      </MessageContent>
      {onSuggestionClick && suggestions.length > 0 && (
        <Suggestions className="pt-1">
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={onSuggestionClick}
              className="h-7 border-border bg-transparent px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            />
          ))}
        </Suggestions>
      )}
    </Message>
  )
}
