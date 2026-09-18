"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ReactFlow, Background, BackgroundVariant, MiniMap, ConnectionMode, useReactFlow } from "@xyflow/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import { useMutation, useRedo, useStorage, useUndo, useUpdateMyPresence, useEventListener } from "@liveblocks/react"
import { Loader2 } from "lucide-react"

import type { CanvasNode, CanvasEdge, CanvasAction } from "@/types/canvas"
import { SHAPE_DRAG_TYPE, type ShapeDragPayload } from "@/types/canvas"
import { aiStatusPayloadSchema, type ChatMessage } from "@/types/tasks"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useCanvasAutosave, type CanvasSaveStatus } from "@/hooks/use-canvas-autosave"

// Fallback shown in the minimap for nodes that have no palette color set.
// Deliberately lighter than DEFAULT_NODE_BACKGROUND so uncolored nodes remain
// visible against the dark minimap background.
const MINIMAP_DEFAULT_NODE_COLOR = "oklch(0.7 0 0)"
import { CanvasNodeComponent } from "./canvas-node"
import { CanvasEdgeComponent } from "./canvas-edge"
import { MinimapShape } from "./minimap-shape"
import { ShapePanel } from "./shape-panel"
import { CanvasControls } from "./canvas-controls"
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal"
import type { CanvasTemplate } from "@/components/editor/starter-templates"
import { PresenceAvatars } from "./presence-avatars"
import { LiveCursors } from "./live-cursors"

const nodeTypes = { canvasNode: CanvasNodeComponent }
const edgeTypes = { canvasEdge: CanvasEdgeComponent }
// New connections default to the custom edge type — the canvas-edge marker
// is rendered inline per edge, so no global MarkerType/markerEnd is set here.
const defaultEdgeOptions = { type: "canvasEdge" as const }
// React Flow's default is ["Backspace"]; adding "Delete" so the Del key on
// full-size keyboards deletes selected nodes/edges too.
const deleteKeyCode = ["Backspace", "Delete"]
// Ctrl (Windows/Linux) or Cmd (macOS) click adds a node/edge to the current
// selection. Declared explicitly so the wiring is visible in-code even though
// this matches React Flow's default.
const multiSelectionKeyCode = ["Control", "Meta"]
// Mouse-button codes for panOnDrag: 0 = left, 1 = middle, 2 = right. Left drag
// is claimed by selectionOnDrag (marquee selection); pan lives on middle or
// right-mouse drag. Matches Figma / most canvas tools.
const panOnDrag = [1, 2]
let nodeCounter = 0

interface CanvasFlowProps {
  projectId: string
  templatesOpen: boolean
  onTemplatesOpenChange: (open: boolean) => void
  onSaveStatusChange?: (status: CanvasSaveStatus) => void
  onAiMessage?: (message: string) => void
  onAiThinkingChange?: (thinking: boolean, message?: string) => void
  onChatMessages?: (messages: readonly ChatMessage[]) => void
  onRegisterAddChatMessage?: (fn: (msg: ChatMessage) => void) => void
  onRegisterGetCanvas?: (fn: () => { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void
}

export function CanvasFlow({ projectId, templatesOpen, onTemplatesOpenChange, onSaveStatusChange, onAiMessage, onAiThinkingChange, onChatMessages, onRegisterAddChatMessage, onRegisterGetCanvas }: CanvasFlowProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })
  const reactFlow = useReactFlow()
  const { screenToFlowPosition, fitView } = reactFlow
  const undo = useUndo()
  const redo = useRedo()
  const updateMyPresence = useUpdateMyPresence()

  useKeyboardShortcuts({ reactFlow, undo, redo })

  // AI thinking state — read from Storage so all participants (including late joiners)
  // see the correct state. Falls back to false for rooms created before this feature.
  const aiThinking = (useStorage((root) => root.aiStatus?.thinking ?? false) ?? false)
  const aiMessage = (useStorage((root) => root.aiStatus?.message ?? "") ?? "")

  // Sync thinking state to the parent and to my own presence so cursor badges update.
  useEffect(() => {
    onAiThinkingChange?.(aiThinking, aiThinking ? aiMessage || undefined : undefined)
  }, [aiThinking, aiMessage, onAiThinkingChange])

  // ai-chat feed — separate from ai-status-feed (aiStatus Storage key).
  const chatMessages = useStorage((root) => root.chatMessages)

  const addChatMessage = useMutation(({ storage }, msg: ChatMessage) => {
    storage.get("chatMessages").push(msg)
  }, [])

  // Pipe the full message list up whenever it changes (covers initial load + real-time updates).
  useEffect(() => {
    onChatMessages?.(chatMessages ?? [])
  }, [chatMessages, onChatMessages])

  // Register the mutation function so the parent can add messages from outside the RoomProvider.
  useEffect(() => {
    onRegisterAddChatMessage?.(addChatMessage)
  }, [addChatMessage, onRegisterAddChatMessage])

