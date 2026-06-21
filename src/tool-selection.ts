export const SUBAGENT_TOOL_NAME = "subagent";

export function activeToolNames(tools: unknown[]): string[] {
  return tools
    .map((tool) => {
      if (typeof tool === "string") return tool;
      if (tool && typeof tool === "object" && "name" in tool) {
        const name = (tool as { name?: unknown }).name;
        return typeof name === "string" ? name : undefined;
      }
      return undefined;
    })
    .filter((name): name is string => typeof name === "string" && name.length > 0);
}

export function delegatedToolNames(toolNames: readonly string[]): string[] {
  return toolNames.filter((name) => name !== SUBAGENT_TOOL_NAME);
}
