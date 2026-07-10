import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { stripSubagentContext } from "./prompt-sanitizer.js";
import { renderSimpleSubagentCall, renderSimpleSubagentResult } from "./rendering.js";
import { CHILD_ENV, runSimpleSubagent } from "./run-simple-subagent.js";
import {
  SUBAGENT_FIRST_GUIDANCE,
  SUBAGENT_SKILL_NAME,
  SUBAGENT_SUPER_GUIDANCE,
  SUBAGENT_TOOL_PROMPT_GUIDELINES,
  SUBAGENT_TOOL_PROMPT_SNIPPET,
} from "./subagent-guidance.js";
import { activeToolNames, delegatedToolNames, SUBAGENT_TOOL_NAME } from "./tool-selection.js";
import type { SimpleSubagentDetails } from "./types.js";

const SubagentParams = Type.Object({
  task: Type.String({ description: "Task to run in a fresh synchronous subagent." }),
});

export default function registerSimpleSubagents(pi: ExtensionAPI): void {
  // Child agents must not be able to launch further subagents.
  if (process.env[CHILD_ENV] === "1") return;

  let subagentMode: "on" | "off" | "super" = "on";
  let savedMainTools: string[] | undefined;
  let superDelegatedTools: string[] | undefined;

  const toolsWithSubagent = (toolNames: readonly string[]) => {
    return toolNames.includes(SUBAGENT_TOOL_NAME) ? [...toolNames] : [...toolNames, SUBAGENT_TOOL_NAME];
  };

  const restoreMainTools = () => {
    if (!savedMainTools) return;
    pi.setActiveTools(savedMainTools);
    savedMainTools = undefined;
    superDelegatedTools = undefined;
  };

  const disableSubagentAccess = () => {
    const currentTools = activeToolNames(pi.getActiveTools());
    if (!currentTools.includes(SUBAGENT_TOOL_NAME)) return;
    pi.setActiveTools(delegatedToolNames(currentTools));
  };

  const enableSubagentAccess = () => {
    const currentTools = activeToolNames(pi.getActiveTools());
    if (currentTools.includes(SUBAGENT_TOOL_NAME)) return;
    pi.setActiveTools(toolsWithSubagent(currentTools));
  };

  const removeSubagentFromPromptOptions = (options: BuildSystemPromptOptions) => {
    if (Array.isArray(options.selectedTools)) {
      options.selectedTools = delegatedToolNames(options.selectedTools);
    }
    if (options.toolSnippets && typeof options.toolSnippets === "object") {
      delete options.toolSnippets[SUBAGENT_TOOL_NAME];
    }
    if (Array.isArray(options.promptGuidelines)) {
      options.promptGuidelines = options.promptGuidelines.filter(
        (guideline: unknown) => !SUBAGENT_TOOL_PROMPT_GUIDELINES.includes(String(guideline).trim()),
      );
    }
    if (Array.isArray(options.skills)) {
      options.skills = options.skills.filter((skill) => skill.name !== SUBAGENT_SKILL_NAME);
    }
  };

  pi.on("input", (event, ctx) => {
    if (subagentMode !== "off") return { action: "continue" };
    const text = event.text.trim();
    if (text === `/skill:${SUBAGENT_SKILL_NAME}` || text.startsWith(`/skill:${SUBAGENT_SKILL_NAME} `)) {
      ctx.ui.notify(`${SUBAGENT_SKILL_NAME} skill is disabled while /subagents is off.`, "warning");
      return { action: "handled" };
    }
    return { action: "continue" };
  });

  pi.on("tool_call", (event) => {
    if (subagentMode === "off" && event.toolName === SUBAGENT_TOOL_NAME) {
      return { block: true, reason: `${SUBAGENT_TOOL_NAME} is disabled while /subagents is off.` };
    }
  });

  pi.on("before_agent_start", (event) => {
    if (subagentMode === "off") {
      disableSubagentAccess();
      removeSubagentFromPromptOptions(event.systemPromptOptions);
      return { systemPrompt: stripSubagentContext(event.systemPrompt) };
    }
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
        disableSubagentAccess();
        subagentMode = "off";
      } else if (action === "on") {
        restoreMainTools();
        enableSubagentAccess();
        subagentMode = "on";
      } else if (action === "super") {
        if (subagentMode !== "super") {
          const currentTools = activeToolNames(pi.getActiveTools());
          const mainTools = toolsWithSubagent(currentTools);
          const delegateTools = delegatedToolNames(mainTools);
          savedMainTools = mainTools;
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
        subagentMode === "on"
          ? "Subagent-first workflow is on. The subagent tool and /skill:subagent-first are enabled."
          : "Subagent-first workflow is off. The subagent tool and /skill:subagent-first are disabled.",
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
    promptSnippet: SUBAGENT_TOOL_PROMPT_SNIPPET,
    promptGuidelines: SUBAGENT_TOOL_PROMPT_GUIDELINES,
    parameters: SubagentParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<SimpleSubagentDetails>> {
      if (subagentMode === "off") {
        return {
          isError: true,
          content: [{ type: "text", text: `${SUBAGENT_TOOL_NAME} is disabled while /subagents is off.` }],
          details: {
            task: params.task,
            cwd: ctx.cwd,
            tools: [],
            exitCode: 1,
            messages: 0,
            toolCalls: [],
          },
        };
      }

      return runSimpleSubagent(pi, params, signal, onUpdate, ctx, {
        inheritedToolsOverride: superDelegatedTools,
      });
    },

    renderCall: renderSimpleSubagentCall,
    renderResult: renderSimpleSubagentResult,
  });
}
