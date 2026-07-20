import { describe, expect, it, vi } from "vitest";
import registerSimpleSubagents from "../src/index.js";
import {
  SUBAGENT_FIRST_GUIDANCE,
  SUBAGENT_SKILL_NAME,
  SUBAGENT_TOOL_PROMPT_GUIDELINES,
  SUBAGENT_TOOL_PROMPT_SNIPPET,
} from "../src/subagent-guidance.js";

type Handler = (...args: any[]) => any;

type Harness = ReturnType<typeof createHarness>;

function createContext() {
  return {
    cwd: "/tmp/project",
    waitForIdle: vi.fn(async () => {}),
    ui: { notify: vi.fn() },
  };
}

function createHarness(initialTools = ["read", "bash", "subagent"]) {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, any>();
  const tools = new Map<string, any>();
  const eventHandlers = new Map<string, Handler[]>();
  let activeTools = [...initialTools];

  const pi = {
    on(name: string, handler: Handler) {
      const registered = handlers.get(name) ?? [];
      registered.push(handler);
      handlers.set(name, registered);
    },
    registerCommand(name: string, command: any) {
      commands.set(name, command);
    },
    registerTool(tool: any) {
      tools.set(tool.name, tool);
    },
    getActiveTools() {
      return [...activeTools];
    },
    setActiveTools(names: string[]) {
      activeTools = [...names];
    },
    events: {
      on(name: string, handler: Handler) {
        const registered = eventHandlers.get(name) ?? [];
        registered.push(handler);
        eventHandlers.set(name, registered);
        return () => {
          eventHandlers.set(name, (eventHandlers.get(name) ?? []).filter((candidate) => candidate !== handler));
        };
      },
      emit(name: string, data: unknown) {
        for (const handler of eventHandlers.get(name) ?? []) handler(data);
      },
    },
  };

  const previousChildValue = process.env.PI_SIMPLE_SUBAGENT_CHILD;
  delete process.env.PI_SIMPLE_SUBAGENT_CHILD;
  try {
    registerSimpleSubagents(pi as any);
  } finally {
    if (previousChildValue === undefined) delete process.env.PI_SIMPLE_SUBAGENT_CHILD;
    else process.env.PI_SIMPLE_SUBAGENT_CHILD = previousChildValue;
  }

  return {
    commands,
    tools,
    get activeTools() {
      return [...activeTools];
    },
    async runHandler(name: string, event: unknown, ctx = createContext()) {
      let result: unknown;
      for (const handler of handlers.get(name) ?? []) result = await handler(event, ctx);
      return result;
    },
    emit(name: string, data: unknown) {
      pi.events.emit(name, data);
    },
    setActiveTools(names: string[]) {
      activeTools = [...names];
    },
    eventHandlerCount(name: string) {
      return eventHandlers.get(name)?.length ?? 0;
    },
  };
}

async function start(harness: Harness, reason = "startup") {
  await harness.runHandler("session_start", { reason });
}

describe("extension opt-in state", () => {
  it("starts with the tool, guidance, and explicit skill command disabled", async () => {
    const harness = createHarness();
    await start(harness);

    expect(harness.activeTools).toEqual(["read", "bash"]);

    const inputResult = await harness.runHandler("input", {
      text: `/skill:${SUBAGENT_SKILL_NAME}`,
      source: "interactive",
    });
    expect(inputResult).toEqual({ action: "handled" });

    const toolCallResult = await harness.runHandler("tool_call", {
      toolName: "subagent",
      input: { task: "test" },
    });
    expect(toolCallResult).toEqual({
      block: true,
      reason: "subagent is disabled while /subagents is off.",
    });

    const systemPromptOptions = {
      selectedTools: ["read", "subagent"],
      toolSnippets: { read: "Read files", subagent: SUBAGENT_TOOL_PROMPT_SNIPPET },
      promptGuidelines: ["Keep changes small", ...SUBAGENT_TOOL_PROMPT_GUIDELINES],
      skills: [{ name: "other" }, { name: SUBAGENT_SKILL_NAME }],
    };
    const promptResult = await harness.runHandler("before_agent_start", {
      systemPrompt: `Base prompt\n\n${SUBAGENT_FIRST_GUIDANCE}`,
      systemPromptOptions,
    }) as { systemPrompt: string };

    expect(promptResult.systemPrompt).not.toContain("Subagent-first workflow");
    expect(systemPromptOptions.selectedTools).toEqual(["read"]);
    expect(systemPromptOptions.skills).toEqual([{ name: "other" }]);

    const tool = harness.tools.get("subagent");
    await expect(tool.execute(
      "call-id",
      { task: "stale call" },
      new AbortController().signal,
      undefined,
      { cwd: "/tmp/project" },
    )).rejects.toThrow("subagent is disabled while /subagents is off.");
  });

  it("activates with /subagents on and starts a replacement runtime in off mode", async () => {
    const harness = createHarness();
    const ctx = createContext();
    await start(harness);

    await harness.commands.get("subagents").handler("on", ctx);
    expect(ctx.waitForIdle).toHaveBeenCalledOnce();
    expect(harness.activeTools).toEqual(["read", "bash", "subagent"]);

    const inputResult = await harness.runHandler("input", {
      text: `/skill:${SUBAGENT_SKILL_NAME}`,
      source: "interactive",
    });
    expect(inputResult).toEqual({ action: "continue" });

    const promptResult = await harness.runHandler("before_agent_start", {
      systemPrompt: "Base prompt",
      systemPromptOptions: {},
    }) as { systemPrompt: string };
    expect(promptResult.systemPrompt).toContain(SUBAGENT_FIRST_GUIDANCE);

    await harness.runHandler("session_shutdown", { reason: "reload" });
    expect(harness.activeTools).toEqual(["read", "bash"]);
    expect(harness.eventHandlerCount("opt-in-tools:state")).toBe(0);

    const replacement = createHarness();
    await start(replacement, "reload");
    expect(replacement.activeTools).toEqual(["read", "bash"]);
  });

  it("keeps opt-in tool state synchronized while entering and leaving super mode", async () => {
    const harness = createHarness(["read", "bash", "subagent", "herdr_agents", "herdr_ask"]);
    const ctx = createContext();
    await start(harness);

    await harness.commands.get("subagents").handler("super", ctx);
    expect(harness.activeTools).toEqual(["subagent"]);

    harness.emit("opt-in-tools:state", {
      source: "herdr-a2a",
      active: false,
      toolNames: ["herdr_agents", "herdr_ask"],
    });
    await harness.commands.get("subagents").handler("off", ctx);
    expect(harness.activeTools).toEqual(["read", "bash"]);

    await harness.commands.get("subagents").handler("super", ctx);
    // Opt-in extensions activate their tools before announcing the new state.
    harness.setActiveTools(["subagent", "herdr_agents", "herdr_ask"]);
    harness.emit("opt-in-tools:state", {
      source: "herdr-a2a",
      active: true,
      toolNames: ["herdr_agents", "herdr_ask"],
    });
    expect(harness.activeTools).toEqual(["subagent"]);

    await harness.commands.get("subagents").handler("off", ctx);
    expect(harness.activeTools).toEqual(["read", "bash", "herdr_agents", "herdr_ask"]);
  });
});
