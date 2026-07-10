export const SUBAGENT_SKILL_NAME = "subagent-first";

export const SUBAGENT_TOOL_PROMPT_SNIPPET =
  "Run a fresh isolated subagent for a single delegated task.";

export const SUBAGENT_TOOL_PROMPT_GUIDELINES = [
  "Use subagent when an isolated context would help with a focused subtask.",
  "subagent is always synchronous and fresh; it does not preserve conversation history.",
  "subagent children cannot launch nested subagents.",
  "You may call subagent multiple times in the same turn only for independent work; avoid parallel calls that may edit overlapping files.",
];

export const SUBAGENT_FIRST_GUIDANCE = `
Subagent-first workflow:
- Prefer the subagent tool by default for separable work: code review, reference search, repo exploration, debugging, test investigation, and small atomic change plans.
- Delegate independent subtasks to fresh subagents, then synthesize their findings before editing or answering.
- When delegating, explicitly tell each subagent which skills it should load before starting, using exact skill names when known.
- Keep direct work for tiny tasks, tightly coupled edits, or when subagent overhead would not help.
- Do not ask subagents to edit overlapping files in parallel; keep implementation changes atomic and coordinated.
`.trim();

export const SUBAGENT_SUPER_GUIDANCE = `
Subagent super mode:
- The main agent is intentionally restricted to delegation. Use subagent for implementation, investigation, debugging, tests, and edits.
- Synthesize subagent results and communicate with the user, but do not attempt direct tool work in the main agent.
`.trim();
