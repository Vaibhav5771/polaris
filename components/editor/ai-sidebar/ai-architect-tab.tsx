"use client"

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react"
import { Bot, Loader2, Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useState } from "react"
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

const TEXTAREA_MIN_HEIGHT = 72
const TEXTAREA_MAX_HEIGHT = 160

export function AiArchitectTab({ messages, onSend, isThinking, statusMessage }: AiArchitectTabProps) {
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollBottomRef = useRef<HTMLDivElement | null>(null)

  // Validate messages before rendering — drop any that don't match the schema.
  const validMessages = useMemo(
    () => messages.filter((m) => chatMessageSchema.safeParse(m).success),
    [messages]
  )

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const next = Math.min(
      Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT),
      TEXTAREA_MAX_HEIGHT
    )
    el.style.height = `${next}px`
  }, [draft])

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ block: "end" })
  }, [validMessages.length])

  function submit(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend?.(trimmed)
    setDraft("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit(draft)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-3 px-4 py-4">
          {validMessages.length === 0 ? (
            <EmptyState onPromptSelect={submit} />
          ) : (
            validMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={scrollBottomRef} />
        </div>
      </ScrollArea>

      {isThinking && (
        <div className="shrink-0 flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-4 py-2">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          <span className="truncate text-xs text-primary">
            {statusMessage ?? "Polaris is working…"}
          </span>
        </div>
      )}

      <div className="shrink-0 border-t border-border bg-background/60 p-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Polaris to design or refine a system…"
            style={{
              minHeight: TEXTAREA_MIN_HEIGHT,
              maxHeight: TEXTAREA_MAX_HEIGHT,
            }}
            className="resize-none pr-12 text-sm"
            aria-label="Chat with Polaris"
            disabled={isThinking}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => submit(draft)}
            disabled={draft.trim().length === 0 || isThinking}
            className="absolute bottom-2 right-2 h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Send message"
          >
            {isThinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  )
}

function EmptyState({
  onPromptSelect,
}: {
  onPromptSelect: (prompt: string) => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 pt-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Bot className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          Design with Polaris
        </p>
        <p className="text-xs text-muted-foreground">
          Describe a system and Polaris will help you architect it.
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
              onClick={() => onPromptSelect(prompt)}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          {message.sender}
        </span>
        <span className="text-[10px] text-muted-foreground/50">{time}</span>
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "border-2 border-primary/50 bg-primary/20 text-foreground"
            : "border border-border bg-card text-foreground"
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
