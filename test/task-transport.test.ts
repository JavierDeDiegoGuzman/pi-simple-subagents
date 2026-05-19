import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempDir, makeTaskArg } from "../src/task-transport.js";

describe("task-transport", () => {
  it("passes short tasks inline", () => {
    expect(makeTaskArg("read the repo")).toEqual({ arg: "Task: read the repo" });
  });

  it("writes long tasks to a private temp file and cleans it up", () => {
    const task = "x".repeat(8001);
    const result = makeTaskArg(task);

    expect(result.tempDir).toBeDefined();
    expect(result.arg.startsWith("@")).toBe(true);

    const taskPath = result.arg.slice(1);
    expect(path.basename(taskPath)).toBe("task.md");
    expect(fs.existsSync(taskPath)).toBe(true);
    expect(fs.readFileSync(taskPath, "utf-8")).toBe(`Task: ${task}`);

    const mode = fs.statSync(taskPath).mode & 0o777;
    expect(mode).toBe(0o600);

    cleanupTempDir(result.tempDir);
    expect(fs.existsSync(result.tempDir!)).toBe(false);
  });

  it("ignores missing temp directories during cleanup", () => {
    expect(() => cleanupTempDir("/tmp/pi-simple-subagent-definitely-missing")).not.toThrow();
    expect(() => cleanupTempDir(undefined)).not.toThrow();
  });
});
