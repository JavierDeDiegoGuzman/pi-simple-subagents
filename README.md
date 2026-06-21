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

- always synchronous
- always fresh (`--no-session`)
- runs from the same working directory as the parent agent
- inherits the current model and thinking level
- inherits the current active tools, except subagent-spawning tools
- `/subagents super` restricts the main agent to the `subagent` tool while delegated subagents inherit the previous active tools
- records and renders the child agent's full input task
- records and renders the child agent's tool-call history
- disables nested `subagent` registration in child processes

## Commands

```text
/subagents [on|off|super|status]
/subagets [on|off|super|status]  # typo alias
```

- `on`: enable subagent-first guidance without changing active tools.
- `off`: disable subagent-first guidance and restore tools if leaving super mode.
- `super`: enable guidance, disable every main-agent tool except `subagent`, and let subagents use the tools that were active before entering super mode.
- `status` or no argument: show the current mode.

## Tool schema

```ts
subagent({ task: string })
```

## Development

```bash
npm install --legacy-peer-deps
npm test
```

Pi core packages are declared as peer dependencies because Pi provides them at runtime.
