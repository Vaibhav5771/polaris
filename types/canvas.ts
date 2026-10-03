import type { Node, Edge } from "@xyflow/react"

export type CanvasShape = "rectangle" | "circle" | "diamond" | "pill" | "cylinder" | "hexagon"

export interface CanvasNodeData extends Record<string, unknown> {
  label: string
  color?: string
  textColor?: string
  shape?: CanvasShape
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">

export interface CanvasEdgeData extends Record<string, unknown> {
  label?: string
}

export type CanvasEdge = Edge<CanvasEdgeData, "canvasEdge">

export interface ShapeDragPayload {
  shape: CanvasShape
  width: number
  height: number
}

export const SHAPE_DRAG_TYPE = "application/ghost-shape"

// The single source of truth for how big a node of each shape starts out.
// Every creation path reads this — the shape panel's drag-drop, the starter
// templates, and the AI task — so a node's box is the same whoever made it.
// This matters beyond cosmetics now: layoutCanvas is told each node's box to
// pack the graph, so three tables that disagree would mean three layouts.
export const SHAPE_SIZES: Record<CanvasShape, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 },
  circle:    { width: 100, height: 100 },
  diamond:   { width: 140, height: 140 },
  pill:      { width: 160, height: 60 },
  cylinder:  { width: 140, height: 90 },
  hexagon:   { width: 130, height: 110 },
}

export interface NodeColorPair {
  id: string
  name: string
  background: string
  text: string
}

export const DEFAULT_NODE_BACKGROUND = "oklch(0.22 0 0)"
export const DEFAULT_NODE_TEXT = "rgba(255,255,255,0.85)"

// Text colors carry the same hue as the background so labels feel tinted
// rather than plain white/black. Lightness is pushed far from the background
// (light bg → very dark text, dark bg → very light text) to keep readable
// contrast, and chroma is kept high enough to stay visibly colored.
export const NODE_COLOR_PALETTE: readonly NodeColorPair[] = [
  { id: "default", name: "Default", background: DEFAULT_NODE_BACKGROUND, text: DEFAULT_NODE_TEXT },
  { id: "blue",    name: "Blue",    background: "oklch(0.42 0.16 250)", text: "oklch(0.94 0.06 250)" },
  { id: "emerald", name: "Emerald", background: "oklch(0.42 0.13 160)", text: "oklch(0.94 0.08 160)" },
  { id: "amber",   name: "Amber",   background: "oklch(0.72 0.15 75)",  text: "oklch(0.28 0.10 75)"  },
  { id: "rose",    name: "Rose",    background: "oklch(0.48 0.18 15)",  text: "oklch(0.94 0.06 15)"  },
  { id: "violet",  name: "Violet",  background: "oklch(0.42 0.17 300)", text: "oklch(0.94 0.07 300)" },
  { id: "cyan",    name: "Cyan",    background: "oklch(0.68 0.11 210)", text: "oklch(0.26 0.08 210)" },
] as const

// The four faces a connector can leave from or arrive at. These are the handle
// IDs rendered by canvas-node.tsx, so a value outside this set fails React
// Flow's handle lookup.
export type EdgeSide = "top" | "right" | "bottom" | "left"

export type CanvasAction =
  | { type: "addNode"; id: string; label: string; shape: CanvasShape; color?: string; textColor?: string; x: number; y: number; width: number; height: number }
  | { type: "moveNode"; id: string; x: number; y: number }
  | { type: "resizeNode"; id: string; width: number; height: number }
  | { type: "updateNodeData"; id: string; label?: string; color?: string; textColor?: string }
  | { type: "deleteNode"; id: string }
  // sourceHandle/targetHandle are optional purely for deploy ordering: a new
  // client may receive this action from a task deploy that predates the
  // layout work. The receiver falls back to the old right/left pair rather
  // than creating an edge with an undefined handle, which React Flow rejects.
  | { type: "addEdge"; id: string; source: string; target: string; label?: string; sourceHandle?: EdgeSide; targetHandle?: EdgeSide }
  | { type: "deleteEdge"; id: string }
  // Repositions nodes that already exist and re-sides their connectors, so the
  // AI can make room on a canvas before streaming new nodes into it. An older
  // client hits no matching case and ignores it, degrading to new nodes laid
  // out while existing ones stay put.
  | {
      type: "applyLayout"
      nodes: Array<{ id: string; x: number; y: number }>
      edges: Array<{ id: string; sourceHandle: EdgeSide; targetHandle: EdgeSide }>
    }