  // Register a getter so the parent can read current nodes/edges on demand
  // (used by the spec generation handler in WorkspaceShell).
  useEffect(() => {
    if (!onRegisterGetCanvas) return
    onRegisterGetCanvas(() => ({ nodes: nodesRef.current, edges: edgesRef.current }))
  }, [onRegisterGetCanvas])

  useEffect(() => {
    updateMyPresence({ thinking: aiThinking })
  }, [aiThinking, updateMyPresence])

  const updateAiStatus = useMutation(
    ({ storage }, { thinking, message }: { thinking: boolean; message: string }) => {
      const aiStatus = storage.get("aiStatus")
      if (!aiStatus) return
      aiStatus.set("thinking", thinking)
      aiStatus.set("message", message)
    },
    [],
  )

  // Mutation for canvas actions that require direct Storage writes (move, resize,
  // update data, delete). addNode/addEdge go through onNodesChange/onEdgesChange
  // so @liveblocks/react-flow wraps them correctly as LiveObjects.
  const applyAiStorageMutation = useMutation(({ storage }, action: CanvasAction) => {
    const nodesMap = storage.get("flow").get("nodes")
    const edgesMap = storage.get("flow").get("edges")
    switch (action.type) {
      case "moveNode": {
        const node = nodesMap.get(action.id)
        if (node) node.set("position", { x: action.x, y: action.y })
        break
      }
      case "resizeNode": {
        const node = nodesMap.get(action.id)
        if (node) {
          node.set("width", action.width)
          node.set("height", action.height)
        }
        break
      }
      case "updateNodeData": {
        const node = nodesMap.get(action.id)
        if (node) {
          const data = node.get("data")
          if (action.label !== undefined) data.set("label", action.label)
          if (action.color !== undefined) data.set("color", action.color)
          if (action.textColor !== undefined) data.set("textColor", action.textColor)
        }
        break
      }
      case "deleteNode":
        nodesMap.delete(action.id)
        break
      case "deleteEdge":
        edgesMap.delete(action.id)
        break
    }
  }, [])

  const handleAiAction = useCallback((action: CanvasAction) => {
    if (action.type === "addNode") {
      const node: CanvasNode = {
        id: action.id,
        type: "canvasNode",
        position: { x: action.x, y: action.y },
        data: { label: action.label, shape: action.shape, color: action.color, textColor: action.textColor },
        width: action.width,
        height: action.height,
      }
      onNodesChange([{ type: "add", item: node }])
    } else if (action.type === "addEdge") {
      const edge: CanvasEdge = {
        id: action.id,
        type: "canvasEdge",
        source: action.source,
        target: action.target,
        sourceHandle: "right",
        targetHandle: "left",
        data: { label: action.label },
      }
      onEdgesChange([{ type: "add", item: edge }])
    } else {
      applyAiStorageMutation(action)
    }
  }, [onNodesChange, onEdgesChange, applyAiStorageMutation])

  useEventListener(({ event }) => {
    if (event.type === "ai:status") {
      // Validate through the ai-status-feed schema before acting on the payload.
      const parsed = aiStatusPayloadSchema.safeParse({
        thinking: event.thinking,
        text: event.message,
      })
      if (!parsed.success) return
      const { thinking, text } = parsed.data
      updateAiStatus({ thinking, message: text ?? "" })
      if (text) onAiMessage?.(text)
    } else if (event.type === "ai:action") {
      handleAiAction(event.action)
    }
  })

