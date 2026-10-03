# Action Graph Pilot — Testing Log

Use this file as a live working document while running the 7-day pilot.
Update it after every test run. Commit it with your results.

---

## ⚠️ Baseline v1 Caveat (Read Before Interpreting Results Below)

The first baseline run (2026-07-23) used **Groq `openai/gpt-oss-120b`** with **accessibility-tree only** (no screenshots) and a **20-step MAX budget**. This is NOT representative of production computer-use agents (OpenAI Operator, Claude Computer Use), which use frontier models with vision + accessibility tree + higher step budgets + retry logic.

The v1 comparison (24× faster, 0% vs 100% success) is directionally right but not defensible for public claims. **Baseline v2 is required before publishing any comparative numbers.**

## Fair-Test Methodology (v2 — Required Before Publishing)

**Six fixes to make the comparison honest**:

1. **Same LLM on both sides** — Claude Sonnet 4.6 for both baseline and MCP path. No Groq. No mixed models.
2. **Baseline uses screenshots + accessibility tree** — real computer-use, not tree-only. `page.screenshot()` + `page.accessibility.snapshot()` on every step, both sent to Claude with `computer_20241022` tool.
3. **Real token accounting on both sides** — sum `input_tokens + output_tokens` from every Anthropic API response. No "~0" or "infinite" — real numbers or don't report.
4. **Step budget = 50, with retry on error** — give the baseline a fair chance to complete. If it still hits MAX, that's a meaningful finding, not a config artifact.
5. **n=10, identical prompts on both sides** — 10 fixed prompts (mix of 2-node simple to 10-node complex). Same prompts, same environment, same session. Report median + worst case, not just average.
6. **Log failure modes explicitly** — for every failure: step number, attempted action, actual UI state (screenshot), root cause (locator mismatch / timeout / reasoning error / infra).

**Standard 10 prompts** (define once, use for both baseline and MCP):
```
1. Simple: "todo app with user, tasks, and database"
2. Simple: "url shortener with users and short-links"
3. Medium: "blog platform with users, posts, comments, and tags"
4. Medium: "ride-sharing app with riders, drivers, trips, and payments"
5. Medium: "learning management system with courses, students, and grading"
6. Complex: "microservices e-commerce with product catalog, cart, payment gateway, order management, auth, and API gateway"
7. Complex: "chat app with WebSocket gateway, message broker, user service, chat rooms, notifications, and message DB"
8. Complex: "ML pipeline with data ingestion, feature store, training worker, model registry, serving API, and monitoring"
9. Complex: "video streaming platform with upload service, encoder, CDN, recommendation engine, and analytics"
10. Complex: "banking system with accounts, transactions, ledger, fraud detection, notifications, and compliance"
```

**Output format** — for every run, log a row in `pilot/results-v2.csv`:
```
run_id, side (baseline|mcp), prompt_id, model, success, input_tokens, output_tokens, total_tokens, steps, time_seconds, failure_mode, notes
```

---

## The Hypothesis

> Replacing the accessibility-tree browser agent loop with a direct action graph (MCP-wrapped API calls)
> will reduce token usage by 15–20x, reduce task time by 10x, and increase reliability from ~70% to ~100%.

---

## App Under Test

- **App**: Polaris — collaborative architecture diagram editor
- **Local URL**: `http://localhost:3000`
- **Branch**: `pilot/action-graph-test`
- **Task chosen**: Create a new project and trigger AI architecture diagram generation

**Prompt used in every run**:
> "microservices e-commerce architecture with product catalog, cart service, payment gateway, and order management"

**Key API routes involved**:
```
POST /api/projects                     → create project, returns {project: {id, name}}
POST /api/ai/design                    → trigger design agent, body: {projectId, roomId, prompt}
                                         returns {runId}
GET  /api/projects/{projectId}/canvas  → verify canvas has nodes+edges after generation
```

**Baseline script**: `pilot/baseline.ts` — runs via `npx ts-node pilot/baseline.ts <run#>`
**MCP server**: `pilot/action-graph-server.py` — runs via `python pilot/action-graph-server.py`
**Schema**: `pilot/action-schema.json`
**Setup guide**: `pilot/README.md`

---

## Baseline: Accessibility Tree Agent Loop

At each step: `page.accessibility.snapshot()` JSON → Claude API → Playwright action.
Run 10 times. Results auto-appended to `pilot/results-baseline.csv`.

```bash
bash pilot/run-baseline.sh
```

| Run # | Success? | Total tokens | Steps | Time (sec) | Notes |
|-------|----------|-------------|-------|------------|-------|
| 1 | ❌ FAIL | 32,234 | 20 (MAX) | 226.4 | Stuck clicking "New project" — sidebar collapsed |
| 2 | ❌ FAIL | 33,238 | 20 (MAX) | 204.5 | Same failure pattern |
| 3 | ❌ FAIL | 30,313 | 20 (MAX) | 200.5 | Same failure pattern |
| **Avg** | **0/3 (0%)** | **31,928** | **20** | **210.5** | LLM cannot find/interact with UI element consistently |

