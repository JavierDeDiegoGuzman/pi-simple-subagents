import { describe, expect, it } from "vitest";
import { textFromMessage, toolCallsFromMessage } from "../src/json-output.js";

describe("json-output", () => {
  it("extracts joined text parts from a message", () => {
    const message = {
      content: [
        { type: "text", text: "first" },
        { type: "toolCall", name: "read", arguments: { path: "README.md" } },
        { type: "text", text: "second" },
      ],
    };

    expect(textFromMessage(message)).toBe("first\nsecond");
  });

  it("returns empty text for messages without text content", () => {
    expect(textFromMessage({ content: [{ type: "toolCall", name: "read" }] })).toBe("");
    expect(textFromMessage({})).toBe("");
  });

  it("extracts tool calls with arguments", () => {
    const message = {
      content: [
        { type: "toolCall", name: "read", arguments: { path: "README.md" } },
        { type: "text", text: "ignored" },
        { type: "toolCall", name: "bash", arguments: { command: "pwd" } },
      ],
    };

    expect(toolCallsFromMessage(message)).toEqual([
      { name: "read", args: { path: "README.md" } },
      { name: "bash", args: { command: "pwd" } },
    ]);
  });

  it("uses empty args for malformed tool call arguments", () => {
    const message = {
      content: [
        { type: "toolCall", name: "read", arguments: null },
        { type: "toolCall", name: "bash", arguments: "not-object" },
      ],
    };

    expect(toolCallsFromMessage(message)).toEqual([
      { name: "read", args: {} },
      { name: "bash", args: {} },
    ]);
  });
});
