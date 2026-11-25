import type {
  DemoArgs,
  NativeContext,
  NativeTool,
  NativeToolDefinition,
} from "./demo-data.types.ts";

export type WebMcpRuntimeMode = "native" | "bridge";

export const DEMO_TOOL_SCHEMAS = {
  demo_get_context: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  demo_create_scenario: {
    type: "object",
    properties: {
      scenario: { type: "string", enum: ["ADMISSION_PENDING", "RACE_READY"] },
      horseName: { type: "string", minLength: 2, maxLength: 90 },
      ownerId: { type: "string" },
    },
    required: ["scenario", "horseName", "ownerId"],
    additionalProperties: false,
  },
};

export function hasWebMcp(candidate: unknown): candidate is NativeContext {
  const context = candidate as Partial<NativeContext> | undefined;
  return [context?.registerTool, context?.getTools, context?.executeTool].every(
    (method) => typeof method === "function",
  );
}

export function requireWebMcp(candidate: unknown): NativeContext {
  if (!hasWebMcp(candidate)) {
    throw new Error(
      "WEBMCP_UNAVAILABLE: Trình duyệt chưa hỗ trợ đủ WebMCP. Dùng Edge đã kiểm chứng với tính năng thử nghiệm được bật.",
    );
  }
  return candidate;
}

export function createInPageWebMcpBridge(identity: {
  origin: string;
  source: unknown;
}): NativeContext {
  const registry = new Map<
    string,
    { descriptor: NativeTool; definition: NativeToolDefinition }
  >();

  return {
    registerTool(tool, options) {
      options.signal.throwIfAborted();
      const descriptor: NativeTool = {
        name: tool.name,
        origin: identity.origin,
        source: identity.source,
        inputSchema: tool.inputSchema,
      };
      registry.set(tool.name, { descriptor, definition: tool });
      options.signal.addEventListener(
        "abort",
        () => {
          const current = registry.get(tool.name);
          if (current?.descriptor === descriptor) {
            registry.delete(tool.name);
          }
        },
        { once: true },
      );
    },
    async getTools() {
      return Array.from(registry.values(), (entry) => entry.descriptor);
    },
    async executeTool(tool, args, options) {
      options?.signal?.throwIfAborted();
      const entry = registry.get(tool.name);
      if (
        !entry ||
        entry.descriptor !== tool ||
        tool.origin !== identity.origin ||
        ("source" in tool ? tool.source : tool.window) !== identity.source
      ) {
        throw new Error("Tool bridge không khớp đăng ký hiện tại.");
      }
      const result = await entry.definition.execute(args, {
        signal: options?.signal,
      });
      options?.signal?.throwIfAborted();
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  };
}

export function resolveWebMcpRuntime(
  candidate: unknown,
  identity: { origin: string; source: unknown },
): { context: NativeContext; mode: WebMcpRuntimeMode } {
  if (hasWebMcp(candidate)) {
    return { context: candidate, mode: "native" };
  }
  return { context: createInPageWebMcpBridge(identity), mode: "bridge" };
}

export function validateDemoArgs(value: unknown): DemoArgs {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Tham số bộ mẫu không hợp lệ.");
  const args = value as Record<string, unknown>;
  if (
    Object.keys(args).length !== 3 ||
    Object.keys(args).some(
      (key) => !["scenario", "horseName", "ownerId"].includes(key),
    ) ||
    !["ADMISSION_PENDING", "RACE_READY"].includes(String(args.scenario)) ||
    typeof args.horseName !== "string" ||
    args.horseName.length < 2 ||
    args.horseName.length > 90 ||
    !/^[\p{L}\p{N}\s'.-]+$/u.test(args.horseName) ||
    typeof args.ownerId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      args.ownerId,
    )
  ) {
    throw new Error("Tham số bộ mẫu ngoài phạm vi cho phép.");
  }
  return args as DemoArgs;
}

function canonicalSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSchema);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalSchema(child)]),
    );
  return value;
}

export async function executeDemoTool(
  context: NativeContext,
  name: string,
  args: unknown,
  signal: AbortSignal,
  identity: { origin: string; source: unknown },
): Promise<unknown> {
  signal.throwIfAborted();
  if (name !== "demo_get_context" && name !== "demo_create_scenario")
    throw new Error("Tool không được phép.");
  if (name === "demo_create_scenario") validateDemoArgs(args);
  else if (
    !args ||
    typeof args !== "object" ||
    Array.isArray(args) ||
    Object.keys(args).length
  )
    throw new Error("Tool đọc context không nhận tham số.");
  // Edge 158 exposes the registering WindowProxy as window; the newer draft calls it source.
  const matches = (await context.getTools()).filter(
    (tool) =>
      tool.name === name &&
      tool.origin === identity.origin &&
      ("source" in tool ? tool.source : tool.window) === identity.source,
  );
  signal.throwIfAborted();
  if (
    matches.length !== 1 ||
    JSON.stringify(canonicalSchema(matches[0].inputSchema)) !==
      JSON.stringify(canonicalSchema(DEMO_TOOL_SCHEMAS[name]))
  )
    throw new Error(
      "Đăng ký tool không còn hợp lệ. Đóng và mở lại panel trước khi thử lại.",
    );
  const output = await context.executeTool(matches[0], args as object, {
    signal,
  });
  signal.throwIfAborted();
  if (typeof output !== "string" || output.length > 20_000)
    throw new Error("Kết quả tool không hợp lệ.");
  const result = JSON.parse(output) as unknown;
  if (
    result &&
    typeof result === "object" &&
    "status" in result &&
    result.status === "ERROR" &&
    "message" in result &&
    typeof result.message === "string"
  )
    throw new Error(result.message);
  return result;
}
