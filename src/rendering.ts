import { Text } from "@earendil-works/pi-tui";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { SimpleSubagentDetails, SubagentToolCall } from "./types.js";

function previewText(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

function resultText(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return (result.content ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function formatToolCall(call: SubagentToolCall): string {
  const args = JSON.stringify(call.args);
  const preview = args.length > 160 ? `${args.slice(0, 159)}…` : args;
  return `${call.name} ${preview}`;
}

export function renderSimpleSubagentCall(args: { task?: string }, theme: any): Text {
  const task = previewText(args.task ?? "", 80);
  return new Text(`${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", task)}`, 0, 0);
}

export function renderSimpleSubagentResult(
  result: AgentToolResult<SimpleSubagentDetails>,
  { expanded, isPartial }: { expanded: boolean; isPartial?: boolean },
  theme: any,
): Text {
  const details = result.details as SimpleSubagentDetails | undefined;
  const text = resultText(result);

  if (isPartial) {
    const lines = [theme.fg("warning", text ? previewText(text) : "running...")];
    if (details?.toolCalls?.length) {
      lines.push(theme.fg("dim", `${details.toolCalls.length} tool calls`));
      for (const call of details.toolCalls.slice(-5)) lines.push(theme.fg("dim", `→ ${formatToolCall(call)}`));
    }
    return new Text(lines.join("\n"), 0, 0);
  }

  const status = result.isError || (details?.exitCode !== undefined && details.exitCode !== 0)
    ? theme.fg("error", "failed")
    : theme.fg("success", "completed");
  const meta = [
    status,
    details?.messages !== undefined ? theme.fg("dim", `${details.messages} messages`) : undefined,
    details?.toolCalls ? theme.fg("dim", `${details.toolCalls.length} tool calls`) : undefined,
    details?.tools ? theme.fg("dim", `${details.tools.length} tools`) : undefined,
  ].filter(Boolean).join(theme.fg("dim", " · "));

  if (!expanded) {
    const preview = previewText(text || "(no output)");
    return new Text(`${meta}\n${theme.fg("dim", preview)}\n${theme.fg("muted", "Ctrl+O to expand")}`, 0, 0);
  }

  const lines = [meta];
  if (details?.model) lines.push(theme.fg("dim", `model: ${details.model}`));
  if (details?.cwd) lines.push(theme.fg("dim", `cwd: ${details.cwd}`));
  if (details?.tools?.length) lines.push(theme.fg("dim", `tools: ${details.tools.join(", ")}`));
  if (details?.toolCalls?.length) {
    lines.push("", theme.fg("muted", "tool call history:"));
    for (const call of details.toolCalls) lines.push(theme.fg("dim", `→ ${formatToolCall(call)}`));
  }
  if (text) lines.push("", text);
  if (details?.stderr) lines.push("", theme.fg("warning", "stderr:"), theme.fg("dim", details.stderr));
  return new Text(lines.join("\n"), 0, 0);
}
