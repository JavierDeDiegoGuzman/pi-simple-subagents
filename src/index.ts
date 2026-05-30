import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderSimpleSubagentCall, renderSimpleSubagentResult } from "./rendering.js";
import { CHILD_ENV, runSimpleSubagent } from "./run-simple-subagent.js";
import type { SimpleSubagentDetails } from "./types.js";

const SubagentParams = Type.Object({
  task: Type.String({ description: "Task to run in a fresh synchronous subagent." }),
});

const SUBAGENT_FIRST_GUIDANCE = `
Subagent-first workflow:
- Prefer the subagent tool by default for separable work: code review, reference search, repo exploration, debugging, test investigation, and small atomic change plans.
- Delegate independent subtasks to fresh subagents, then synthesize their findings before editing or answering.
- When delegating, explicitly tell each subagent which skills it should load before starting, using exact skill names when known.
- Keep direct work for tiny tasks, tightly coupled edits, or when subagent overhead would not help.
- Do not ask subagents to edit overlapping files in parallel; keep implementation changes atomic and coordinated.
`.trim();

export default function registerSimpleSubagents(pi: ExtensionAPI): void {
  // Child agents must not be able to launch further subagents.
  if (process.env[CHILD_ENV] === "1") return;

  let subagentFirstEnabled = true;

  pi.on("before_agent_start", (event) => {
    if (!subagentFirstEnabled) return;
    return { systemPrompt: `${event.systemPrompt}\n\n${SUBAGENT_FIRST_GUIDANCE}` };
  });

  pi.registerCommand("subagents", {
    description: "Show or toggle subagent-first workflow guidance (on/off/status).",
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (action === "off") subagentFirstEnabled = false;
      else if (action === "on") subagentFirstEnabled = true;
      else if (action && action !== "status") {
        ctx.ui.notify("Usage: /subagents [on|off|status]", "warning");
        return;
      }

      ctx.ui.notify(
        `Subagent-first workflow is ${subagentFirstEnabled ? "on" : "off"}.`,
        subagentFirstEnabled ? "info" : "warning",
      );
    },
  });

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Run one fresh synchronous subagent with the same active tools as the current agent, except subagent-spawning tools.",
    promptSnippet: "Run a fresh isolated subagent for a single delegated task.",
    promptGuidelines: [
      "Use subagent when an isolated context would help with a focused subtask.",
      "subagent is always synchronous and fresh; it does not preserve conversation history.",
      "subagent children cannot launch nested subagents.",
      "You may call subagent multiple times in the same turn only for independent work; avoid parallel calls that may edit overlapping files.",
    ],
    parameters: SubagentParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<SimpleSubagentDetails>> {
      return runSimpleSubagent(pi, params, signal, onUpdate, ctx);
    },

    renderCall: renderSimpleSubagentCall,
    renderResult: renderSimpleSubagentResult,
  });
}
