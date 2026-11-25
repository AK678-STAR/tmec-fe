import type {
  DemoContext,
  DemoEnvelope,
  DemoReceipt,
  DemoTimeArgs,
  NativeContext,
} from "./demo-data.types.ts";
import {
  DEMO_TOOL_SCHEMAS,
  validateDemoArgs,
  validateDemoTimeArgs,
} from "./demo-webmcp.client.ts";

async function preserveApiFailure<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ApiError") throw error;
    const failure = error as Error & { code?: string; status?: number };
    return {
      status: "ERROR",
      code: failure.code ?? "DEMO_TOOL_FAILED",
      message:
        failure.status && failure.status >= 500
          ? "Máy chủ chưa hoàn tất yêu cầu. Kiểm tra biên nhận trước khi thử lại."
          : failure.message.slice(0, 1000),
    };
  }
}

export async function registerDemoTools(
  context: NativeContext,
  api: {
    context: () => Promise<DemoContext>;
    create: (envelope: DemoEnvelope) => Promise<DemoReceipt>;
    setTime?: (args: DemoTimeArgs) => Promise<{ activeDate: string | null }>;
  },
  signal: AbortSignal,
) {
  let authorized: DemoEnvelope | null = null;
  const check = (execution?: AbortSignal) => {
    signal.throwIfAborted();
    execution?.throwIfAborted();
  };
  await context.registerTool(
    {
      name: "demo_get_context",
      description:
        "Đọc catalog và khả năng tạo bộ mẫu local; không thay đổi dữ liệu.",
      inputSchema: DEMO_TOOL_SCHEMAS.demo_get_context,
      annotations: { readOnlyHint: true },
      execute: async (args, options) => {
        check(options?.signal);
        if (
          !args ||
          typeof args !== "object" ||
          Array.isArray(args) ||
          Object.keys(args).length
        )
          throw new Error("Context không nhận tham số.");
        return preserveApiFailure(() => api.context());
      },
    },
    { signal },
  );
  check();
  await context.registerTool(
    {
      name: "demo_create_scenario",
      description:
        "Tạo một bộ mẫu local theo đúng yêu cầu chat đã được cấp quyền. Không sửa dữ liệu cũ, không đăng ký thi đấu hoặc thanh toán.",
      inputSchema: DEMO_TOOL_SCHEMAS.demo_create_scenario,
      annotations: { readOnlyHint: false },
      execute: async (input, options) => {
        check(options?.signal);
        const args = validateDemoArgs(input);
        const permit = authorized;
        if (
          !permit ||
          args.scenario !== permit.scenario ||
          args.horseName !== permit.horseName ||
          args.ownerId !== permit.ownerId
        )
          throw new Error("Chưa có quyền cho yêu cầu tạo bộ mẫu này.");
        authorized = null;
        // The secret permit stays in this closure, outside tool metadata and model-visible arguments.
        return preserveApiFailure(() => api.create(permit));
      },
    },
    { signal },
  );
  if (api.setTime) {
    const applyTime = api.setTime;
    check();
    await context.registerTool(
      {
        name: "demo_set_time",
        description:
          "Điều chỉnh ngày giờ mô phỏng (Time Travel) cho Frontend và Backend dev local.",
        inputSchema: DEMO_TOOL_SCHEMAS.demo_set_time,
        annotations: { readOnlyHint: false },
        execute: async (input, options) => {
          check(options?.signal);
          const args = validateDemoTimeArgs(input);
          return preserveApiFailure(() => applyTime(args));
        },
      },
      { signal },
    );
  }
  return {
    authorize: (envelope: DemoEnvelope) => {
      check();
      authorized = envelope;
    },
    clear: () => {
      authorized = null;
    },
  };
}
