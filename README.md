# pi-simple-subagents

Minimal Pi extension that registers a single `subagent` tool.

Entry point: `src/index.ts`.

## Install

From npm:

```bash
pi install npm:pi-simple-subagents
```

Or test without installing:

```bash
pi -e npm:pi-simple-subagents
```

You can also install directly from GitHub:

```bash
pi install git:github.com/JavierDeDiegoGuzman/pi-simple-subagents
```

Reload Pi after editing/installing:

```bash
/reload
```

## Behavior

- starts with the `subagent` tool, subagent-first guidance, and bundled skill disabled; opt in per session with `/subagents on`
- resets to off after `/reload`, `/new`, `/resume`, `/fork`, and `/clone`
- always synchronous
- always fresh (`--no-session`)
- runs from the same working directory as the parent agent
- inherits the current model and thinking level by default
- allows an optional per-subagent model override
- inherits the current active tools, except subagent-spawning tools
- `/subagents super` restricts the main agent to the `subagent` tool while delegated subagents inherit the previous active tools
- records and renders the child agent's full input task
- records and renders the child agent's tool-call history
- disables nested `subagent` registration in child processes
- marks the bundled `subagent-first` skill as explicit-only, strips subagent-first prompt context while `/subagents off` is active, and blocks `/skill:subagent-first`
- hard-blocks stale `subagent` tool calls while `/subagents off` is active, even if another prompt/tool refresh exposes the tool

## Commands

```text
/subagents [on|off|super|status]
/subagets [on|off|super|status]  # typo alias
```

- `on`: enable subagent-first guidance, allow the explicit `/skill:subagent-first` command, and activate the `subagent` tool for the current session.
- `off`: disable subagent-first guidance, remove the `subagent` tool from active tools, and block `/skill:subagent-first`.
- `super`: enable guidance, disable every main-agent tool except `subagent`, and let subagents use the tools that were active before entering super mode.
- `status` or no argument: show the current mode.

## Opt-in tool interoperability

While `super` mode is active, the extension keeps its saved tool set synchronized with other opt-in extensions through Pi's event bus. An extension that changes its tool availability can emit:

```ts
pi.events.emit("opt-in-tools:state", {
  source: "my-extension",
  active: true, // false when disabling
  toolNames: ["my_tool"],
});
```

This prevents tools disabled during `super` mode from being restored accidentally and keeps newly enabled tools hidden from the main agent until it leaves `super` mode.

## Tool schema

```ts
subagent({ task: string, model?: string })
```

## Development

```bash
npm install --legacy-peer-deps
npm test
```

Pi core packages are declared as peer dependencies because Pi provides them at runtime.
