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
- records and renders the child agent's full input task
- records and renders the child agent's tool-call history
- disables nested `subagent` registration in child processes

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
