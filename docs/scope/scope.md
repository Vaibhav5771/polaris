# Scope: Polaris

Polaris is a multiplayer architecture diagramming workspace where an AI design agent works alongside you: you describe a system in plain English and it draws the diagram onto a shared canvas while your teammates watch it happen. Built as a portfolio showcase piece rather than a commercial product.

**Build approach:** Tracer Bullet (vertical slices, each feature built end to end through every layer, working). This is how the existing 31 features were built, so new work keeps the same rhythm.
**Workflow:** Alpha (after `/develop`, run `/check verify` against the real running app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (for example `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

> Why Alpha: on 2026-10-03 a clean `tsc`, `eslint` and `next build` still shipped two runtime failures (a missing React context provider, and task runs going to a stale deployed environment). Neither was visible without running the real app. Alpha makes that run the default closing step.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Design system and theming | Shipped | existing |
| B | Authentication and access control | Shipped | existing |
| C | Project CRUD and editor home | Shipped | existing |
| D | Project sharing and collaborators | Shipped | existing |
| E | Realtime room foundation | Shipped | existing |
| F | Collaborative canvas | Shipped | existing |
| G | Shape and node editing toolkit | Shipped | existing |
| H | Edge behaviour and labels | Shipped | existing |
| I | Canvas ergonomics | Shipped | existing |
| J | Starter templates | Shipped | existing |
| K | Presence and live cursors | Shipped | existing |
| L | Canvas autosave and persistence | Shipped | existing |
| M | AI design agent | Shipped | existing |
| N | AI companion chat | Shipped | existing |
| O | Spec generation | Shipped | existing |
| P | Polaris rebrand and auth visuals | In flight | in-progress |
| 1 | Trigger environment and deploy story | Slice 1 | planned |
| 6 | Clear the AI chat thread | Slice 1 | in-progress |
| 7 | Diagram layout and readability | Slice 2 | in-progress |
| 2 | AI edits the existing canvas | Slice 3 | planned |
| 3 | Public landing page | Slice 4 | planned |
| 4 | Diagram export | Slice 5 | planned |
| 5 | Canvas comment threads | Slice 6 | planned |

## Already built

Enrolled for context so later slices can reference them. `existing` means it predates this workflow, so `/develop` and `/sync` leave these alone.

### A. Design system and theming · existing
shadcn/ui on Tailwind v4, dark only theme, CSS variable tokens, Geist and Sora fonts. code in `components/ui/`, `app/globals.css`

### B. Authentication and access control · existing
Clerk sign in and sign up, protected by default middleware, owner or invited collaborator checks resolved server side. code in `app/(auth)/`, `proxy.ts`, `lib/project-access.ts`

### C. Project CRUD and editor home · existing
Create, rename, delete and open projects, with the editor home and the project sidebar backed by a REST API over Prisma. code in `app/editor/`, `app/api/projects/`, `hooks/use-project-actions.ts`

### D. Project sharing and collaborators · existing
Share dialog with a copyable project link, invite by email, and owner only add and remove, enriched with Clerk profile data. code in `components/editor/share-dialog.tsx`, `app/api/projects/[projectId]/collaborators/`
Note: an invite records the email but sends no notification, so people have to be told another way. See Deferred.

### E. Realtime room foundation · existing
Liveblocks rooms keyed to a project, with server minted sessions carrying display name, avatar and a stable cursor colour. code in `liveblocks.config.ts`, `lib/liveblocks.ts`, `app/api/liveblocks-auth/`

### F. Collaborative canvas · existing
React Flow surface whose nodes and edges live in Liveblocks storage as a conflict free structure, so human and AI edits share one path. code in `components/editor/canvas/canvas-flow.tsx`, `canvas-wrapper.tsx`

### G. Shape and node editing toolkit · existing
Six node shapes drag dropped from a floating panel, in place label editing, resize handles and a seven colour swatch toolbar. code in `components/editor/canvas/canvas-node.tsx`, `shape-panel.tsx`, `shape-visual.tsx`, `node-color-toolbar.tsx`

### H. Edge behaviour and labels · existing
Right angle smooth step connectors with four handles per node and editable pill labels. code in `components/editor/canvas/canvas-edge.tsx`

### I. Canvas ergonomics · existing
Zoom, fit, undo and redo controls, keyboard shortcuts that stand down while you type, and a shape aware minimap. code in `components/editor/canvas/canvas-controls.tsx`, `hooks/use-keyboard-shortcuts.ts`, `minimap-shape.tsx`

### J. Starter templates · existing
Three ready made diagrams importable in one click, previewed as pure SVG thumbnails. code in `components/editor/starter-templates.ts`, `starter-templates-modal.tsx`

### K. Presence and live cursors · existing
Overlapping collaborator avatars and coloured live cursors with name badges, including a spinner while the AI works on someone's behalf. code in `components/editor/canvas/presence-avatars.tsx`, `live-cursors.tsx`

### L. Canvas autosave and persistence · existing
Debounced autosave of only the durable node and edge shape to blob storage, with a save status pill and hydration on open. code in `hooks/use-canvas-autosave.ts`, `app/api/projects/[projectId]/canvas/`

### M. AI design agent · existing
A durable background task turns a prompt into a schema validated diagram, streams it node by node into the room, and persists the result whether or not a browser is open. code in `trigger/design-agent.ts`, `app/api/ai/design/`

### N. AI companion chat · existing
The chat routes each message first: a greeting or a question gets a real conversational answer, only an actual design request draws. Each reply carries two to four follow up suggestion chips. Chat UI is built from AI SDK Elements. code in `trigger/design-agent.ts`, `components/editor/ai-sidebar/ai-architect-tab.tsx`, `components/ai-elements/`

### O. Spec generation · existing
Turns a finished diagram plus the chat history into a Markdown technical specification, stored per project and previewable or downloadable from the Specs tab. code in `trigger/generate-spec.ts`, `app/api/ai/spec/`, `components/editor/ai-sidebar/ai-specs-tab.tsx`

### P. Polaris rebrand and auth visuals · in-progress
The rename to Polaris plus the new logo and an animated beams background on the auth screen. Uncommitted in the working tree. code in `app/(auth)/`, `components/auth/beams-background.tsx`, `public/logo.png`
- [ ] Finish and commit the rebrand pass: `/develop polaris rebrand and auth visuals`

## Slice 1: Make the current build trustworthy

Two small pieces of work, both surfaced by real testing on 2026-10-03, that stop you chasing ghosts while you demo.

### 1. Trigger environment and deploy story
Make it obvious and reliable which copy of a background task a run actually executes. A commented out dev key meant the app silently ran a stale deployed task, so a fix that was correct in the repo never ran, and the symptom looked like a broken feature.
**Done when:** local runs provably execute local task code, the deployed copy is current before a demo, and the choice between the two is documented where you will see it.
- [ ] Build it: `/develop trigger environment and deploy story`

### 6. Clear the AI chat thread · in-progress
The chat feed keeps every message forever and there is no way to reset it. Old replies sitting above new ones made a fixed behaviour look broken, and a stale transcript is the wrong first impression in a demo.
**Done when:** a collaborator can clear the thread for the room, every participant sees it empty, and the reset survives a reload.
code in `components/editor/ai-sidebar/ai-sidebar.tsx`, `components/editor/canvas/canvas-flow.tsx`, `components/editor/workspace-shell.tsx`
- [x] Build it: `/develop clear the AI chat thread`

## Slice 2: Diagram layout and readability

### 7. Diagram layout and readability · in-progress
Big diagrams come out tangled. The agent picks node coordinates itself with no layout pass, and every AI edge leaves a node's right side and enters the next one's left, so connectors wrap around the canvas, cross each other and run underneath nodes. Also covers a control that re arranges a canvas you already have, including nodes you placed by hand.
**Done when:** a diagram of roughly twenty nodes lands with no connector crossing a node between adjacent layers, connectors leave and enter the sides that actually face each other, and a re arrange control tidies an existing canvas live for every collaborator in one undoable step. Two visual residuals are accepted knowingly and recorded in the spec: a connector spanning three or more layers can still clip a node, and several connectors leaving a node on the same side share one connection point.
spec [0001](../specs/0001-engine-computed-diagram-layout.md) · code in `lib/canvas-layout.ts`, `trigger/design-agent.ts`, `components/editor/canvas/canvas-flow.tsx`, `canvas-controls.tsx`, `shape-panel.tsx`, `components/editor/starter-templates.ts`, `types/canvas.ts`
- [x] Design it (spec): `/architect diagram layout and readability`
- [x] Build it: `/develop diagram layout and readability`
  - [x] Shared layout module and the broadcast protocol it needs: `lib/canvas-layout.ts` exporting `pickEdgeSides` and `layoutCanvas`, plus connector side fields on the `addEdge` action — AC-2, AC-7, AC-12
  - [x] The AI draws tidy end to end, including with no browser open — AC-1, AC-5, AC-12
  - [x] Tidy layout control, and the whole canvas laid out again when the AI adds to it — AC-3, AC-4, AC-6, AC-8
  - [x] Drag side recompute, loose node parking, one shared shape size table — AC-9, AC-10, AC-11
- [ ] Verify it: `/check verify diagram layout and readability`

## Slice 3: AI edits the existing canvas

### 2. AI edits the existing canvas · needs a decision
Right now the agent can only add nodes and edges, which its own prompt admits. Follow ups like "make that node amber", "move the cache next to the database" or "remove the staging step" have nowhere to go.
**Done when:** a follow up request can restyle, move, relabel or delete an existing node or edge, the change syncs live to every collaborator, and the saved canvas matches what is on screen.
- [ ] Design it (spec): `/architect ai edits the existing canvas`

## Slice 4: Public landing page

### 3. Public landing page · needs a decision
There is no public page: the root redirects straight to sign in or the editor. The walkthrough video in `docs/youtube-walkthrough.md` needs somewhere to send viewers.
**Done when:** a signed out visitor lands on a page that explains Polaris, shows the product in motion, and offers a clear way in, with page metadata and social cards present.
- [ ] Design it (spec): `/architect public landing page`

## Slice 5: Diagram export

### 4. Diagram export · needs a decision
A finished diagram cannot leave the canvas today, which is awkward for a tool whose output is a picture people want to paste elsewhere.
**Done when:** a user can export the current canvas as an image or document, the export matches what is on screen including colours and labels, and very large diagrams still come out readable.
- [ ] Design it (spec): `/architect diagram export`

## Slice 6: Canvas comment threads

### 5. Canvas comment threads · needs a decision
Collaborators can draw together but cannot leave feedback. The realtime library already installed ships a comments feature that is not wired up anywhere.
**Done when:** a collaborator can start a thread pinned to a node or a point on the canvas, others see and reply to it live, and resolved threads get out of the way.
- [ ] Design it (spec): `/architect canvas comment threads`

## Deferred

Out of scope for the current pass, kept so the plan stays honest.

- **Invite notification emails**: an invited collaborator is recorded but never told · needs a decision
- **Product analytics and error monitoring**: measure demo traffic and catch runtime failures in the wild · needs a decision
- **Billing and plans**: not relevant while this is a portfolio piece
- **Multi tenant organisations**: sharing is per project by email today, which is enough
- **Accessibility audit and internationalisation**: no signal yet that either is needed
- **Automated test suite**: there are no tests at all today. Alpha leans on running the real app instead, which is a fair trade for a portfolio piece, but it is a known gap · needs a decision
- **Attachments in the AI chat**: the composer UI was built and then removed on 2026-10-03; revisit only with a real use for the files
- **Starter template layout**: templates keep hand authored positions and hardcoded connector sides, so an import is not laid out automatically and relies on the tidy button · from spec 0001
- **Connector attachment quality**: several connectors leaving a node on the same side share one connection point, because each side has exactly one. Routes out are more points per side, or an attachment point computed from geometry · from spec 0001
- **Unfilled context files**: `context/architecture.md` and `context/ui-context.md` are still blank templates, yet `AGENTS.md` sends every skill to them as the source of truth for stack and theme, so they mislead rather than inform · from spec 0001

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box.

**Feature lifecycle**: each state and who sets it.

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` at spec capture | `Design it` ticked, spec linked, `Build it` plus two to five milestones, then `Verify it` |
| `in-progress` (building) | `/develop` | milestone boxes tick one by one, code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` and milestones ticked, `Verify it` ticked |
| `done` | you, when you decide it is | at Alpha, `/check verify` passing is the suggested point to call it done |

- **Next step** is the first unticked box, always a command or a tracked milestone.
- **needs a decision** means run `/architect` first, otherwise go straight to `/develop`. The tag drops once the spec is captured.
- Atomic build tasks live in the spec's `## Build plan`, not here. The scope carries only the milestone rollup.
- **Status**: `planned`, `in-progress`, `done`, plus `existing` (predates this workflow) and `dropped` (de scoped, kept for history).
- A tag beside a heading overrides the project default for that one feature, for either build approach or workflow tier. No tag means it inherits.
- **Pointer line** (`spec <n> · code in <path>`): the spec link is added by `/architect`, the code path by `/develop`.
