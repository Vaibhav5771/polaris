# Agent-Native Interfaces — Session Research Notes

> Full planning session notes from July 2026.
> Covers: idea exploration, competitive landscape, technical mechanics, honest verdict, pilot plan.

---

## The Core Idea

### Problem Statement
Applications and websites are built for human eyes. When AI agents try to use them, they have to:
- Parse megabytes of HTML (94.9% of which is noise, not content)
- Navigate through menus by looking at screenshots
- Deal with CAPTCHAs, dynamic loading, inconsistent state
- Take a screenshot → infer action → click → repeat for every single step

This is **slow, expensive, and fragile**.

Real cost data people are posting publicly:
- MiHoYo: **$300,000 in tokens burned in 13 hours** (agents talking to apps)
- Jason Calacanis (All-In): **$300/day per agent** at 10–20% capacity = ~$100k/year per agent
- MIT/Stanford/Google/Microsoft paper: agents use **1,000x more tokens** than chat interactions
- A typical webpage: **94.9% of HTML is waste** that agents parse and pay for

### The Proposed Solution
Instead of agents scraping the UI, expose an **action graph** — a structured, machine-readable schema of what an app can DO:
- What actions are available (search, create, update, delete)
- What parameters each action takes
- What prerequisites exist (must search before ordering)
- What the action returns

Agents call the action graph directly. No screenshots. No HTML parsing. No UI fragility.

---

## The Ecosystem Map

### Protocol Stack (2026)

| Protocol | Layer | What it does |
|---|---|---|
| **MCP** (Anthropic → Linux Foundation) | Agent ↔ Tool | Standardizes HOW agents call external tools/data. Tools, Resources, Prompts, Sampling primitives. Auth via OAuth 2.1 + PKCE. |
| **Agent Skills** (Vercel / agentskills.io) | Agent Knowledge | Packaged expertise as SKILL.md files. Two-stage loading: name+description at startup (~100 tokens), full body on activation. |
| **A2A** (Google → Linux Foundation) | Agent ↔ Agent | Routes tasks between specialist agents. MCP handles vertical (agent↔tool), A2A handles horizontal (agent↔agent). |

### What MCP Provides
- `tools/list` endpoint — agents discover available tools and their JSON schemas
- Resource access (read-only data)
- Parameterized prompt templates
- OAuth 2.1 + PKCE auth (standardized March 2025)
- JSON-RPC 2.0 transport (STDIO for local, HTTP+SSE for remote)

### What MCP Does NOT Solve (the gaps)
1. **No semantic action discovery** — agents list tools but can't ask "what tools accomplish X?" (MCP-Zero paper, MIT/Stanford, explicitly marks this as open)
2. **No action prerequisites/postconditions** — no way to express "action A must happen before B" or "this creates resource Y"
3. **No observability** — no cost tracking, token-per-tool accounting, audit logs, version change alerts
4. **No quality enforcement** — industry assessment: "95% of MCP servers are utter garbage" — shallow coverage, broken error handling
5. **Token overhead** — loading 50 tool schemas costs 100K+ tokens before any conversation starts

### OpenAPI → MCP Generators (Free Tools)
- **FastMCP** (`pip install fastmcp`) — wrap any API as MCP server in 10-20 lines of Python
- **openapi-mcp-generator** — TypeScript CLI, generates full MCP server from OpenAPI spec
- **Speakeasy** — generates MCP servers with multi-language support
- **ConvertMCP.com** — online converter

### Agent Skills Format
```
~/.claude/skills/skill-name/
├── SKILL.md          # frontmatter (name, description) + markdown instructions
├── agents/           # agent-specific configs
└── scripts/          # optional bundled code
```
Install from registry: `npx skills add owner/repo@skill-name`
Registry: **skills.sh** (~670k skills, ranked by install count)

---

## Competitive Landscape (Honest)

### Who Has Already Solved the General Problem

| Company | What they built | Funding | Traction |
|---|---|---|---|
| **Composio** | Translation layer for 1,000+ apps. Pre-built AI-optimized integrations. Handles auth + tool calls. | $29M (Lightspeed) | 200+ customers, 100k devs |
| **StackOne** | Unified API + MCP for 200+ enterprise apps (HR, CRM, ATS, Accounting). Built for AI agents. | $24M (Google Ventures) | Production at scale |
| **Browserbase** | Managed headless browser fleet. 50M+ sessions. Agents use any app via browser. | $40M Series B, $300M valuation | 1,000+ enterprise customers |
| **Browser Use** | Open-source Python library for browser control (Playwright-based). | $17M (YC, Felicis) | 50,000+ GitHub stars |
| **Nango** | Code-first API integration platform. 800+ APIs. You write integration logic, Nango runs it. | $9.5M | 400+ production customers |
| **Apify** | Web scraping + 3,000+ community actors. Recently added MCP. | $2.98M | Niche/complementary |

