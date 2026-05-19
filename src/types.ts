export interface SubagentToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface SimpleSubagentDetails {
  exitCode: number;
  cwd: string;
  tools: string[];
  model?: string;
  thinking?: string;
  stderr?: string;
  messages: number;
  toolCalls: SubagentToolCall[];
}

export interface SimpleSubagentParams {
  task: string;
  cwd?: string;
}
