import type { CanvasNode, CanvasEdge, CanvasShape } from "@/types/canvas"
import { NODE_COLOR_PALETTE, SHAPE_SIZES } from "@/types/canvas"
import { pickEdgeSides } from "@/lib/canvas-layout"

export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

const palette = Object.fromEntries(
  NODE_COLOR_PALETTE.map((entry) => [entry.id, entry]),
) as Record<(typeof NODE_COLOR_PALETTE)[number]["id"], (typeof NODE_COLOR_PALETTE)[number]>

interface NodeSpec {
  id: string
  label: string
  shape: CanvasShape
  color: (typeof NODE_COLOR_PALETTE)[number]["id"]
  x: number
  y: number
  width?: number
  height?: number
}

function makeNode(spec: NodeSpec): CanvasNode {
  const size = SHAPE_SIZES[spec.shape]
  const pair = palette[spec.color]
  return {
    id: spec.id,
    type: "canvasNode",
    position: { x: spec.x, y: spec.y },
    data: {
      label: spec.label,
      shape: spec.shape,
      color: pair.background,
      textColor: pair.text,
    },
    width: spec.width ?? size.width,
    height: spec.height ?? size.height,
  }
}

interface EdgeSpec {
  source: string
  target: string
  label?: string
}

// Templates keep their hand-authored positions — whether an import should be
// laid out automatically is still an open question, recorded in spec 0001's
// follow-ups. Their connector sides are no longer hand-authored though: they
// come from the same pickEdgeSides every other connector in the product uses,
// read off the positions above. That keeps one rule for connector sides
// without touching where template nodes sit.
function makeTemplate(
  id: string,
  name: string,
  description: string,
  nodeSpecs: NodeSpec[],
  edgeSpecs: EdgeSpec[],
): CanvasTemplate {
  const nodes = nodeSpecs.map(makeNode)
  const bare = edgeSpecs.map((spec, index) => ({
    id: `${id}-e${index}`,
    source: spec.source,
    target: spec.target,
    label: spec.label,
  }))
  const sides = new Map(pickEdgeSides(nodes, bare).map((side) => [side.id, side]))

  const edges: CanvasEdge[] = bare.map((edge) => {
    // Only a template edge naming a node that does not exist misses here,
    // which is an authoring mistake. Fall back to the same horizontal pair
    // pickEdgeSides resolves a tie to, rather than leaving the handle
    // undefined — React Flow fails outright on an unknown handle id.
    const side = sides.get(edge.id)
    return {
      id: edge.id,
      type: "canvasEdge",
      source: edge.source,
      target: edge.target,
      sourceHandle: side?.sourceHandle ?? "right",
      targetHandle: side?.targetHandle ?? "left",
      data: edge.label ? { label: edge.label } : {},
    }
  })

  return { id, name, description, nodes, edges }
}

// Microservices — Gateway routes traffic to a set of services that all read
// and write from a shared datastore.
const microservicesNodes: NodeSpec[] = [
  { id: "ms-gateway",  label: "API Gateway", shape: "pill",      color: "blue",    x: 0,   y: 220 },
  { id: "ms-auth",     label: "Auth",        shape: "rectangle", color: "violet",  x: 260, y: 40 },
  { id: "ms-users",    label: "Users",       shape: "rectangle", color: "emerald", x: 260, y: 160 },
  { id: "ms-orders",   label: "Orders",      shape: "rectangle", color: "amber",   x: 260, y: 280 },
  { id: "ms-payments", label: "Payments",    shape: "rectangle", color: "rose",    x: 260, y: 400 },
  { id: "ms-db",       label: "PostgreSQL",  shape: "cylinder",  color: "cyan",    x: 540, y: 220 },
]

const microservicesEdges: EdgeSpec[] = [
  { source: "ms-gateway", target: "ms-auth" },
  { source: "ms-gateway", target: "ms-users" },
  { source: "ms-gateway", target: "ms-orders" },
  { source: "ms-gateway", target: "ms-payments" },
  { source: "ms-auth",     target: "ms-db" },
  { source: "ms-users",    target: "ms-db" },
  { source: "ms-orders",   target: "ms-db" },
  { source: "ms-payments", target: "ms-db" },
]

// CI/CD — linear pipeline from commit to production with a rollback branch
// off of production for failed deploys.
const cicdNodes: NodeSpec[] = [
  { id: "ci-commit",   label: "Commit",     shape: "circle",    color: "blue",    x: 0,    y: 120 },
  { id: "ci-build",    label: "Build",      shape: "rectangle", color: "default", x: 180,  y: 130 },
  { id: "ci-test",     label: "Test",       shape: "rectangle", color: "amber",   x: 380,  y: 130 },
  { id: "ci-staging",  label: "Staging",    shape: "pill",      color: "cyan",    x: 580,  y: 140 },
  { id: "ci-prod",     label: "Production", shape: "pill",      color: "emerald", x: 780,  y: 140 },
  { id: "ci-rollback", label: "Rollback",   shape: "diamond",   color: "rose",    x: 780,  y: 320 },
]

const cicdEdges: EdgeSpec[] = [
  { source: "ci-commit",  target: "ci-build",   label: "push" },
  { source: "ci-build",   target: "ci-test",    label: "artifact" },
  { source: "ci-test",    target: "ci-staging", label: "pass" },
  { source: "ci-staging", target: "ci-prod",    label: "promote" },
  { source: "ci-prod",    target: "ci-rollback", label: "on failure" },
]

// Event-driven — producer emits messages onto a broker; multiple consumers
// process independently, with a dead-letter queue for failed deliveries.
const eventDrivenNodes: NodeSpec[] = [
  { id: "ev-producer", label: "Producer",       shape: "rectangle", color: "blue",    x: 0,   y: 200 },
  { id: "ev-broker",   label: "Message Broker", shape: "cylinder",  color: "violet",  x: 260, y: 200 },
  { id: "ev-worker-a", label: "Worker A",       shape: "rectangle", color: "emerald", x: 520, y: 60 },
  { id: "ev-worker-b", label: "Worker B",       shape: "rectangle", color: "amber",   x: 520, y: 200 },
  { id: "ev-dlq",      label: "Dead Letters",   shape: "cylinder",  color: "rose",    x: 520, y: 360 },
]

const eventDrivenEdges: EdgeSpec[] = [
  { source: "ev-producer", target: "ev-broker",   label: "publish" },
  { source: "ev-broker",   target: "ev-worker-a", label: "topic.a" },
  { source: "ev-broker",   target: "ev-worker-b", label: "topic.b" },
  { source: "ev-broker",   target: "ev-dlq",      label: "unroutable" },
]

export const CANVAS_TEMPLATES: readonly CanvasTemplate[] = [
  makeTemplate(
    "microservices",
    "Microservices",
    "API gateway routing requests to a set of services backed by a shared database.",
    microservicesNodes,
    microservicesEdges,
  ),
  makeTemplate(
    "cicd",
    "CI/CD Pipeline",
    "Linear delivery pipeline from commit through staging to production with a rollback branch.",
    cicdNodes,
    cicdEdges,
  ),
  makeTemplate(
    "event-driven",
    "Event-Driven System",
    "Producer fans messages out through a broker to independent workers, with a dead-letter queue.",
    eventDrivenNodes,
    eventDrivenEdges,
  ),
] as const
