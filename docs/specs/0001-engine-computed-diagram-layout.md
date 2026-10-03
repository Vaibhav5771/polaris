# 0001. Engine computed layout for diagram nodes and connectors

**Date**: 2026-10-03
**Status**: In Progress

## Summary

Polaris currently asks the language model to pick x and y for every node it draws, following written rules in a prompt, and then joins every pair of nodes right side to left side regardless of where they actually sit. The result is tangled on anything past a handful of nodes. This decision moves placement out of the model and into a real graph layout engine (software that arranges a network of boxes and arrows so it reads cleanly), held in one shared function that both the background task and the browser call. It also adds a tidy layout button so any canvas, including one you drew by hand, can be straightened out live for everyone in the room.

## Context

The diagram agent produces node coordinates by following prose instructions in `DIAGRAM_SYSTEM_PROMPT` ([trigger/design-agent.ts:73-83](../../trigger/design-agent.ts#L73-L83)): start at x=100, 220 pixels between centres, 180 pixel rows, group related nodes on a row. There is no layout step anywhere in the system. The model is being asked to solve a geometric packing and crossing problem in its head while also choosing shapes, colours and labels, and it is reliably bad at the geometry part. The rules are already detailed, so the obvious lever has been pulled.

Separately, every connector the agent creates is pinned to `sourceHandle: "right"` and `targetHandle: "left"`. That pairing is hardcoded in three places that have to stay in step: the task's persistence path ([trigger/design-agent.ts:335-336](../../trigger/design-agent.ts#L335-L336)), the live broadcast path in the browser ([components/editor/canvas/canvas-flow.tsx:194-195](../../components/editor/canvas/canvas-flow.tsx#L194-L195)), and the starter templates ([components/editor/starter-templates.ts:68-69](../../components/editor/starter-templates.ts#L68-L69)). Nodes already carry four connection points, top, right, bottom and left ([components/editor/canvas/canvas-node.tsx:44-49](../../components/editor/canvas/canvas-node.tsx#L44-L49)), so the sides exist and are simply never chosen. A node sitting above another still gets a connector that exits rightward, loops around and comes back in from the left.

Three constraints shape what can be done about it. First, the task persists the canvas to blob storage whether or not a browser is open ([trigger/design-agent.ts:345-353](../../trigger/design-agent.ts#L345-L353)), so placement has to be correct without a client involved. Second, this is a multiplayer canvas: every position is a Liveblocks storage value that syncs to collaborators and participates in shared undo, so a layout is a collaborative write, not a local redraw. Third, the project has no automated tests at all and runs at the Alpha tier, meaning correctness is established by driving the real app, so a deterministic and inspectable layout is worth more here than a clever one.

There is also a pre existing inconsistency this work walks into. The task and the starter template file keep separate default shape size tables that disagree on three of six shapes: diamond is 120 by 80 in one and 140 by 140 in the other, cylinder 120 by 100 against 140 by 90, hexagon 120 by 100 against 130 by 110. A layout engine is told how big each box is, so sizes stop being cosmetic.

Not deciding means the headline feature of a portfolio piece, an AI that draws your architecture while your team watches, produces something that looks worse the more it draws. The failure is most visible exactly when the product is being demonstrated.

> ⚠️ Premise note: the scope row promises "no connector crossing a node", and the approach chosen here cannot fully guarantee that. Two residuals are accepted knowingly.
>
> First, a layered layout plus correctly chosen connector sides removes the overwhelming majority of crossings, and the engine does reserve clear corridors for connectors spanning several columns, but the renderer draws a smooth step path rather than following those corridors, so a long connector whose corridor bends can still clip a node. Guaranteeing the criterion outright needs engine routed connector paths, weighed as Option 3 and declined on cost.
>
> Second, each node renders exactly one connection point per side ([components/editor/canvas/canvas-node.tsx:44-49](../../components/editor/canvas/canvas-node.tsx#L44-L49)). A hub node fanning out to several nodes on the same side gives every one of those connectors the same side, so they all leave from the identical pixel and overlap until they diverge. This is most visible on exactly the kind of twenty node diagram this feature exists to improve. Removing it needs either several connection points per side or an attachment point computed from geometry rather than quantised to four handles; both were weighed after the first draft and declined to keep this feature finishable and the edge component untouched.
>
> AC-12 is written to the achievable promise rather than the scope's wording, and both residuals are recorded as known rather than treated as build failures. The scope row's "done when" text is worth softening to match.

## Requirements

**User stories**:
- As someone describing a system to Polaris, I want the diagram it draws to be readable without me rearranging it, so that the output is usable straight away.
- As someone who has been drawing on a canvas by hand, I want one control that straightens the whole thing out, so that I can tidy up before sharing or presenting.
- As a collaborator watching someone else work, I want layout changes to appear on my screen as they happen, so that we are always looking at the same diagram.

**Acceptance criteria**:
- **AC-1**: A fresh AI diagram of roughly twenty nodes lands with no two nodes overlapping, arranged in left to right layers, every node visible after a fit view.
- **AC-2**: Every connector leaves and enters the faces that point at each other, chosen from the two nodes' relative positions. The fixed right to left pairing is gone from all three places that currently hardcode it.
- **AC-3**: A tidy layout control in the canvas control bar lays out the current canvas, whatever produced it: an AI diagram, an imported starter template, or shapes placed by hand.
- **AC-4**: When the AI adds to a canvas that already has nodes, old and new are laid out together as one graph, and existing nodes move to their new positions.
- **AC-5**: A diagram produced with no browser open is persisted with laid out positions and correct connector sides, so opening the project later shows the tidy version rather than a tidy overlay on stale coordinates.
- **AC-6**: A layout is one undo step. A single undo returns every node to where it was before.
- **AC-7**: Every position and connector side a layout writes reaches all collaborators live, with no reload.
- **AC-8**: The tidy layout control is disabled while Polaris is drawing, and when the canvas has no nodes.
- **AC-9**: After a node is dragged, the connectors touching it repick their facing sides, and one undo reverses both the move and the side change together.
- **AC-10**: Nodes with no connections are placed in a row below the laid out graph rather than left sitting on top of it.
- **AC-11**: The background task and the starter templates read default shape sizes from one shared table, and the current divergence is gone.
- **AC-12**: In a fresh twenty node diagram, no connector between nodes in adjacent layers passes over a node. Connectors spanning three or more layers, and connectors stacking on a shared connection point, are checked by eye and recorded as known residual rather than treated as build failures. See the premise note.

## Options considered

### Option 1: Keep the model in charge, improve the prompt

Rewrite the layout rules in `DIAGRAM_SYSTEM_PROMPT` with tighter constraints, worked examples and an explicit instruction to avoid overlaps, and keep x and y in the schema.

**Pros**:
- No new dependency, no new code paths, deployable in minutes.
- Nothing about the broadcast protocol, persistence or the canvas changes.

**Cons**:
- The prompt already carries detailed, specific rules and still produces tangle, so the cheap lever is spent.
- Placement quality becomes non deterministic: the same prompt gives a different layout each run, which is hostile to both demos and debugging.
- Does nothing for a canvas the model did not draw, so an imported template or a hand drawn diagram has no path to tidy.
- Does not address connector sides at all, which is half of the visible mess.

### Option 2: Shared layout function using dagre, positions and connector sides only

One pure function in `lib/canvas-layout.ts` running `@dagrejs/dagre`, a layered graph layout. It takes nodes and edges, returns a position per node and a facing side pair per connector. The background task calls it before broadcasting; the browser calls the identical function for the tidy layout button. Connector paths keep today's smooth step rendering.

**Pros**:
- Placement becomes deterministic and testable, and the same input produces the same output in both runtimes.
- One function owns both position and connector sides, so the two can never disagree.
- Synchronous and small, which is what makes a single shared module viable across a Node task and a browser button.
- The layered shape matches how architecture diagrams are actually read, and a layered layout inherently reserves space for long connectors.
- Nothing about the stored canvas changes, so no migration and no story for existing rooms.

**Cons**:
- Does not fully guarantee the no crossing criterion for connectors spanning several layers, as the premise note records.
- Adds a dependency to both the client bundle and the task.
- The maintained package is a community fork of an abandoned original, which is a small but real supply risk.
- The model loses all positional expression, so it can no longer hint at grouping through placement.

### Option 3: elkjs with engine routed connector paths

Use the Eclipse Layout Kernel, store the bend points it computes for each connector, and render those paths in the edge component.

**Pros**:
- Genuinely satisfies the no crossing criterion, because the engine routes connectors around nodes rather than through them.
- Supports port and side constraints directly, and handles nested grouping if the product ever wants containers.

**Cons**:
- Asynchronous and around a megabyte, usually wanting a web worker, which makes the single shared synchronous module impossible and complicates the task runtime too.
- Stored bend points go stale the moment anyone drags a node, so the paths are wrong until the next layout, which is a worse failure than the one being fixed.
- Requires rewriting `canvas-edge.tsx`, including how labels find their midpoint, which is currently derived from `getSmoothStepPath` and is carefully tuned.
- Heavier than the problem warrants for a canvas that draws twenty nodes.

### Option 4: Floating connectors, no layout engine

Drop stored connection sides entirely and compute each connector's attachment point from node geometry on every render, the way React Flow's floating edges example does. Leave positions as the model produces them.

**Pros**:
- Very small, no dependency, and connector attachment is correct forever with no storage writes and nothing to go stale.
- Survives any drag by construction.

**Cons**:
- Fixes the symptom and not the cause: the tangle comes from where nodes are, and this moves no nodes.
- Changes the look of every connector and how manual connecting behaves, which touches a part of the product that currently works well.
- Leaves the tidy layout button with nothing to call.

## Decision

**Chosen option**: Option 2: shared layout function using dagre, positions and connector sides only.

Placement and connector side selection move out of the language model and out of three hardcoded sites into a single pure function that the Trigger task and the browser both call, with the model reduced to choosing what the diagram contains rather than where it goes.

**Implementation skills**: `liveblocks-best-practices` (`.agents/skills/liveblocks-best-practices/`) for the storage mutation, history and realtime sync conventions this feature writes through · `trigger-authoring-tasks` (`.agents/skills/trigger-authoring-tasks/`) for the task side changes to `designAgentTask`

## Rationale

The decisive force is the headless persistence path. The task writes the canvas to blob storage whether or not a browser is connected, so placement has to be correct inside a Node process with no React and no measured DOM. That rules out anything that only works in the client, and it puts a hard premium on the layout being synchronous, which is precisely where dagre separates from elkjs. A synchronous pure function is what makes one shared implementation possible across both runtimes, and one shared implementation is what stops the task and the browser from drifting the way the three hardcoded connector sites already have.

The second force is that this is a multiplayer canvas with shared undo. Every position is a Liveblocks value, so a layout is a write that other people see and that must be reversible in one step. That pushed the design towards writing plain positions, which the existing storage already holds, rather than introducing stored bend points that would be a new field, a new staleness problem, and a new thing for undo to get wrong. It is also why the whole canvas layout is acceptable as the answer to hand placement: undo is a real safety net here, not a theoretical one.

The third force is the Alpha tier with no automated tests. Correctness on this feature will be established by a person looking at the screen. A deterministic layout that produces the same picture every run is worth considerably more in that setting than a cleverer one that does not, because it makes a regression visible rather than plausible. The same reasoning is why the no crossing criterion was written down honestly rather than claimed: an acceptance criterion that cannot be checked is worse than one that admits its limit.

The cost consciously accepted is that an AI addition now reshuffles nodes you placed yourself. That follows directly from laying out old and new together, which is the only version where an addition produces one coherent diagram instead of two tidy islands. Undo covers it, and the alternative was asking arithmetic to place a new subgraph clear of an old one, which is the class of problem that caused this spec.

## Feature design

**Data model sketch**: no schema change, in Prisma or in Liveblocks storage. Every value this feature writes is a field that already exists.

| Where | Field | Role here |
|---|---|---|
| Node | `position` | written by layout |
| Node | `width`, `height` | read by layout as the node's box; already set by every creation path |
| Edge | `sourceHandle`, `targetHandle` | standard React Flow fields, already persisted ([hooks/use-canvas-autosave.ts:37-38](../../hooks/use-canvas-autosave.ts#L37-L38)); now computed rather than hardcoded |
| Node | hand placed or pinned flag | deliberately not added; layout moves everything and undo restores |
| Room | layout direction | deliberately not added; fixed left to right |
| Edge | bend points | deliberately not added; positions only |
| Edge | origin marker | deliberately not added; one side rule for every connector |
| Room | layout lock | deliberately not added; layout is deterministic |

Two things do change in `types/canvas.ts`, both protocol changes rather than storage changes. The `CanvasAction` union in [types/canvas.ts:52-59](../../types/canvas.ts#L52-L59) is the shape of the `ai:action` room event declared in [liveblocks.config.ts:38](../../liveblocks.config.ts#L38), imported by both the task and the browser.

```ts
// new variant, carries an existing node's new position and a connector's new sides
| { type: "applyLayout"
    nodes: Array<{ id: string; x: number; y: number }>
    edges: Array<{ id: string; sourceHandle: string; targetHandle: string }> }

// existing variant, gains two fields
| { type: "addEdge"; id: string; source: string; target: string; label?: string
    sourceHandle: string; targetHandle: string }
```

The `addEdge` change is easy to miss and blocks the build without it. A newly drawn connector reaches the browser as an `addEdge` action, and that action currently carries no side information, which is precisely why `handleAiAction` hardcodes `"right"` and `"left"` at [components/editor/canvas/canvas-flow.tsx:194-195](../../components/editor/canvas/canvas-flow.tsx#L194-L195). Without the two new fields the computed sides reach the saved blob but never reach a browser that is watching the diagram being drawn.

**Interface surface**: no new HTTP endpoints. `app/api/ai/design/route.ts` is unchanged; it already forwards the full node and edge objects to the task ([app/api/ai/design/route.ts:44-50](../../app/api/ai/design/route.ts#L44-L50)) and the task's `.passthrough()` schemas preserve positions and sizes, so a whole canvas layout server side needs no new plumbing.

`lib/canvas-layout.ts` exports **two** functions, not one. They are separate because they are called in different situations and conflating them is a trap: a drag must repick connector sides without moving anything, and an engineer reaching for a single combined function would silently re-run the whole layout on every drag.

| Surface | Caller | Inputs | Outputs | Auth | Key failures |
|---|---|---|---|---|---|
| `pickEdgeSides(nodes, edges)` | drag end, and `layoutCanvas` internally | nodes with the positions they already have, edge source and target pairs | a facing side pair per edge, and nothing else; never calls dagre, never returns a position | none, pure function | a self referencing edge is skipped and keeps whatever sides it has |
| `layoutCanvas(nodes, edges)` | the Trigger task, and the tidy layout button | node ids with box sizes, edge source and target pairs | a position per node, plus the sides from `pickEdgeSides` applied to those new positions | none, pure function | empty input returns empty; a cycle is handled by dagre's own acyclic pass |
| `applyLayout` room event | the task, broadcast | the positions and sides above | none | existing room membership | an older client ignores an unknown action type, degrading to new nodes laid out and old ones unmoved |
| tidy layout mutation | the browser button and drag end | positions and sides, or sides alone on a drag | storage writes | existing room membership | none beyond a normal storage write |

**Value sourcing**:

| Action | Value produced | Source |
|---|---|---|
| `layoutCanvas` | each node's x and y | computed by dagre from the edge graph plus each node's box |
| `layoutCanvas` | each node's box | the node's stored `width` and `height`, which every creation path sets; falls back to the shared shape size table in `types/canvas.ts` when absent |
| `pickEdgeSides` | each edge's `sourceHandle` and `targetHandle` | derived from the two node centres as given: the dominant axis of the delta between them, a tie resolving to horizontal. Called by `layoutCanvas` against new positions, and by drag end against existing ones |
| `layoutCanvas` | rank and node separation, margins | constants in `lib/canvas-layout.ts`; recommended `ranksep` 140, `nodesep` 80, margins 40, which widens on today's effective gaps |
| `layoutCanvas` | layout direction | a fixed constant, `rankdir: "LR"` |
| `layoutCanvas` | position of unconnected nodes | a post pass, fully specified so it is deterministic in both runtimes: a row left aligned to the laid out graph's left edge, starting one `ranksep` below its lowest point, nodes spaced by `nodesep`, wrapping to a further row one `nodesep` lower once the row would exceed the graph's width |
| AI draw | the node and edge graph | the model's `diagramSchema` output, now without `x` and `y` |
| AI draw | existing nodes and edges to lay out alongside the new ones | the task input, already sent verbatim by the API route |
| AI draw | the persisted canvas | laid out positions for both old and new nodes, replacing today's concat of stale old positions with new ones |
| tidy layout | the graph to lay out | the live `nodes` and `edges` from `useLiveblocksFlow` |
| tidy layout | whether the control is enabled | `aiStatus.drawing` from storage, already read in `canvas-flow.tsx:77`, plus a non empty node list |
| tidy layout | who sees the viewport move | local only, `fitView` from `useReactFlow`, never broadcast |
| drag end | which connectors to reside | the edges whose `source` or `target` is the dragged node id |
| drag end | undo grouping | Liveblocks `useHistory().pause()` on drag start, `resume()` after the side write |

**Key invariants**:
1. `pickEdgeSides` is the only code that decides a connector's sides. No other code writes a `sourceHandle` or `targetHandle`, and all three current hardcoded sites are removed rather than left as fallbacks.
2. Only `layoutCanvas` moves nodes. A drag calls `pickEdgeSides` alone and must never reposition anything.
3. `lib/canvas-layout.ts` imports nothing from React, Liveblocks or React Flow's runtime, so the Trigger task and the browser call it unchanged.
4. Layout is deterministic: the same nodes and edges produce the same positions in either runtime. This covers disconnected clusters too, which dagre lays out in the same pass; AC-1's no overlap criterion applies to them. If verification shows two clusters overlapping, the route is the connected components pass weighed and declined during design, not a tweak to the separation constants.
5. The task's blob write always reflects the laid out canvas, never laid out new nodes beside stale old positions.
6. A layout is a single undo step. The design assumes a single Liveblocks mutation produces a single history entry, which is unconfirmed and listed in Follow-up. If it does not hold, the fallback is to wrap the write in `useHistory().pause()` and `resume()`, the same grouping build task 5 uses for drag end, which needs grouping regardless because the move and the side write are two separate mutations.

**Security model**: unchanged. A layout is a canvas edit like any other, governed by the existing room membership check in `app/api/liveblocks-auth/` and `lib/project-access.ts`. Anyone who can move a node can lay out the canvas. No per node ownership exists today and none is introduced. No new data is read or written beyond what the canvas already holds, so no personal data and no compliance scope is touched.

**Configuration required**: none. No new environment variables, no new credentials.

**Critical test scenarios**: there is no automated test suite, so these are `/check verify` steps driven against the running app.
- Happy path: ask for a system with roughly twenty components on an empty canvas, watch it stream in, confirm no overlaps and that connectors enter facing sides. Include a hub node with three or more connections on one side, and record how bad the shared connection point looks. Verifies **AC-1**, **AC-2**, **AC-12**.
- Disconnected clusters: ask for a system that includes a part with no link to the rest, confirm the two clusters do not overlap. Verifies **AC-1**.
- Headless path: trigger a diagram, close the browser before it finishes, reopen the project, confirm the saved canvas is the laid out one. Verifies **AC-5**.
- Addition path: draw a diagram, then ask for an addition, confirm old and new settle as one coherent graph. Verifies **AC-4**.
- Multiplayer: two browsers in one room, press tidy layout in one, confirm the other sees nodes move without reloading and that its viewport is not yanked. Verifies **AC-7**.
- Undo: tidy a canvas, press undo once, confirm every node returns. Then drag a node, press undo once, confirm the move and the connector side change both revert. Verifies **AC-6**, **AC-9**.
- Disabled states: press tidy layout on an empty canvas and while Polaris is drawing. Verifies **AC-8**.
- Loose nodes: drop three unconnected shapes on top of a diagram, tidy, confirm they land in a row below it. Verifies **AC-10**.

## Build plan

Ordered as Tracer Bullet, the project's recorded approach: the first two tasks are a thin thread all the way through the layers, from the pure function to a tidy diagram on screen, and later tasks thicken it.

1. Add `@dagrejs/dagre`. Create `lib/canvas-layout.ts` with two pure exports and no React or Liveblocks imports: `pickEdgeSides(nodes, edges)`, which returns only a facing side pair per connector from the positions it is given, and `layoutCanvas(nodes, edges)`, which positions nodes left to right with dagre and then calls `pickEdgeSides` against those new positions. Connected graph only at this stage. Satisfies **AC-2**, **AC-12**.
2. Add `sourceHandle` and `targetHandle` to the `addEdge` variant of `CanvasAction` in `types/canvas.ts`, and set them from the computed pair in `handleAiAction` ([components/editor/canvas/canvas-flow.tsx:188-198](../../components/editor/canvas/canvas-flow.tsx#L188-L198)) instead of the hardcoded strings. Without this a watching browser never receives the computed sides. Satisfies **AC-2**, **AC-7**.
3. Call `layoutCanvas` from `trigger/design-agent.ts` for a fresh diagram: drop `x` and `y` from `diagramSchema`, remove the coordinate rules from `DIAGRAM_SYSTEM_PROMPT`, raise the node cap to roughly twenty, lay out before broadcasting so nodes still stream in one at a time at their final positions, and send the computed sides in both the broadcast and the blob write. First working thread, end to end. Satisfies **AC-1**, **AC-2**, **AC-5**, **AC-12**.
4. Add the tidy layout control to `components/editor/canvas/canvas-controls.tsx`, calling `layoutCanvas` from the browser and writing every position and side in one Liveblocks mutation. Disable it while `aiStatus.drawing` is true and when the canvas is empty. Fit the view locally for whoever pressed it. Confirm here that one undo reverses the whole layout, and fall back to history pause and resume if it does not. Satisfies **AC-3**, **AC-6**, **AC-7**, **AC-8**.
5. Extend the AI path to the whole canvas: add the `applyLayout` variant to `CanvasAction`, handle it in `applyAiStorageMutation`, broadcast it for existing nodes before streaming the new ones so the canvas makes room first, and make the blob write persist laid out positions for existing nodes instead of concatenating their old ones. Satisfies **AC-4**, **AC-5**.
6. On drag end, call `pickEdgeSides` for the connectors touching the moved node and write only their sides, never positions. Group it with the move into one history entry using `useHistory().pause()` on drag start and `resume()` after the write. Only the client that performed the drag writes; other clients receive the change through storage. Satisfies **AC-9**, **AC-7**.
7. Add the post pass that parks unconnected nodes below the laid out graph, to the anchor, gap and wrap rule in the value sourcing table. Satisfies **AC-10**.
8. Move the default shape sizes into one shared table in `types/canvas.ts` beside the colour palette, import it in `trigger/design-agent.ts` and `components/editor/starter-templates.ts`, and delete both local copies. All three diverging shapes resolve to one value. Satisfies **AC-11**.

## Consequences

**Positive**:
- Diagram quality stops depending on the model's spatial reasoning, which is the part it is worst at, and the same prompt now yields the same picture every time.
- One function owns position and connector sides together, replacing three hardcoded sites that could drift apart.
- Every canvas gains a tidy path, including ones the AI never touched, which was previously impossible.
- Removing coordinates from the schema and the prompt makes each generation cheaper and the prompt shorter and more honest about what matters.
- No migration, no storage version bump, and nothing to do for rooms that already exist.

**Negative / tradeoffs**:
- Asking the AI to add to your canvas now moves nodes you placed yourself. Undo covers it, but it will surprise people the first time.
- The model can no longer express grouping through placement, so related nodes are grouped only by colour and shape. If grouping matters later, it needs to become explicit data rather than a coordinate hint.
- A new dependency lands in both the browser bundle and the task runtime, and the maintained package is a community fork of an abandoned original.
- A drag now costs a storage write beyond the move itself, which every collaborator receives.
- Long connectors can still clip a node, as AC-12 records. The product promise is softened rather than met outright.
- Several connectors leaving a node on the same side all leave from the same pixel, because there is one connection point per side. On a hub node this is plainly visible, and it is accepted knowingly rather than solved. See the premise note for the two routes out of it if it proves too ugly in practice.

**Neutral**:
- The `CanvasAction` union becomes a versioned protocol between two independently deployed surfaces, which raises the stakes on the deploy story that scope feature 1 covers.
- Layout constants (separation, margins) become a tuning surface someone will want to adjust by eye.
- The pure deterministic layout function is by some distance the cheapest thing in this codebase to unit test, if the testing gap is ever closed.

## Migration plan

**Strategy**: no data migration, but a coordinated deploy across two surfaces.

**Phases**:
1. Deploy the Next.js app carrying both `CanvasAction` changes and the client side handling. A new client against an old task is safe in both directions: the task never sends `applyLayout`, and the client treats a missing `sourceHandle` or `targetHandle` on an `addEdge` action as the old `"right"` and `"left"` pair. Behaviour is exactly as today, plus a tidy layout button that works on its own.
2. Deploy the Trigger task. Only now does the AI path emit laid out positions, computed connector sides and `applyLayout`.

**Rollback**: revert the task deploy first, then the app. Existing canvases are untouched by either, because nothing rewrites stored data on deploy; a canvas laid out before the rollback simply keeps the positions it was given, which remain valid.

**Risks**:
- The fallback in phase 1 is load bearing, not defensive padding. A new client must not create an edge with an undefined `sourceHandle`, because React Flow fails handle lookup on an unknown handle id. Build this fallback in task 2, not later.
- Deploying the task before the app means an older client receives an unknown `applyLayout` action. The switch in `applyAiStorageMutation` has no default branch, so it is silently ignored: new nodes land laid out, existing ones do not move. Degraded rather than broken, but worth avoiding by keeping the order above.
- The project has recently shipped a bug caused by local runs hitting a stale deployed task, which is the subject of scope feature 1. This feature's two surface protocol change makes that failure mode more confusing, not less. Confirming which copy of the task is running before verifying is worth doing first.

## Follow-up

- [ ] Soften the scope row's "done when" wording for feature 7 so it matches AC-12 rather than promising no connector crossing a node outright.
- [ ] Confirm during build task 4 that a single Liveblocks `useMutation` is one undo entry. The design assumes it, and the whole hand placement answer rests on undo behaving well. Invariant 6 names the fallback if it does not hold.
- [ ] Revisit the shared connection point if it looks as bad in practice as it reads on paper. The two routes are several connection points per side, or an attachment point computed from node geometry instead of quantised to four handles. The second would also let AC-12 be promised outright, and it composes with this layout engine rather than replacing it; it was declined here on the cost of rewriting `canvas-edge.tsx` including label positioning.
- [ ] Decide what a starter template import should do. Templates keep hand authored positions and hardcoded connector sides, so an import is not laid out automatically and relies on the button. Either re author them with computed sides or lay them out on import.
- [ ] Scope feature 2, the AI editing an existing canvas, will want the same `applyLayout` action and should be designed against this protocol rather than inventing another.
- [ ] `context/architecture.md` and `context/ui-context.md` are still unfilled templates, yet `AGENTS.md` directs every skill to read them first as the source of truth for stack and theme. They currently mislead rather than inform. Worth filling or removing the pointer.
- [ ] No automated tests exist anywhere in the project, which the scope already records as a known gap. `layoutCanvas` is pure and deterministic and would be the natural first test if that changes.
