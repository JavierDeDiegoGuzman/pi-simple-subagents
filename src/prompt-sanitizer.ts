import {
  SUBAGENT_FIRST_GUIDANCE,
  SUBAGENT_SKILL_NAME,
  SUBAGENT_SUPER_GUIDANCE,
  SUBAGENT_TOOL_PROMPT_GUIDELINES,
} from "./subagent-guidance.js";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeExactBlock(prompt: string, block: string): string {
  return prompt.split(block).join("");
}

function removeSubagentSkillBlock(prompt: string): string {
  const skillBlock = new RegExp(
    `\\n?  <skill>\\n    <name>${escapeRegExp(SUBAGENT_SKILL_NAME)}<\\/name>\\n[\\s\\S]*?  <\\/skill>\\n?`,
    "g",
  );

  const emptySkillsSection =
    /(?:^|\n\n)The following skills provide specialized instructions for specific tasks\.\nUse the read tool to load a skill's file when the task matches its description\.\nWhen a skill file references a relative path, resolve it against the skill directory \(parent of SKILL\.md \/ dirname of the path\) and use that absolute path in tool commands\.\n\n<available_skills>\s*<\/available_skills>/g;

  const withoutSkill = replaceBetween(prompt, "<available_skills>", "</available_skills>", (body) => {
    return body.replace(skillBlock, "\n").replace(/\n{2,}/g, "\n").trimEnd();
  });

  return withoutSkill.replace(emptySkillsSection, "");
}

function replaceBetween(prompt: string, startMarker: string, endMarker: string, transform: (body: string) => string): string {
  const start = prompt.indexOf(startMarker);
  if (start === -1) return prompt;

  const bodyStart = start + startMarker.length;
  const end = prompt.indexOf(endMarker, bodyStart);
  if (end === -1) return prompt;

  return `${prompt.slice(0, bodyStart)}${transform(prompt.slice(bodyStart, end))}${prompt.slice(end)}`;
}

function removeListLine(body: string, text: string): string {
  return body.replace(new RegExp(`(^|\\n)- ${escapeRegExp(text)}(?=\\n|$)`, "g"), "$1");
}

function removeSubagentToolLine(prompt: string): string {
  return replaceBetween(prompt, "Available tools:\n", "\n\nIn addition to the tools above,", (body) => {
    const next = body.replace(/(^|\n)- subagent: [^\n]*(?=\n|$)/g, "$1").replace(/\n{2,}/g, "\n").trimEnd();
    return next.trim().length > 0 ? next : "(none)";
  });
}

function removeSubagentGuidelines(prompt: string): string {
  return replaceBetween(prompt, "Guidelines:\n", "\n\nPi documentation ", (body) => {
    let next = body;
    for (const guideline of SUBAGENT_TOOL_PROMPT_GUIDELINES) {
      next = removeListLine(next, guideline);
    }
    return next.replace(/\n{2,}/g, "\n").trimEnd();
  });
}

export function stripSubagentContext(systemPrompt: string): string {
  let prompt = removeExactBlock(systemPrompt, SUBAGENT_FIRST_GUIDANCE);
  prompt = removeExactBlock(prompt, SUBAGENT_SUPER_GUIDANCE);
  prompt = removeSubagentSkillBlock(prompt);
  prompt = removeSubagentToolLine(prompt);
  prompt = removeSubagentGuidelines(prompt);
  prompt = prompt.replace(/\n{3,}/g, "\n\n");

  return prompt.trimEnd();
}
