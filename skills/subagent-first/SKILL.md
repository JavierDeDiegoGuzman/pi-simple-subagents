---
name: subagent-first
description: "Prefer using subagents for separable coding work: code review, reference search, repo exploration, debugging, tests, and atomic change planning."
---

# Subagent First

Default to `subagent` for independent investigation or review. Parallelize only non-overlapping tasks. Synthesize findings, then make small coordinated edits yourself.

When delegating, include enough startup guidance for the child agent to be effective from the beginning. In particular, explicitly list any skills the subagent should load before working, using their exact names when known.

Example:

```text
Before starting, load and follow these skills:
- improve-codebase-architecture
- subagent-first

Then investigate the architecture and report concrete refactoring opportunities. Do not edit files.
```

Prefer this explicit skill guidance for repo exploration, code review, debugging, test investigation, and change planning tasks where a specialized skill would materially improve the subagent's work.

Subagents dont have acces to the subagent tool or skill.
