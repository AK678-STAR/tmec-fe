export type DemoScenario = "ADMISSION_PENDING" | "RACE_READY";
export type DemoArgs = {
  scenario: DemoScenario;
  horseName: string;
  ownerId: string;
};
export type DemoReceipt = {
  generationId: string;
  scenario: DemoScenario;
  status: "CREATED";
  createdAt: string;
  horseId: string;
  records: { entity: string; ids: string[] }[];
  links: { label: string; path: string }[];
  warnings: string[];
};
export type DemoContext = {
  serverTime: string;
  timeZone: string;
  availableStalls: number;
  aiConfigured: boolean;
  owners: { id: string; fullName: string }[];
  defaultOwnerId?: string;
  recipes: {
    id: DemoScenario;
    title: string;
    description: string;
    reason?: string;
  }[];
};
export type DemoRequest = {
  message: string;
  generationId: string;
  sessionNonce: string;
  ownerId?: string;
  contextRead?: boolean;
  completed?: boolean;
};
export type DemoEnvelope = DemoArgs & {
  generationId: string;
  sessionNonce: string;
  permit: string;
};
export type DemoChatReply = {
  status: "NEEDS_INPUT" | "TOOL_CALL" | "ANSWER" | "BLOCKED";
  message?: string;
  tool?: {
    name: "demo_get_context" | "demo_create_scenario";
    args: Record<string, unknown>;
  };
  permit?: string;
  receipt?: DemoReceipt;
};
export type NativeTool = {
  name: string;
  origin: string;
  source?: unknown;
  window?: unknown;
  inputSchema: unknown;
};
export type NativeToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  execute: (
    args: unknown,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
  annotations: { readOnlyHint: boolean };
};
export type NativeContext = {
  registerTool: (
    tool: NativeToolDefinition,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
  getTools: () => Promise<NativeTool[]>;
  executeTool: (
    tool: NativeTool,
    args: object,
    options?: { signal: AbortSignal },
  ) => Promise<string>;
};
