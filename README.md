# pi-simple-subagents

Minimal Pi extension that registers a single `subagent` tool.

Entry point: `src/index.ts`.

## Install

```bash
pi install git:github.com/JavierDeDiegoGuzman/pi-simple-subagents
```

Or test without installing:

```bash
pi -e git:github.com/JavierDeDiegoGuzman/pi-simple-subagents
```

Reload Pi after editing/installing:

```bash
/reload
```

## Behavior

- always synchronous
- always fresh (`--no-session`)
- inherits the current model and thinking level
- inherits the current active tools, except subagent-spawning tools
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
