import { describe, expect, it } from "vitest";
import { stripSubagentContext } from "../src/prompt-sanitizer.js";
import {
  SUBAGENT_FIRST_GUIDANCE,
  SUBAGENT_SUPER_GUIDANCE,
  SUBAGENT_TOOL_PROMPT_GUIDELINES,
  SUBAGENT_TOOL_PROMPT_SNIPPET,
} from "../src/subagent-guidance.js";

describe("stripSubagentContext", () => {
  it("removes subagent tool prompt content and injected guidance", () => {
    const prompt = `You are pi.

Available tools:
- read: Read file contents.
- subagent: ${SUBAGENT_TOOL_PROMPT_SNIPPET}

In addition to the tools above, you may have access to other custom tools depending on the project.

Guidelines:
- Be concise.
- ${SUBAGENT_TOOL_PROMPT_GUIDELINES[0]}
- ${SUBAGENT_TOOL_PROMPT_GUIDELINES[1]}

Pi documentation (read only when the user asks about pi itself):
- Main documentation: /README.md

Current date: 2026-06-25

${SUBAGENT_FIRST_GUIDANCE}

${SUBAGENT_SUPER_GUIDANCE}`;

    const stripped = stripSubagentContext(prompt);

    expect(stripped).toContain("- read: Read file contents.");
    expect(stripped).toContain("- Be concise.");
    expect(stripped).not.toContain("subagent:");
    expect(stripped).not.toContain("Subagent-first workflow");
    expect(stripped).not.toContain("Subagent super mode");
    expect(stripped).not.toContain(SUBAGENT_TOOL_PROMPT_GUIDELINES[0]);
    expect(stripped).not.toContain(SUBAGENT_TOOL_PROMPT_GUIDELINES[1]);
  });

  it("does not remove unrelated project context lines that mention subagent", () => {
    const prompt = `You are pi.

Available tools:
- read: Read file contents.
- subagent: ${SUBAGENT_TOOL_PROMPT_SNIPPET}

In addition to the tools above, you may have access to other custom tools depending on the project.

Guidelines:
- Be concise.
- ${SUBAGENT_TOOL_PROMPT_GUIDELINES[0]}

Pi documentation (read only when the user asks about pi itself):
- Main documentation: /README.md

<project_context>
- subagent: false
- ${SUBAGENT_TOOL_PROMPT_GUIDELINES[0]}
</project_context>`;

    const stripped = stripSubagentContext(prompt);

    expect(stripped).toContain("<project_context>");
    expect(stripped).toContain("- subagent: false");
    expect(stripped).toContain(`- ${SUBAGENT_TOOL_PROMPT_GUIDELINES[0]}`);
  });

  it("removes only the subagent-first skill block", () => {
    const prompt = `The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>plan</name>
    <description>Plan work.</description>
    <location>/skills/plan/SKILL.md</location>
  </skill>
  <skill>
    <name>subagent-first</name>
    <description>Prefer subagents.</description>
    <location>/skills/subagent-first/SKILL.md</location>
  </skill>
</available_skills>`;

    const stripped = stripSubagentContext(prompt);

    expect(stripped).toContain("<name>plan</name>");
    expect(stripped).not.toContain("<name>subagent-first</name>");
    expect(stripped).toContain("<available_skills>");
  });

  it("removes an otherwise empty skills section", () => {
    const prompt = `The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>subagent-first</name>
    <description>Prefer subagents.</description>
    <location>/skills/subagent-first/SKILL.md</location>
  </skill>
</available_skills>`;

    expect(stripSubagentContext(prompt)).toBe("");
  });
});
