import { describe, expect, it } from "vitest";
import { activeToolNames, delegatedToolNames } from "../src/tool-selection.js";

describe("tool-selection", () => {
  it("normalizes active tool names from strings and tool objects", () => {
    expect(activeToolNames(["read", { name: "bash" }, { name: 123 }, null, ""])).toEqual(["read", "bash"]);
  });

  it("removes subagent from delegated child tools", () => {
    expect(delegatedToolNames(["read", "subagent", "bash"])).toEqual(["read", "bash"]);
  });
});
