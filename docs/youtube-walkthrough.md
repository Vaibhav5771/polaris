# Polaris — YouTube Walkthrough Production Package

Portfolio showcase video. Target length: ~4:45–5:00. Audience: general (demo-first,
technical-second). All timings below are estimates from a natural VO read pace
(~140 wpm) — adjust the edit to the actual recorded VO length, not the other way around.

---

## 1. Shot list + script

Each beat is its own recording take — don't try to record this as one continuous pass.

### Beat 0 — Cold open (0:00–0:08) — NO VO, music only

**Visual:** AI Architect chat panel. Type: `design a CI/CD pipeline with a rollback step`.
Fast-cut to nodes snapping onto the canvas one by one. Hold ~1s on the finished diagram.
Cut to title card: **POLARIS** on near-black background (`oklch(0.10 0.003 260)`), with
a soft indigo-violet glow (`oklch(0.62 0.19 260)` — the app's own primary color).

**Music:** up full, no ducking yet.

### Beat 1 — Intro line (0:08–0:20)

**Visual:** Title card holds, then cuts to an empty/fresh canvas.

> **VO:** "This is Polaris — a canvas where you and your team design systems together…
> and one of your collaborators is an AI."

**Music:** ducks to ~15% under VO starting here.

### Beat 2 — Canvas fundamentals (0:20–1:15, ~55s)

**Visual:** Drag shapes from the floating shape panel (rectangle, cylinder, diamond,
hexagon). Resize one with the `NodeResizer` handles. Open the color-swatch toolbar on a
selected node, change its color. Draw an edge between two nodes, double-click it, add a
label.

> **VO:** "At its core, Polaris is a real-time diagramming canvas. Drop in rectangles,
> cylinders, diamonds, hexagons — drag them, resize them, recolor them with a click.
> Connect them with smart edges that label themselves. It feels like Figma, but built
> specifically for system architecture."

### Beat 3 — Real-time collaboration (1:15–2:15, ~60s)

**Visual:** Split-screen or picture-in-picture, two browser windows signed in as two
different Clerk accounts, same project open in both. Drag a node in window A, show it
move live in window B. Show both colored cursors with name badges moving independently,
and the stacked presence avatars in the corner.

> **VO:** "And it's never just you. Every cursor, every edit, every drag syncs instantly
> across everyone in the room. Open the same project on two machines and you'll see each
> other's cursors, avatars, and changes live — two people can edit the same canvas at
> once and nothing breaks."

### Beat 4 — AI Architect, full flow (2:15–3:15, ~60s)

**Visual:** This time show the *whole* panel, not just the fast-cut hook: the chat
input, the prompt being typed, the "Polaris is designing…" badge appearing, nodes
streaming in one at a time (not all at once), then edges connecting them.

> **VO:** "Now here's where it gets interesting. Type a prompt into the AI Architect —
> 'design a CI/CD pipeline with a rollback step' — and Polaris doesn't just describe it,
> it draws it. Node by node, edge by edge, live on the canvas, in front of everyone in
> the room. The AI isn't a chatbot bolted onto the side — it's writing to the exact same
> shared canvas a human would, so the moment it finishes, its diagram is just as
> editable as anything you drew yourself."

### Beat 5 — Spec generation + templates (3:15–3:50, ~35s)

**Visual:** Click "Generate Spec", show the loading state, cut to the finished spec
opening in the preview modal (rendered Markdown). Cut to the Templates modal, hover the
CI/CD template thumbnail — a nice callback to the opening hook.

> **VO:** "Once the diagram's done, one click turns the whole canvas — plus the
> conversation that built it — into a written technical spec. And if you'd rather start
> from something proven, starter templates for microservices, event-driven systems, and
> CI/CD pipelines are one click away."

### Beat 6 — How it's built (3:50–4:45, ~55s)

**Visual:** Pan and zoom across the "How Polaris Works" architecture diagram — built
*inside Polaris itself* ahead of time (see prep checklist) — with nodes for Next.js,
Clerk, Liveblocks, Trigger.dev, Prisma/Postgres, and Groq/Gemini.

> **VO:** "Under the hood, Polaris runs on Next.js and Postgres, with Liveblocks
> handling the real-time sync and Trigger.dev running the AI as a durable background
> agent — so a diagram still finishes generating even if you close the tab. The agent
> calls Groq or Gemini, gets back a schema-validated object, and streams it into the
> same conflict-free canvas every human edit goes through. I actually built this
> diagram — the one you're looking at right now — inside Polaris itself."

### Beat 7 — Close + CTA (4:45–5:00, ~15s)

**Visual:** Title card with three links: Live demo / GitHub / Portfolio. Logo.

> **VO:** "Polaris is live, open source, and built end to end — canvas, collaboration,
> and AI. Links to try it and the code are below."

**Music:** swells back up for the last few seconds, then fades out.

---

## 2. YouTube metadata

### Title (pick one)

1. **Polaris — A Real-Time Collaborative Canvas With an AI Architect (Full Demo)** *(recommended — clear, keyword-rich)*
2. I Built an AI That Designs System Diagrams Live — Polaris Demo
3. Figma for System Architecture, But the AI Draws It For You

### Description

```
Polaris is a real-time, multiplayer architecture-diagramming canvas — think Figma,
but for system design — with an AI Architect that can read a plain-English prompt
and draw the whole diagram onto the shared canvas, live, node by node, while your
team watches.

In this walkthrough:
→ The collaborative canvas (shapes, resize, color, smart edges)
→ Real-time multiplayer (live cursors, presence, shared editing)
→ The AI Architect generating a diagram from a prompt
→ One-click spec generation and starter templates
→ How it's actually built (Next.js, Liveblocks, Trigger.dev, Prisma, Groq/Gemini)

Try it: [live demo URL]
Code: https://github.com/Vaibhav5771/polaris
More of my work: [portfolio / LinkedIn URL]

0:00 Intro
0:20 Collaborative Canvas
1:15 Real-Time Collaboration
2:15 AI Architect — Prompt to Diagram
3:15 Specs & Templates
3:50 How It's Built
4:45 Try It
```

(Timestamps above assume the final edit matches the shot list — re-check them against
the actual rendered video before publishing; the first chapter must stay at `0:00`.)

### Tags

```
nextjs, react, liveblocks, ai agent, trigger.dev, system design tool,
collaborative canvas, ai diagram generator, react flow, groq, gemini,
clerk auth, prisma, full stack project, portfolio project,
software architecture tool, realtime collaboration
```

---

## 3. Thumbnail brief

- Near-black background matching the app's own theme (`oklch(0.10 0.003 260)`).
- Screenshot of the canvas mid-AI-generation — a few nodes placed, one streaming in
  with a visible connecting edge — using the app's real indigo-violet primary
  (`oklch(0.62 0.19 260)`) as the glow/accent color.
- Large, high-contrast text, 3–5 words max: e.g. **"AI DESIGNS WITH YOU"** or
  **"REAL-TIME + AI"**. Must be legible at phone-thumbnail size.
- Optional: one small colored cursor badge visible in a corner, to hint at the
  multiplayer angle without needing explanatory text.
- Polaris logo (`public/logo.png`) small, in a corner — not the focal point.

---

## 4. Prep checklist (before recording)

- [ ] **Verify the live deployment** works end-to-end for a signed-out stranger —
  test in a fresh incognito window: sign-up, create a project, canvas loads, AI
  Architect responds. Confirm production env vars are set (Clerk, Liveblocks,
  `DATABASE_URL`/Accelerate, Vercel Blob, `GEMINI_API_KEY`/Groq key).
- [ ] **Create a second Clerk test account** and add it as a collaborator on the demo
  project, for the two-window collaboration beat.
- [ ] **Build the "How Polaris Works" architecture diagram** inside a Polaris project
  ahead of time (Beat 6) — don't build it live on camera.
- [ ] **Dry-run the AI prompt 2–3 times before the real take.** Groq/Gemini output
  varies run to run, and Gemini's free tier is rate-limited (per
  `context/progress-tracker.md`: 15 RPM / 1,500 per day) — budget for retries and pick
  the cleanest result in editing.
- [ ] **OBS scene setup:** Window Capture scoped to the browser window only (not full
  desktop), 1920×1080 @ 60fps. A separate source/scene per collaboration window.
  Disable OS/app notifications before recording.
- [ ] **Clean browser chrome:** hide the bookmarks bar, close unrelated tabs, disable
  extensions that inject visible UI.
- [ ] **Never show secrets on screen** — no `.env.local`, no terminal output containing
  API keys or the Prisma Accelerate URL, no Vercel environment-variables dashboard.
- [ ] **Record VO separately**, quiet room, basic USB mic, measured pace, a beat of
  silence between sentences (easier to cut).
- [ ] **Pick royalty-free music** from the YouTube Audio Library (search "corporate
  tech" / "ambient minimal") before starting the edit.
- [ ] **Export at 1080p60 H.264**, YouTube-recommended bitrate (DaVinci Resolve has a
  built-in YouTube 1080p export preset).
- [ ] **Confirm the three CTA links** (live demo, GitHub, portfolio) actually work
  before publishing.
