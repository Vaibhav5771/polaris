import dagre from "@dagrejs/dagre"

import { SHAPE_SIZES, type CanvasShape, type EdgeSide } from "@/types/canvas"

/**
 * Diagram layout, shared by the Trigger task and the browser.
 *
 * This module is deliberately free of React, Liveblocks and React Flow runtime
 * imports: the background task has to lay a diagram out inside a Node process
 * with no browser attached, and the tidy button has to produce the identical
 * picture in the client. One implementation is what stops the two drifting.
 *
 * Everything here is pure and deterministic. The same nodes and edges give the
 * same positions in either runtime, which is what makes a layout regression
 * visible rather than plausible on a project with no automated tests.
 */

// Gaps between layers and between nodes within a layer. Both are wider than
// the effective spacing the old prompt-driven placement produced, because
// connectors now need room to leave from a face rather than always the right.
const RANK_SEP = 140
const NODE_SEP = 80
const MARGIN = 40

// How wide a row of unconnected nodes may grow before it wraps, used only when
// there is no laid-out graph to take the width from.
const LOOSE_ROW_FALLBACK_WIDTH = 1200

/** The minimum a node needs to carry to take part in a layout. */
export interface LayoutNode {
  id: string
  position: { x: number; y: number }
  width?: number | null
  height?: number | null
  data?: { shape?: string | null } | null
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
}

export interface LayoutPosition {
  id: string
  x: number
  y: number
}

export interface LayoutEdgeSides {
  id: string
  sourceHandle: EdgeSide
  targetHandle: EdgeSide
}

export interface LayoutResult {
  nodes: LayoutPosition[]
  edges: LayoutEdgeSides[]
}

/**
 * A node's box. Prefers the stored width/height, which every creation path
 * sets, and falls back to the shared shape size table when a node predates
 * that or was stored without one.
 */
function boxOf(node: LayoutNode): { width: number; height: number } {
  const shape = node.data?.shape as CanvasShape | undefined
  const fallback = (shape && SHAPE_SIZES[shape]) || SHAPE_SIZES.rectangle
  return {
    width: node.width ?? fallback.width,
    height: node.height ?? fallback.height,
  }
}

function centreOf(node: LayoutNode, at?: { x: number; y: number }): { x: number; y: number } {
  const { width, height } = boxOf(node)
  const origin = at ?? node.position
  return { x: origin.x + width / 2, y: origin.y + height / 2 }
}

/**
 * Choose the faces a connector should leave from and arrive at, from where the
 * two nodes actually sit.
 *
 * This is the only code in the project that decides a connector's sides. It
 * never moves a node and never calls dagre, which is what lets a drag re-side
 * the connectors touching the moved node without reshuffling the canvas.
 *
 * The rule is the dominant axis of the delta between the two centres, a tie
 * resolving to horizontal. A self-referencing edge is skipped: it is left out
 * of the result entirely so the caller keeps whatever sides it already has.
 *
 * @param positions optional overrides, used by layoutCanvas to pick sides
 *   against positions it has just computed rather than the stored ones.
 */
export function pickEdgeSides(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  positions?: ReadonlyMap<string, { x: number; y: number }>,
): LayoutEdgeSides[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const sides: LayoutEdgeSides[] = []

  for (const edge of edges) {
    if (edge.source === edge.target) continue
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue

    const from = centreOf(source, positions?.get(source.id))
    const to = centreOf(target, positions?.get(target.id))
    const dx = to.x - from.x
    const dy = to.y - from.y

    if (Math.abs(dx) >= Math.abs(dy)) {
      sides.push(
        dx >= 0
          ? { id: edge.id, sourceHandle: "right", targetHandle: "left" }
          : { id: edge.id, sourceHandle: "left", targetHandle: "right" },
      )
    } else {
      sides.push(
        dy >= 0
          ? { id: edge.id, sourceHandle: "bottom", targetHandle: "top" }
          : { id: edge.id, sourceHandle: "top", targetHandle: "bottom" },
      )
    }
  }

  return sides
}

/**
 * Lay the whole canvas out left to right and pick every connector's sides
 * against the new positions.
 *
 * Nodes with at least one connection go through dagre, which packs them into
 * layers and keeps disconnected clusters clear of each other in the same pass.
 * Nodes with no connections at all are parked in a row below the result, so
 * loose shapes never land on top of the diagram.
 */
export function layoutCanvas(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
): LayoutResult {
  if (nodes.length === 0) return { nodes: [], edges: [] }

  const byId = new Map(nodes.map((node) => [node.id, node]))

  // Only edges whose endpoints both exist can inform the layout. Self-edges
  // are dropped here too: they say nothing about where a node belongs.
  const usableEdges = edges.filter(
    (edge) => edge.source !== edge.target && byId.has(edge.source) && byId.has(edge.target),
  )

  const connected = new Set<string>()
  for (const edge of usableEdges) {
    connected.add(edge.source)
    connected.add(edge.target)
  }

  const graphNodes = nodes.filter((node) => connected.has(node.id))
  const looseNodes = nodes.filter((node) => !connected.has(node.id))

  const positions = new Map<string, { x: number; y: number }>()

  // Bounds of the laid-out graph, used to anchor the loose-node row below it.
  let minX = 0
  let minY = 0
  let maxX = LOOSE_ROW_FALLBACK_WIDTH
  let maxY = -RANK_SEP

  if (graphNodes.length > 0) {
    const graph = new dagre.graphlib.Graph()
    graph.setGraph({
      rankdir: "LR",
      ranksep: RANK_SEP,
      nodesep: NODE_SEP,
      marginx: MARGIN,
      marginy: MARGIN,
    })
    graph.setDefaultEdgeLabel(() => ({}))

    for (const node of graphNodes) {
      graph.setNode(node.id, boxOf(node))
    }
    for (const edge of usableEdges) {
      graph.setEdge(edge.source, edge.target)
    }

    dagre.layout(graph)

    minX = Number.POSITIVE_INFINITY
    minY = Number.POSITIVE_INFINITY
    maxX = Number.NEGATIVE_INFINITY
    maxY = Number.NEGATIVE_INFINITY

    for (const node of graphNodes) {
      const laid = graph.node(node.id)
      if (!laid) continue
      const { width, height } = boxOf(node)
      // dagre reports a node's centre; React Flow stores its top-left corner.
      const x = laid.x - width / 2
      const y = laid.y - height / 2
      positions.set(node.id, { x, y })
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    }
  }

  // Unconnected nodes: a row left-aligned to the graph, one rank gap below its
  // lowest point, wrapping once the row would run past the graph's width.
  if (looseNodes.length > 0) {
    const anchorX = minX
    const rowWidth = Math.max(maxX - minX, LOOSE_ROW_FALLBACK_WIDTH)
    let cursorX = anchorX
    let rowY = maxY + RANK_SEP
    let rowHeight = 0

    for (const node of looseNodes) {
      const { width, height } = boxOf(node)
      if (cursorX > anchorX && cursorX + width > anchorX + rowWidth) {
        cursorX = anchorX
        rowY += rowHeight + NODE_SEP
        rowHeight = 0
      }
      positions.set(node.id, { x: cursorX, y: rowY })
      cursorX += width + NODE_SEP
      rowHeight = Math.max(rowHeight, height)
    }
  }

  return {
    nodes: nodes
      .filter((node) => positions.has(node.id))
      .map((node) => {
        const position = positions.get(node.id)!
        return { id: node.id, x: position.x, y: position.y }
      }),
    edges: pickEdgeSides(nodes, edges, positions),
  }
}