  // Hydrate the room from the saved blob only when it is genuinely empty —
  // this runs once per project mount. Refs mirror the live Storage arrays so
  // the effect can re-check emptiness after the fetch resolves without adding
  // nodes/edges to its dep list (which would re-run the loader on every change).
  const [canvasLoaded, setCanvasLoaded] = useState(false)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  })

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadSavedCanvas() {
      // Room already carries active work — do not overwrite live collaboration.
      if (nodesRef.current.length > 0 || edgesRef.current.length > 0) {
        if (!cancelled) setCanvasLoaded(true)
        return
      }
      try {
        const response = await fetch(`/api/projects/${projectId}/canvas`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = (await response.json()) as {
          canvas: { nodes?: CanvasNode[]; edges?: CanvasEdge[] } | null
        }
        if (cancelled || !data.canvas) return
        // Second guard: another client may have populated the room during the
        // fetch. Skip the merge to avoid duplicating work already in Storage.
        if (nodesRef.current.length > 0 || edgesRef.current.length > 0) return
        if (data.canvas.nodes?.length) {
          onNodesChange(data.canvas.nodes.map((item) => ({ type: "add", item })))
        }
        if (data.canvas.edges?.length) {
          onEdgesChange(data.canvas.edges.map((item) => ({ type: "add", item })))
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
      } finally {
        if (!cancelled) setCanvasLoaded(true)
      }
    }

    loadSavedCanvas()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [projectId, onNodesChange, onEdgesChange])

  const { status: saveStatus } = useCanvasAutosave({
    projectId,
    nodes,
    edges,
    enabled: canvasLoaded,
  })

  useEffect(() => {
    onSaveStatusChange?.(saveStatus)
  }, [saveStatus, onSaveStatusChange])

  // Heal rooms that contain plain-object nodes from the pre-fix drop handler.
  // Liveblocks-react-flow expects each stored value to be a LiveObject; a plain
  // object crashes on the first `.get`/`.setLocal` call during measure/drag.
  const removeLegacyNodes = useMutation(({ storage }) => {
    const nodesMap = storage.get("flow").get("nodes")
    const legacy: CanvasNode[] = []
    for (const [, entry] of nodesMap.entries()) {
      if (typeof (entry as { get?: unknown }).get !== "function") {
        legacy.push({ ...(entry as unknown as CanvasNode) })
      }
    }
    for (const node of legacy) {
      nodesMap.delete(node.id)
    }
    return legacy
  }, [])

  useEffect(() => {
    const legacy = removeLegacyNodes()
    if (legacy.length > 0) {
      onNodesChange(legacy.map((item) => ({ type: "add", item })))
    }
  }, [removeLegacyNodes, onNodesChange])

  const importTemplate = useCallback(
    (template: CanvasTemplate) => {
      // Fresh clones per import so React Flow / Liveblocks own the objects
      // and later mutations (drag, label edit) don't scribble on the shared
      // constants exported from starter-templates.ts.
      const templateNodes: CanvasNode[] = template.nodes.map((node) => ({
        ...node,
        position: { ...node.position },
        data: { ...node.data },
      }))
      const templateEdges: CanvasEdge[] = template.edges.map((edge) => ({
        ...edge,
        data: edge.data ? { ...edge.data } : {},
      }))

      // Replace, don't append: clear the room first so the template lands on
      // an empty canvas regardless of prior work. onDelete drives the same
      // Storage-sync path as user-initiated deletes, so it stays inside the
      // collaborative flow.
      if (nodes.length > 0 || edges.length > 0) {
        onDelete({ nodes, edges })
      }
      if (templateNodes.length > 0) {
        onNodesChange(templateNodes.map((item) => ({ type: "add", item })))
      }
      if (templateEdges.length > 0) {
        onEdgesChange(templateEdges.map((item) => ({ type: "add", item })))
      }

      onTemplatesOpenChange(false)

      // fitView after the change has flushed — nodes need to be measured by
      // React Flow's ResizeObserver first so bounds are known.
      requestAnimationFrame(() => {
        fitView({ duration: 400, padding: 0.2 })
      })
    },
    [nodes, edges, onDelete, onNodesChange, onEdgesChange, onTemplatesOpenChange, fitView],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  // Broadcast cursor in flow-space coordinates so remote clients render it at
  // the correct world point regardless of their pan/zoom (each viewer projects
  // it back to screen space via useReactFlow().flowToScreenPosition).
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      updateMyPresence({ cursor: { x: flow.x, y: flow.y } })
    },
    [screenToFlowPosition, updateMyPresence],
  )

  const onMouseLeave = useCallback(() => {
    updateMyPresence({ cursor: null })
  }, [updateMyPresence])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData(SHAPE_DRAG_TYPE)
      if (!raw) return
      const payload = JSON.parse(raw) as ShapeDragPayload
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      position.x -= payload.width / 2
      position.y -= payload.height / 2
      const id = `${payload.shape}-${Date.now()}-${++nodeCounter}`
      const node: CanvasNode = {
        id,
        type: "canvasNode",
        position,
        data: { label: "", shape: payload.shape },
        width: payload.width,
        height: payload.height,
      }
      // Route insertion through onNodesChange so @liveblocks/react-flow wraps
      // the node as a LiveObject (with NODE_BASE_CONFIG). A plain `.set(id, node)`
      // would lack the `setLocal`/atomic-field machinery that drag/select use.
      onNodesChange([{ type: "add", item: node }])
    },
    [screenToFlowPosition, onNodesChange],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={deleteKeyCode}
        multiSelectionKeyCode={multiSelectionKeyCode}
        selectionOnDrag
        panOnDrag={panOnDrag}
        panOnScroll
        connectionMode={ConnectionMode.Loose}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap
          nodeComponent={MinimapShape}
          nodeColor={(n) => (n as CanvasNode).data?.color ?? MINIMAP_DEFAULT_NODE_COLOR}
          maskColor="rgba(0,0,0,0.55)"
          style={{
            backgroundColor: "#1f1f23",
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        />
      </ReactFlow>
      <LiveCursors />
      <PresenceAvatars />
      <ShapePanel />
      <CanvasControls />
      <StarterTemplatesModal
        open={templatesOpen}
        onOpenChange={onTemplatesOpenChange}
        onImport={importTemplate}
      />
      {aiThinking && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/30 bg-background/90 px-4 py-2 text-xs font-medium text-primary backdrop-blur">
          <Loader2 className="h-3 w-3 animate-spin" />
          Polaris is designing…
        </div>
      )}
    </div>
  )
}
