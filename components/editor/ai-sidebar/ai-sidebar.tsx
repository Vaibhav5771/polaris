"use client"

import { useState } from "react"
import { Bot, Eraser, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { AiArchitectTab } from "./ai-architect-tab"
import { AiSpecsTab } from "./ai-specs-tab"
import type { ChatMessage } from "@/types/tasks"

export interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  messages?: ChatMessage[]
  onSend?: (prompt: string) => void
  onClearChat?: () => void
  isThinking?: boolean
  statusMessage?: string
  onGenerateSpec?: () => Promise<void>
  isGeneratingSpec?: boolean
  specRefreshKey?: number
}

const TAB_TRIGGER_CLASS =
  "flex-1 rounded-md text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-primary/15 data-[state=active]:text-primary"

export function AiSidebar({ isOpen, onClose, projectId, messages = [], onSend, onClearChat, isThinking, statusMessage, onGenerateSpec, isGeneratingSpec, specRefreshKey }: AiSidebarProps) {
  const [tab, setTab] = useState<"architect" | "specs">("architect")
  const [isClearOpen, setIsClearOpen] = useState(false)

  // Clearing wipes the thread for the whole room, so it is only offered while
  // the chat is the visible tab and there is actually something to wipe.
  const canClearChat = tab === "architect" && !!onClearChat && messages.length > 0

  function confirmClearChat() {
    onClearChat?.()
    setIsClearOpen(false)
  }

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l border-border bg-background/95 shadow-2xl backdrop-blur transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <AiSidebarHeader
        onClose={onClose}
        onClearChat={canClearChat ? () => setIsClearOpen(true) : undefined}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as "architect" | "specs")}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="px-4 pt-3">
          <TabsList className="grid h-10 w-full grid-cols-2 gap-1 bg-muted p-1">
            <TabsTrigger value="architect" className={TAB_TRIGGER_CLASS}>
              AI Architect
            </TabsTrigger>
            <TabsTrigger value="specs" className={TAB_TRIGGER_CLASS}>
              Specs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="architect"
          className="mt-0 flex flex-1 flex-col overflow-hidden focus-visible:ring-0"
        >
          <AiArchitectTab
            messages={messages}
            onSend={onSend}
            isThinking={isThinking}
            statusMessage={statusMessage}
          />
        </TabsContent>

        <TabsContent
          value="specs"
          className="mt-0 flex flex-1 flex-col overflow-hidden focus-visible:ring-0"
        >
          <AiSpecsTab
            projectId={projectId}
            onGenerateSpec={onGenerateSpec}
            isGeneratingSpec={isGeneratingSpec}
            specRefreshKey={specRefreshKey}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear chat</DialogTitle>
            <DialogDescription>
              This empties the thread for everyone in this project, not just you. The
              messages cannot be recovered. The diagram on the canvas is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsClearOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmClearChat}>
              Clear chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

function AiSidebarHeader({
  onClose,
  onClearChat,
}: {
  onClose: () => void
  onClearChat?: () => void
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            AI Workspace
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Collaborate with Polaris
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onClearChat && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearChat}
            aria-label="Clear chat for everyone"
            title="Clear chat for everyone"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Eraser className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close AI sidebar"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

