import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const TASK_ARG_LIMIT = 8000;

export interface TaskArg {
  arg: string;
  tempDir?: string;
}

export function makeTaskArg(task: string): TaskArg {
  if (task.length <= TASK_ARG_LIMIT) return { arg: `Task: ${task}` };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-simple-subagent-"));
  const taskPath = path.join(tempDir, "task.md");
  fs.writeFileSync(taskPath, `Task: ${task}`, { encoding: "utf-8", mode: 0o600 });
  return { arg: `@${taskPath}`, tempDir };
}

export function cleanupTempDir(tempDir: string | undefined): void {
  if (!tempDir) return;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup.
  }
}