**Composio is essentially the startup idea that was being described.** They built it, have PMF, and have $29M from Lightspeed. You are not the first person to have this insight.

### What's Genuinely Still Unsolved

1. **Mobile apps** — Browserbase, Firecrawl, Browser Use are all web-only. Native mobile (iOS/Android) has no good solution. Appium is fragile and expensive. Nobody has solved "AI agents operating mobile apps" cleanly.

2. **Agent authorization scoping** — Every setup gives agents either too much access (security risk) or too little (can't do the job). 95% of IT leaders cite this as their #1 barrier to agent deployment. Not solved.

3. **Deep vertical quality** — Composio has 1,000 apps, each shallow. A focused play on one industry (healthcare, legal, logistics) with 20 apps done perfectly beats Composio's breadth for those customers.

4. **Legacy enterprise software** — SAP, Oracle, ancient CRMs, government systems. No API, no MCP, no OpenAPI spec. Will never ship their own MCP servers.

---

## How ChatGPT/Claude Orders Food (Technical Mechanics)

This is how computer-use agents (ChatGPT Operator, Claude computer use) actually work when booking Zomato orders.

### They do NOT read source code or HTML. Two techniques:

#### Technique 1: Screenshot + Vision Loop
```
1. Take screenshot of screen
2. Send screenshot to vision model (GPT-4o / Claude)
3. Model SEES the UI like a human — reads "Add to Cart" button visually
4. Model outputs action: click(x=340, y=890) or type("chicken biryani")
5. System executes that action on the device
6. Take another screenshot
7. Repeat until task complete
```
Every step = 1 screenshot + 1 model inference call. A 10-step order = 10 API calls, ~1,500-2,000 tokens per screenshot = ~15,000-20,000 tokens per order.

#### Technique 2: Accessibility Tree (more efficient)
Every app already has a hidden structured layer built for blind users (VoiceOver/TalkBack). This is called the accessibility tree:
```
Screen
├── Button: "Search" [tappable, x=50 y=200]
├── TextField: "What are you craving?" [editable]
├── ScrollView
│   ├── RestaurantCard: "Behrouz Biryani" [tappable]
│   │   ├── Label: "4.2 ★"
│   │   └── Label: "30-40 min"
```
Instead of processing a full screenshot (expensive), the agent reads this structured tree. Much fewer tokens, much more reliable.

### For Mobile Apps Specifically
- **iOS**: `XCTest` framework / `UIKit accessibility API`
- **Android**: `UiAutomator2` / `AccessibilityService`
- **Both exposed via**: `Appium` (open-source test automation tool)

The AI decides WHAT to do. Appium/accessibility APIs actually execute it.

### Why It's Slow, Expensive, and Fragile
- Each screenshot = ~2,000 image tokens
- Must wait for screen load between every action
- UI redesign → coordinates shift → agent taps wrong element → breaks
- CAPTCHAs, OTPs, payment screens intentionally resist automation
- A 15-step order: 45–90 seconds, costs $0.10–$0.50 in API calls

### The Action Graph Alternative
Instead of looking at a picture of "Add to Cart":
```
zomato.addToCart(itemId="chicken-biryani-full", quantity=1)
```
No screenshot. No vision inference. No coordinate guessing. Direct, deterministic, 10x cheaper, 10x faster, never breaks when Zomato redesigns their UI.

---

## YCombinator Signal

YC Summer 2026 Requests for Startups explicitly states:
> "Agents are already browsing the web, doing research, making purchases, managing legacy CRMs — but they're doing it on top of software designed for humans clicking buttons. This is slow, inconsistent, and brittle. Every major category of software that people use today needs to be rebuilt for agents. The new agent-first software won't come from incumbents bolting on agent support — it'll come from startups that build explicitly for agents as first-class citizens."

Source: [ycombinator.com/rfs](https://www.ycombinator.com/rfs)

---

## Honest Verdict

### What's real
- The pain is validated by real cost data ($300k burned in 13 hours, MIT 1000x token inflation paper)
- Active HN threads of people building partial solutions (Webact, HTML→Markdown converters, Libretto)
- YC is explicitly funding this category

### What's not unique
- The general "make any web app agent-usable" play = **Composio, funded $29M, 100k developers, solved**
- "Managed browser for agents" = **Browserbase, $40M, 1000+ enterprise customers, solved**
- "Web scraping for agents" = **Firecrawl + Apify, solved**

### The genuine opportunity (given: full-stack developer, has web + mobile apps, can start today)

**Option 1 — Mobile-first (if apps are native mobile)**
Flutter and React Native expose semantic/accessibility trees. Nobody has a clean solution for AI agents operating mobile apps without fragile Appium automation. Building from the inside (you own the code) is the edge no outside competitor can match.

**Option 2 — Deep vertical quality**
Pick healthcare, legal, real estate, or logistics. Build 20 integrations for that vertical so deep and reliable that Composio's shallow versions look like toys. Sell to companies in that vertical.

**Option 3 — Agent authorization scoping**
Genuinely unsolved, confirmed pain at enterprise level. Different skill set/sales motion required.

**Do not build**: Another general-purpose translation layer. You are 3 years behind Composio and have $29M less to spend.

---

## The Pilot Plan

### Setup (Your Next.js app, ONE specific task)

**Goal**: Prove with real numbers that action graph beats screenshot loop.

**Day 1–2: Baseline**
```bash
npm install playwright @playwright/test
npx playwright install chromium
```
- Write Playwright script clicking through UI for your chosen task
- Run 10 times, record: tokens (from Anthropic console), time, success rate
- Also run same task with Claude Computer Use to see actual screenshot loop

**Day 3–4: Action Graph**
```bash
pip install fastmcp httpx
```
1. List your `app/api/` routes — these are your actions
2. Write `action-schema.json` (structured JSON describing each action)
3. Wrap with FastMCP server (~20 lines Python)
4. Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "yourapp": {
      "command": "python",
      "args": ["/path/to/action-graph-server.py"]
    }
  }
}
```
5. Give Claude same task in plain English
6. Record tokens, time, success rate

**Day 5: Compare**

| Metric | Screenshot Loop | Action Graph | Target |
|---|---|---|---|
| Tokens per task | ? | ? | 10x reduction |
| Time per task | ? | ? | 5x faster |
| Success rate | ?/10 | ?/10 | 100% vs ~60% |

Record 3-minute video: left = screenshot loop (slow, visual), right = action graph (instant). This IS the demo.

**Day 6–7: Validate**
- Show developer friend. Ask: "Would you use this? Have you hit this problem?"
- Post "Show HN" if numbers are strong

**Decision gate**:
- Developer friend: "I've hit this exact problem" + numbers show 5x+ → keep building
- Numbers weak → try more complex task, not different idea
- Friend says "Composio does this" → ask what Composio does badly → that's the wedge

---

## Key Resources

### MCP
- Spec: [modelcontextprotocol.io/specification/2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- FastMCP: [gofastmcp.com](https://gofastmcp.com)
- OpenAPI → MCP generator: `npm install -g openapi-mcp-generator`

### Agent Skills
- Registry: [skills.sh](https://skills.sh)
- Spec: [agentskills.io/specification](https://agentskills.io/specification)
- Install: `npx skills add <owner/repo@skill>`

### Competitive Research
- Composio: [composio.dev](https://composio.dev) — 1000+ apps, $29M Lightspeed
- StackOne: [stackone.com](https://stackone.com) — enterprise, $24M Google Ventures
- Browserbase: [browserbase.com](https://browserbase.com) — $40M Series B
- Browser Use: [github.com/browser-use/browser-use](https://github.com/browser-use/browser-use) — 50K stars, $17M

### Academic / Research
- MCP-Zero paper (MIT/Stanford) — active tool discovery as unsolved problem
- "Building the Web for Agents" — arxiv.org/pdf/2511.11287
- Vercel Agent Readability Spec — [vercel.com/kb/guide/agent-readability-spec](https://vercel.com/kb/guide/agent-readability-spec)

### HN Threads (Real Pain Evidence)
- [Webact – token-efficient browser control](https://news.ycombinator.com/item?id=47239658)
- [We auto-convert HTML → Markdown for AI agents](https://news.ycombinator.com/item?id=46991030)
- [Libretto – Making AI browser automations deterministic](https://news.ycombinator.com/item?id=47780971)
- [Turning browser automation into an AI Agent](https://news.ycombinator.com/item?id=45726846)

---

## Open Questions (Unresolved)

- [ ] Are the user's mobile apps Flutter or React Native? (Determines which accessibility API applies)
- [ ] Which specific Next.js app is being used for the pilot, and what's the ONE chosen task?
- [ ] Is there a specific industry/vertical where the user has deeper knowledge or network?
- [ ] What does the developer friend specifically build with AI agents?

---

*Session date: July 2026. Update this file as the pilot progresses.*
