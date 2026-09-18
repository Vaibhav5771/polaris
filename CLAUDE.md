@AGENTS.md

## Graphify Knowledge Graph

This project has a persistent knowledge graph in `graphify-out/`. **Always query it before ad-hoc grep for any architecture, relationship, or codebase question.**

```bash
# Query the graph
graphify query "how does X work"
graphify path "ComponentA" "ComponentB"
graphify explain "SomeNode"

# Rebuild after significant changes
/graphify .
```

- `graphify-out/graph.html` — interactive browser view
- `graphify-out/GRAPH_REPORT.md` — god nodes, communities, surprising connections
- `graphify-out/graph.json` — raw graph data for programmatic queries

Run `/graphify .` after adding new features or major refactors to keep the graph current.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.claude/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-realtime-and-frontend`, `trigger-getting-started`.
<!-- TRIGGER.DEV SKILLS END -->