**How it broke**:
- Groq LLM (openai/gpt-oss-120b) got stuck in a loop trying to click a "New project" button by aria name that didn't match the real UI element
- Between failed clicks it partially got to the AI chat panel and tried to fill the prompt — but out of order
- Illustrates the core baseline problem: the accessibility tree names don't cleanly map to what the LLM predicts, and error recovery is expensive per step (~1,500 tokens each)

**Full CSV**: `pilot/results-baseline.csv`

---

## Action Graph: MCP Approach

Task run via VSCode Claude extension with `ghost-ai` MCP server active (TypeScript, stdio transport).
MCP server: `pilot/ghost-ai-mcp-server.ts` compiled to `.pilot-dist/ghost-ai-mcp-server.js`

Claude prompt given each run:
> Create a new project called "Pilot-MCP-{N}" and generate a microservices e-commerce architecture diagram with product catalog, cart service, payment gateway, and order management.

| Run # | Project | Success? | Tool calls | Time (sec) | Nodes | Edges | Notes |
|-------|---------|----------|------------|------------|-------|-------|-------|
| 1 | Pilot-MCP-1 | ❌ FAIL | 2 | ~18 | 0 | 0 | Liveblocks Room not found — browser not open (pre-fix) |
| 2 | Pilot-MCP-2 | ✅ | 3 | 18 | 8 | 9 | create + trigger + get_canvas; browser open |
| C-1 | Pilot-C-1-Ecommerce | ✅ | 2 | 9 | 7 | 7 | **No browser** — blob-save fix deployed |
| C-2 | Pilot-C-2-ChatApp | ✅ | 2 | 10 | 7 | 8 | **No browser** — blob-save fix |
| C-3 | Pilot-C-3-MLPipeline | ✅ | 2 | 7 | 6 | 5 | **No browser** — blob-save fix |
| **Avg (post-fix)** | | **3/3 ✅** | **2** | **8.7s** | **6.7** | **6.7** | |

**Edge cases hit**:
- Pre-fix: browser editor must be open (Liveblocks room only exists with active connection)
- Fix applied 2026-07-23: design agent now saves directly to Vercel Blob — no browser needed

**Prompts used (Option C)**:
1. E-commerce: microservices with product catalog, cart, payment gateway, order management, auth, API gateway
2. Chat app: WebSocket gateway, message broker, user service, chat room, notification service, message DB
3. ML pipeline: data ingestion, feature store, model training worker, model registry, serving API, monitoring

**MCP server file**: `pilot/ghost-ai-mcp-server.ts` → `.pilot-dist/ghost-ai-mcp-server.js`
**Action schema file**: `pilot/action-schema.json`

---

## Results Summary

| Metric | Accessibility Tree (n=3) | Action Graph (n=3, Option C) | Improvement |
|--------|-------------------------|-------------------------------|-------------|
| Avg total tokens | 31,928 | ~0 (no LLM in loop) | **effectively infinite** |
| Avg time (sec) | 210.5 | 8.7 | **24× faster** |
| Success rate | 0/3 (0%) | 3/3 (100%) | **∞** |
| Steps / tool calls | 20 (hit MAX) | 2 | **10× fewer** |
| Estimated cost / 1,000 tasks (@$3/Mtok) | ~$95 | ~$0 | **~95× cheaper** |

**Did the hypothesis hold?** **YES — exceeded expectations.**
Hypothesis was 15-20× token reduction, 10× time savings, ~100% success. Actual: 24× faster time, 100% vs 0% success rate, and the accessibility-tree agent could not complete the task at all in 3 attempts of 20 steps each. The action graph wins on every dimension because it bypasses the UI entirely — no locator matching, no accessibility tree parsing, no LLM guessing.

---

## action-schema.json (current version)

See `pilot/action-schema.json`. Key actions for the pilot task:

```json
{
  "name": "create_project",
  "method": "POST",
  "path": "/api/projects",
  "params": { "name": "string" }
},
{
  "name": "trigger_design_agent",
  "method": "POST",
  "path": "/api/ai/design",
  "params": { "projectId": "string", "roomId": "string (= projectId)", "prompt": "string" }
}
```

---

## Ghost AI MCP Server (current version)

See `pilot/ghost-ai-mcp-server.ts` → compiled to `.pilot-dist/ghost-ai-mcp-server.js`.
Transport: stdio. Config: `.mcp.json` (project root).
Tools exposed: `list_projects`, `create_project`, `get_project`, `update_project`,
`delete_project`, `get_canvas`, `trigger_design_agent`, `generate_spec`,
`list_specs`, `download_spec`, `list_collaborators`.

---

## Feedback Log

| Date | Person | What they said | Signal |
|------|--------|----------------|--------|
| | | | |

**Key quotes** (exact words, not paraphrase):
-

---

## Issues Found

| # | Description | Severity | Status |
|---|-------------|----------|--------|
| 1 | | | |

---

## Decision Gate (end of Week 1)

- [ ] Numbers show 10x+ improvement on tokens
- [ ] Numbers show 5x+ improvement on time
- [ ] Success rate 100% vs <80% for baseline
- [ ] At least 1 external person asks to try it or pay for it

**Decision**: _(keep building / change positioning / pivot / stop)_

**Reason**:

---

## Next Steps After Pilot

_(fill in after decision gate)_
-
