import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderSimpleSubagentCall, renderSimpleSubagentResult } from "./rendering.js";
import { CHILD_ENV, runSimpleSubagent } from "./run-simple-subagent.js";
import type { SimpleSubagentDetails } from "./types.js";

const SubagentParams = Type.Object({
  task: Type.String({ description: "Task to run in a fresh synchronous subagent." }),
  cwd: Type.Optional(
    Type.String({ description: "Working directory for the subagent. Defaults to the current cwd." }),
  ),
});

export default function registerSimpleSubagents(pi: ExtensionAPI): void {
  // Child agents must not be able to launch further subagents.
  if (process.env[CHILD_ENV] === "1") return;

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
