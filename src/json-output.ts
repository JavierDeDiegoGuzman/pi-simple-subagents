import type { SubagentToolCall } from "./types.js";

export function textFromMessage(message: any): string {
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

export function toolCallsFromMessage(message: any): SubagentToolCall[] {
  if (!Array.isArray(message?.content)) return [];
  return message.content
    .filter((part: any) => part?.type === "toolCall" && typeof part.name === "string")
    .map((part: any) => ({
      name: part.name,
      args: part.arguments && typeof part.arguments === "object" ? part.arguments : {},
    }));
}
