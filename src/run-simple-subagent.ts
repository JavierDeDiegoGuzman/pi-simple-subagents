import { spawn } from "node:child_process";
import * as fs from "node:fs";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { textFromMessage, toolCallsFromMessage } from "./json-output.js";
import { getPiInvocation } from "./pi-invocation.js";
import { cleanupTempDir, makeTaskArg } from "./task-transport.js";
import { activeToolNames, delegatedToolNames } from "./tool-selection.js";
import type { SimpleSubagentDetails, SimpleSubagentParams, SubagentToolCall } from "./types.js";

export const CHILD_ENV = "PI_SIMPLE_SUBAGENT_CHILD";

export async function runSimpleSubagent(
  pi: ExtensionAPI,
  params: SimpleSubagentParams,
  signal: AbortSignal | undefined,
  onUpdate: ((result: AgentToolResult<SimpleSubagentDetails>) => void) | undefined,
  ctx: any,
  options: { inheritedToolsOverride?: readonly string[] } = {},
): Promise<AgentToolResult<SimpleSubagentDetails>> {
  const sourceTools = options.inheritedToolsOverride ?? activeToolNames(pi.getActiveTools());
  const inheritedTools = delegatedToolNames(sourceTools);

  const cwd = ctx.cwd;
  const inheritedModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
  const model = params.model ?? inheritedModel;
  const thinking = typeof pi.getThinkingLevel === "function" ? pi.getThinkingLevel() : undefined;

  const detailsBase = (): Omit<SimpleSubagentDetails, "exitCode" | "messages" | "toolCalls"> => ({
    task: params.task,
    cwd,
    tools: inheritedTools,
    ...(model ? { model } : {}),
    ...(thinking ? { thinking } : {}),
  });

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid cwd: ${cwd}` }],
      details: { ...detailsBase(), exitCode: 1, messages: 0, toolCalls: [] },
    };
  }

  const taskArg = makeTaskArg(params.task);

  const args = ["--mode", "json", "-p", "--no-session"];
  if (model) args.push("--model", model);
  if (thinking && thinking !== "off") args.push("--thinking", thinking);
  if (inheritedTools.length > 0) args.push("--tools", inheritedTools.join(","));
  else args.push("--no-tools");
  args.push(taskArg.arg);

  let finalText = "";
  let stderr = "";
  let stdoutBuffer = "";
  let messageCount = 0;
  let toolCalls: SubagentToolCall[] = [];
  let assistantError: string | undefined;
  let aborted = false;

  try {
    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd,
        env: { ...process.env, [CHILD_ENV]: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let settled = false;
      let closed = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let removeAbortListener: (() => void) | undefined;

      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        if (killTimer) clearTimeout(killTimer);
        removeAbortListener?.();
        resolve(code);
      };

      const processLine = (line: string) => {
        if (!line.trim()) return;

        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === "message_end" && event.message) {
          messageCount++;
          if (event.message.role === "assistant") {
            const text = textFromMessage(event.message);
            const calls = toolCallsFromMessage(event.message);
            if (calls.length > 0) toolCalls = [...toolCalls, ...calls];
            if (text) finalText = text;
            if (typeof event.message.errorMessage === "string" && event.message.errorMessage.trim()) {
              assistantError = event.message.errorMessage.trim();
            }
            onUpdate?.({
              content: [{ type: "text", text: finalText || "(running...)" }],
              details: { ...detailsBase(), exitCode: 0, messages: messageCount, toolCalls },
            });
          }
        }
      };

      proc.stdout.on("data", (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        closed = true;
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);
        finish(code ?? 0);
      });

      proc.on("error", (error) => {
        stderr += error instanceof Error ? error.message : String(error);
        finish(1);
      });

      const kill = () => {
        aborted = true;
        proc.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (!closed) proc.kill("SIGKILL");
        }, 3000);
      };

      if (signal) {
        if (signal.aborted) kill();
        else {
          signal.addEventListener("abort", kill, { once: true });
          removeAbortListener = () => signal.removeEventListener("abort", kill);
        }
      }
    });

    const details: SimpleSubagentDetails = {
      ...detailsBase(),
      exitCode,
      messages: messageCount,
      toolCalls,
      ...(stderr.trim() ? { stderr: stderr.trim() } : {}),
    };

    if (aborted) {
      return {
        isError: true,
        content: [{ type: "text", text: "Subagent was aborted." }],
        details,
      };
    }

    if (exitCode !== 0 || assistantError) {
      const reason = assistantError || stderr.trim() || `Subagent exited with code ${exitCode}.`;
      return {
        isError: true,
        content: [{ type: "text", text: reason }],
        details,
      };
    }

    return {
      content: [{ type: "text", text: finalText || "(subagent finished without assistant text)" }],
      details,
    };
  } finally {
    cleanupTempDir(taskArg.tempDir);
  }
}
