"use client"

import { Component, type ReactNode } from "react"
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react"
import { LiveList, LiveObject, LiveMap } from "@liveblocks/client"
import { ReactFlowProvider } from "@xyflow/react"

import { CanvasFlow } from "./canvas-flow"
import type { CanvasSaveStatus } from "@/hooks/use-canvas-autosave"
import type { ChatMessage } from "@/types/tasks"

interface CanvasWrapperProps {
  projectId: string
  templatesOpen: boolean
  onTemplatesOpenChange: (open: boolean) => void
  onSaveStatusChange?: (status: CanvasSaveStatus) => void
  onAiMessage?: (message: string, suggestions?: string[]) => void
  onAiThinkingChange?: (thinking: boolean, message?: string) => void
  onChatMessages?: (messages: readonly ChatMessage[]) => void
  onRegisterAddChatMessage?: (fn: (msg: ChatMessage) => void) => void
  onRegisterClearChatMessages?: (fn: () => void) => void
  onRegisterGetCanvas?: (fn: () => { nodes: unknown[]; edges: unknown[] }) => void
}

class LiveblocksErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export function CanvasWrapper({
  projectId,
  templatesOpen,
  onTemplatesOpenChange,
  onSaveStatusChange,
  onAiMessage,
  onAiThinkingChange,
  onChatMessages,
  onRegisterAddChatMessage,
  onRegisterClearChatMessages,
  onRegisterGetCanvas,
}: CanvasWrapperProps) {
  return (
    <LiveblocksErrorBoundary
      fallback={
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Unable to connect to canvas.</p>
        </div>
      }
    >
      <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
        <RoomProvider
          id={projectId}
          initialPresence={{ cursor: null, thinking: false }}
          initialStorage={() => ({
            flow: new LiveObject({
              nodes: new LiveMap(),
              edges: new LiveMap(),
            }),
            aiStatus: new LiveObject({ thinking: false, message: "", drawing: false }),
            chatMessages: new LiveList([]),
          })}
        >
          <ClientSideSuspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading canvas…</p>
              </div>
            }
          >
            <ReactFlowProvider>
              <CanvasFlow
                projectId={projectId}
                templatesOpen={templatesOpen}
                onTemplatesOpenChange={onTemplatesOpenChange}
                onSaveStatusChange={onSaveStatusChange}
                onAiMessage={onAiMessage}
                onAiThinkingChange={onAiThinkingChange}
                onChatMessages={onChatMessages}
                onRegisterAddChatMessage={onRegisterAddChatMessage}
                onRegisterClearChatMessages={onRegisterClearChatMessages}
                onRegisterGetCanvas={onRegisterGetCanvas}
              />
            </ReactFlowProvider>
          </ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </LiveblocksErrorBoundary>
  )
}
