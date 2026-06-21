import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderSimpleSubagentCall, renderSimpleSubagentResult } from "./rendering.js";
import { CHILD_ENV, runSimpleSubagent } from "./run-simple-subagent.js";
import { activeToolNames, delegatedToolNames, SUBAGENT_TOOL_NAME } from "./tool-selection.js";
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

const SUBAGENT_SUPER_GUIDANCE = `
Subagent super mode:
- The main agent is intentionally restricted to delegation. Use subagent for implementation, investigation, debugging, tests, and edits.
- Synthesize subagent results and communicate with the user, but do not attempt direct tool work in the main agent.
`.trim();

export default function registerSimpleSubagents(pi: ExtensionAPI): void {
  // Child agents must not be able to launch further subagents.
  if (process.env[CHILD_ENV] === "1") return;

  let subagentMode: "on" | "off" | "super" = "on";
  let savedMainTools: string[] | undefined;
  let superDelegatedTools: string[] | undefined;

  const restoreMainTools = () => {
    if (!savedMainTools) return;
    pi.setActiveTools(savedMainTools);
    savedMainTools = undefined;
    superDelegatedTools = undefined;
  };

  pi.on("before_agent_start", (event) => {
    if (subagentMode === "off") return;
    const guidance = subagentMode === "super"
      ? `${SUBAGENT_FIRST_GUIDANCE}\n\n${SUBAGENT_SUPER_GUIDANCE}`
      : SUBAGENT_FIRST_GUIDANCE;
    return { systemPrompt: `${event.systemPrompt}\n\n${guidance}` };
  });

  const subagentsCommand = {
    description: "Show or toggle subagent-first workflow guidance (on/off/super/status).",
    handler: async (args: string, ctx: any) => {
      const action = args.trim().toLowerCase();
      if (action === "off") {
        restoreMainTools();
        subagentMode = "off";
      } else if (action === "on") {
        restoreMainTools();
        subagentMode = "on";
      } else if (action === "super") {
        if (subagentMode !== "super") {
          const currentTools = activeToolNames(pi.getActiveTools());
          const delegateTools = delegatedToolNames(currentTools);
          savedMainTools = currentTools;
          superDelegatedTools = delegateTools;
          pi.setActiveTools([SUBAGENT_TOOL_NAME]);
        }
        subagentMode = "super";
      } else if (action && action !== "status") {
        ctx.ui.notify("Usage: /subagents [on|off|super|status]", "warning");
        return;
      }

      if (subagentMode === "super") {
        const delegated = superDelegatedTools?.join(", ") || "none";
        ctx.ui.notify(
          `Subagent super mode is on. Main agent can only use ${SUBAGENT_TOOL_NAME}; subagents inherit: ${delegated}.`,
          "info",
        );
        return;
      }

      ctx.ui.notify(
        `Subagent-first workflow is ${subagentMode}.`,
        subagentMode === "on" ? "info" : "warning",
      );
    },
  };

  pi.registerCommand("subagents", subagentsCommand);
  pi.registerCommand("subagets", {
    ...subagentsCommand,
    description: "Alias for /subagents.",
  });

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Run one fresh synchronous subagent with delegated tools; normally inherits current active tools except subagent-spawning tools.",
    promptSnippet: "Run a fresh isolated subagent for a single delegated task.",
    promptGuidelines: [
      "Use subagent when an isolated context would help with a focused subtask.",
      "subagent is always synchronous and fresh; it does not preserve conversation history.",
      "subagent children cannot launch nested subagents.",
      "You may call subagent multiple times in the same turn only for independent work; avoid parallel calls that may edit overlapping files.",
    ],
    parameters: SubagentParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<SimpleSubagentDetails>> {
      return runSimpleSubagent(pi, params, signal, onUpdate, ctx, {
        inheritedToolsOverride: superDelegatedTools,
      });
    },

    renderCall: renderSimpleSubagentCall,
    renderResult: renderSimpleSubagentResult,
  });
}
