"use client"

import { Maximize, Redo2, Undo2, Wand2, ZoomIn, ZoomOut } from "lucide-react"
import { useReactFlow } from "@xyflow/react"
import { useCanRedo, useCanUndo, useRedo, useUndo } from "@liveblocks/react"

const ZOOM_DURATION_MS = 200

interface ControlButtonProps {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ControlButton({ onClick, disabled, title, children }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

interface CanvasControlsProps {
  /** Lay the whole canvas out again, for everyone in the room. */
  onTidyLayout: () => void
  /** True while Polaris is drawing, or when there is nothing to lay out. */
  tidyDisabled: boolean
}

export function CanvasControls({ onTidyLayout, tidyDisabled }: CanvasControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const undo = useUndo()
  const redo = useRedo()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  return (
    <div className="absolute bottom-6 left-6 z-10 flex items-center gap-1 px-3 py-2 rounded-full bg-[oklch(0.18_0_0)] border border-white/10 shadow-xl">
      <ControlButton
        onClick={() => zoomOut({ duration: ZOOM_DURATION_MS })}
        title="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </ControlButton>
      <ControlButton
        onClick={() => fitView({ duration: ZOOM_DURATION_MS })}
        title="Fit view"
      >
        <Maximize className="h-4 w-4" />
      </ControlButton>
      <ControlButton
        onClick={() => zoomIn({ duration: ZOOM_DURATION_MS })}
        title="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </ControlButton>
      <div className="mx-1 h-5 w-px bg-white/10" aria-hidden />
      <ControlButton onClick={undo} disabled={!canUndo} title="Undo">
        <Undo2 className="h-4 w-4" />
      </ControlButton>
      <ControlButton onClick={redo} disabled={!canRedo} title="Redo">
        <Redo2 className="h-4 w-4" />
      </ControlButton>
      <div className="mx-1 h-5 w-px bg-white/10" aria-hidden />
      <ControlButton
        onClick={onTidyLayout}
        disabled={tidyDisabled}
        title="Tidy layout"
      >
        <Wand2 className="h-4 w-4" />
      </ControlButton>
    </div>
  )
}
