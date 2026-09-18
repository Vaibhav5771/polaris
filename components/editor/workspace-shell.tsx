"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import {
  AlertCircle,
  Check,
  LayoutTemplate,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Share2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { AiSidebar } from "@/components/editor/ai-sidebar/ai-sidebar"
import { ProjectDialogs } from "@/components/editor/project-dialogs"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ShareDialog } from "@/components/editor/share-dialog"
import { CanvasWrapper } from "@/components/editor/canvas/canvas-wrapper"
import { useProjectActions } from "@/hooks/use-project-actions"
import type { CanvasSaveStatus } from "@/hooks/use-canvas-autosave"
import type { EditorProject, EditorProjectLists } from "@/lib/project-types"
import type { ChatMessage } from "@/types/tasks"

interface WorkspaceShellProps extends EditorProjectLists {
  activeProject: EditorProject
}

export function WorkspaceShell({
  activeProject,
  ownedProjects,
  sharedProjects,
}: WorkspaceShellProps) {
  const router = useRouter()
  const { user } = useUser()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const addChatMessageRef = useRef<((msg: ChatMessage) => void) | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [aiStatusMessage, setAiStatusMessage] = useState<string | undefined>()
  const [activeRun, setActiveRun] = useState<{ runId: string; publicToken: string } | null>(null)
  const [specRun, setSpecRun] = useState<{ runId: string; publicToken: string } | null>(null)
  const [specRefreshKey, setSpecRefreshKey] = useState(0)
  const getCanvasRef = useRef<(() => { nodes: unknown[]; edges: unknown[] }) | null>(null)

  const { run } = useRealtimeRun(activeRun?.runId ?? "", {
    accessToken: activeRun?.publicToken ?? "",
    enabled: !!activeRun,
    skipColumns: ["payload", "output"],
  })

  const { run: specRunRealtime } = useRealtimeRun(specRun?.runId ?? "", {
    accessToken: specRun?.publicToken ?? "",
    enabled: !!specRun,
    skipColumns: ["payload", "output"],
  })

  const TERMINAL_STATUSES = [
    "COMPLETED",
    "FAILED",
    "CANCELED",
    "CRASHED",
    "SYSTEM_FAILURE",
    "EXPIRED",
    "TIMED_OUT",
  ]

  const runStatus = run?.status
  useEffect(() => {
    if (!activeRun || !runStatus) return
    if (!TERMINAL_STATUSES.includes(runStatus)) return

    const succeeded = runStatus === "COMPLETED"
    const msg: ChatMessage = {
      id: `ai-${Date.now()}-${Math.random()}`,
      sender: "Polaris",
      role: "assistant",
      content: succeeded
        ? "Design complete. Your canvas has been updated."
        : "The design task failed. Please try again.",
      timestamp: Date.now(),
    }
    addChatMessageRef.current?.(msg)
    setActiveRun(null)
    setAiThinking(false)
    setAiStatusMessage(undefined)
  }, [runStatus, activeRun]) // eslint-disable-line react-hooks/exhaustive-deps

  const specRunStatus = specRunRealtime?.status
  useEffect(() => {
    if (!specRun || !specRunStatus) return
    if (!TERMINAL_STATUSES.includes(specRunStatus)) return
    setSpecRun(null)
    if (specRunStatus === "COMPLETED") {
      setSpecRefreshKey((k) => k + 1)
    } else {
      addChatMessageRef.current?.({
        id: `err-${Date.now()}`,
        sender: "Polaris",
        role: "assistant",
        content: `Spec generation ${specRunStatus.toLowerCase()}. Check the Trigger.dev dashboard for details.`,
        timestamp: Date.now(),
      })
    }
  }, [specRunStatus, specRun]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fade a fresh "Saved" back to "idle" after a beat so the pill doesn't sit
  // permanently in the success state — matches the ergonomic feel of Notion /
  // Figma save indicators. "Saving" and "error" persist until they change.
  useEffect(() => {
    if (saveStatus !== "saved") return
    const timeout = window.setTimeout(() => setSaveStatus("idle"), 1600)
    return () => window.clearTimeout(timeout)
  }, [saveStatus])

  const projectActions = useProjectActions({
    activeProjectId: activeProject.id,
  })

  const handleChatMessages = useCallback((messages: readonly ChatMessage[]) => {
    setChatMessages([...messages])
  }, [])

  const handleRegisterAddChatMessage = useCallback((fn: (msg: ChatMessage) => void) => {
    addChatMessageRef.current = fn
  }, [])

  const handleRegisterGetCanvas = useCallback(
    (fn: () => { nodes: unknown[]; edges: unknown[] }) => {
      getCanvasRef.current = fn
    },
    [],
  )

  const handleGenerateSpec = useCallback(async () => {
    const projectId = activeProject.id
    const canvas = getCanvasRef.current?.()
    try {
      const specRes = await fetch("/api/ai/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: projectId,
          chatHistory: chatMessages.map((m) => ({ role: m.role, content: m.content })),
          nodes: canvas?.nodes ?? [],
          edges: canvas?.edges ?? [],
        }),
      })
      if (!specRes.ok) {
        const detail = await specRes.text().catch(() => "")
        throw new Error(`Spec API ${specRes.status}: ${detail || "no body"}`)
      }
      const { runId, publicToken } = (await specRes.json()) as { runId: string; publicToken: string }

      setSpecRun({ runId, publicToken })
    } catch (err) {
      console.error("Spec generation failed:", err)
      addChatMessageRef.current?.({
        id: `err-${Date.now()}`,
        sender: "Polaris",
        role: "assistant",
        content: "Failed to start spec generation. Check that the Trigger.dev dev server is running and try again.",
        timestamp: Date.now(),
      })
    }
  }, [activeProject.id, chatMessages])

  const handleAiSend = useCallback(async (prompt: string) => {
    const projectId = activeProject.id
    const sender = user?.fullName ?? user?.emailAddresses?.[0]?.emailAddress ?? "User"
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    }
    addChatMessageRef.current?.(userMsg)
    try {
      const designRes = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, roomId: projectId, projectId }),
      })
      if (!designRes.ok) throw new Error("Design API returned an error")
      const { runId } = await designRes.json() as { runId: string }

      const tokenRes = await fetch("/api/ai/design/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      })
      if (!tokenRes.ok) throw new Error("Token API returned an error")
      const { token: publicToken } = await tokenRes.json() as { token: string }

      setActiveRun({ runId, publicToken })
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "Polaris",
        role: "assistant",
        content: "Failed to start the design task. Please try again.",
        timestamp: Date.now(),
      }
      addChatMessageRef.current?.(errMsg)
    }
  }, [activeProject.id, user])

  const handleAiMessage = useCallback((message: string) => {
    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}-${Math.random()}`,
      sender: "Polaris",
      role: "assistant",
      content: message,
      timestamp: Date.now(),
    }
    addChatMessageRef.current?.(aiMsg)
  }, [])

  const handleAiThinkingChange = useCallback((thinking: boolean, message?: string) => {
    setAiThinking(thinking)
    setAiStatusMessage(thinking ? message : undefined)
  }, [])

  function openProject(projectId: string) {
    setIsSidebarOpen(false)
    router.push(`/editor/${projectId}`)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="z-40 flex h-12 shrink-0 items-center border-b border-border bg-card px-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </Button>

          <span className="truncate text-sm font-semibold text-foreground">
            {activeProject.name}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 pr-2">
          {/* Save Button (status indicator + optional manual trigger) */}
          <SaveStatusButton status={saveStatus} />

          {/* AI Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAiPanelOpen((prev) => !prev)}
            className="gap-2 rounded-lg"
            aria-label="Toggle AI sidebar"
          >
            <span className="text-base">✦</span>
            AI
          </Button>

          {/* Templates Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsTemplatesOpen(true)}
            className="gap-2 rounded-lg"
            aria-label="Start from a template"
          >
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </Button>

          {/* Share Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsShareOpen(true)}
            className="gap-2 rounded-lg"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          activeProjectId={activeProject.id}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onCreateProject={projectActions.openCreateDialog}
          onDeleteProject={projectActions.openDeleteDialog}
          onOpenProject={openProject}
          onRenameProject={projectActions.openRenameDialog}
          ownedProjects={ownedProjects}
          sharedProjects={sharedProjects}
        />

        <main className="flex-1 overflow-hidden bg-background">
          <CanvasWrapper
            projectId={activeProject.id}
            templatesOpen={isTemplatesOpen}
            onTemplatesOpenChange={setIsTemplatesOpen}
            onSaveStatusChange={setSaveStatus}
            onAiMessage={handleAiMessage}
            onAiThinkingChange={handleAiThinkingChange}
            onChatMessages={handleChatMessages}
            onRegisterAddChatMessage={handleRegisterAddChatMessage}
            onRegisterGetCanvas={handleRegisterGetCanvas}
          />
        </main>

      </div>

      <AiSidebar
        isOpen={isAiPanelOpen}
        onClose={() => setIsAiPanelOpen(false)}
        projectId={activeProject.id}
        messages={chatMessages}
        onSend={handleAiSend}
        isThinking={aiThinking || !!activeRun}
        statusMessage={aiStatusMessage}
        onGenerateSpec={handleGenerateSpec}
        isGeneratingSpec={!!specRun}
        specRefreshKey={specRefreshKey}
      />

      <ProjectDialogs
        activeProject={projectActions.activeProject}
        dialog={projectActions.dialog}
        isLoading={projectActions.isLoading}
        onClose={projectActions.closeDialog}
        onCreate={projectActions.createProject}
        onDelete={projectActions.deleteProject}
        onNameChange={projectActions.setProjectName}
        onRename={projectActions.renameProject}
        projectName={projectActions.projectName}
        slugPreview={projectActions.slugPreview}
      />

      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        projectId={activeProject.id}
        isOwner={activeProject.owned}
      />
    </div>
  )
}

interface SaveStatusButtonProps {
  status: CanvasSaveStatus
}

function SaveStatusButton({ status }: SaveStatusButtonProps) {
  const { icon, label, ariaLabel, tone } = (() => {
    switch (status) {
      case "saving":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: "Saving",
          ariaLabel: "Saving canvas",
          tone: "text-muted-foreground",
        }
      case "saved":
        return {
          icon: <Check className="h-4 w-4 text-emerald-400" />,
          label: "Saved",
          ariaLabel: "Canvas saved",
          tone: "text-foreground",
        }
      case "error":
        return {
          icon: <AlertCircle className="h-4 w-4 text-destructive" />,
          label: "Retry",
          ariaLabel: "Save failed",
          tone: "text-destructive",
        }
      default:
        return {
          icon: <Save className="h-4 w-4" />,
          label: "Save",
          ariaLabel: "Save status",
          tone: "text-foreground",
        }
    }
  })()

  return (
    <Button
      variant="secondary"
      size="sm"
      className={`gap-2 rounded-lg ${tone}`}
      aria-label={ariaLabel}
      aria-live="polite"
      disabled={status === "saving"}
    >
      {icon}
      {label}
    </Button>
  )
}