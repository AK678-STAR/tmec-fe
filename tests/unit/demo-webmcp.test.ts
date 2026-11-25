import { registerDemoTools } from "../../src/features/demo-data/demo-webmcp.tools.ts";
import type { NativeToolDefinition } from "../../src/features/demo-data/demo-data.types.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createInPageWebMcpBridge,
  DEMO_TOOL_SCHEMAS,
  executeDemoTool,
  requireWebMcp,
  resolveWebMcpRuntime,
} from "../../src/features/demo-data/demo-webmcp.client.ts";

// Deterministic client tests; these are not evidence of native browser support.
test("missing or partial native capability is blocked", () => {
  assert.throws(() => requireWebMcp(undefined), /WebMCP/);
  assert.throws(() => requireWebMcp({ registerTool() {} }), /WebMCP/);
});

test("uses the discovered native Tool object and returns parsed output", async () => {
  const source = {};
  const tool = {
    name: "demo_get_context",
    origin: "http://localhost",
    source,
    inputSchema: DEMO_TOOL_SCHEMAS.demo_get_context,
  };
  let calls = 0;
  const context = {
    registerTool() {},
    async getTools() {
      return [tool];
    },
    async executeTool(actual: unknown, input: unknown) {
      calls++;
      assert.equal(actual, tool);
      assert.deepEqual(input, {});
      return '{"availableStalls":2}';
    },
  };
  const result = await executeDemoTool(
    requireWebMcp(context),
    "demo_get_context",
    {},
    new AbortController().signal,
    { origin: "http://localhost", source },
  );
  assert.deepEqual(result, { availableStalls: 2 });
  assert.equal(calls, 1);
});

test("refuses untrusted tools, frames, schemas and removed registrations", async () => {
  const source = {};
  const tool = {
    name: "demo_get_context",
    origin: "http://localhost",
    source,
    inputSchema: DEMO_TOOL_SCHEMAS.demo_get_context,
  };
  let discovered = [tool];
  const context = requireWebMcp({
    registerTool() {},
    async getTools() {
      return discovered;
    },
    async executeTool() {
      throw new Error("must not execute");
    },
  });
  const signal = new AbortController().signal;
  const identity = { origin: "http://localhost", source };
  await assert.rejects(
    executeDemoTool(context, "run_sql", {}, signal, identity),
  );
  await assert.rejects(
    executeDemoTool(
      context,
      "demo_get_context",
      { sql: "delete" },
      signal,
      identity,
    ),
  );
  await assert.rejects(
    executeDemoTool(context, "demo_get_context", {}, signal, {
      ...identity,
      source: {},
    }),
  );
  discovered = [{ ...tool, inputSchema: { type: "string" } }];
  await assert.rejects(
    executeDemoTool(context, "demo_get_context", {}, signal, identity),
  );
  discovered = [];
  await assert.rejects(
    executeDemoTool(context, "demo_get_context", {}, signal, identity),
  );
});

test("an aborted session cannot discover or execute another tool", async () => {
  const controller = new AbortController();
  controller.abort();
  const context = requireWebMcp({
    registerTool() {},
    getTools() {
      throw new Error("must not discover");
    },
    executeTool() {
      throw new Error("must not execute");
    },
  });
  await assert.rejects(
    executeDemoTool(context, "demo_get_context", {}, controller.signal, {
      origin: "http://localhost",
      source: {},
    }),
    { name: "AbortError" },
  );
});

test("accepts equivalent schemas after native discovery reorders JSON object keys", async () => {
  const source = {};
  const tool = {
    name: "demo_get_context",
    origin: "http://localhost",
    source,
    inputSchema: {
      additionalProperties: false,
      properties: {},
      type: "object",
    },
  };
  const context = requireWebMcp({
    registerTool() {},
    async getTools() {
      return [tool];
    },
    async executeTool() {
      return "{}";
    },
  });
  await assert.doesNotReject(
    executeDemoTool(
      context,
      "demo_get_context",
      {},
      new AbortController().signal,
      { origin: "http://localhost", source },
    ),
  );
});

test("supports the verified Edge Tool.window attribute and still rejects foreign frames", async () => {
  const source = {};
  let tool: Record<string, unknown> = {
    name: "demo_get_context",
    origin: "http://localhost",
    window: source,
    inputSchema: DEMO_TOOL_SCHEMAS.demo_get_context,
  };
  const context = requireWebMcp({
    registerTool() {},
    async getTools() {
      return [tool];
    },
    async executeTool() {
      return "{}";
    },
  });
  const signal = new AbortController().signal;
  const identity = { origin: "http://localhost", source };
  await assert.doesNotReject(
    executeDemoTool(context, "demo_get_context", {}, signal, identity),
  );
  tool = { ...tool, window: {} };
  await assert.rejects(
    executeDemoTool(context, "demo_get_context", {}, signal, identity),
  );
  tool = { ...tool, source: {}, window: source };
  await assert.rejects(
    executeDemoTool(context, "demo_get_context", {}, signal, identity),
  );
});

test("surfaces a structured API failure returned by a native tool", async () => {
  const source = {};
  const tool = {
    name: "demo_get_context",
    origin: "http://localhost",
    source,
    inputSchema: DEMO_TOOL_SCHEMAS.demo_get_context,
  };
  const context = requireWebMcp({
    registerTool() {},
    async getTools() {
      return [tool];
    },
    async executeTool() {
      return JSON.stringify({
        status: "ERROR",
        code: "RESOURCE_UNAVAILABLE",
        message: "Không còn ô chuồng trống.",
      });
    },
  });
  await assert.rejects(
    executeDemoTool(
      context,
      "demo_get_context",
      {},
      new AbortController().signal,
      { origin: "http://localhost", source },
    ),
    /Không còn ô chuồng trống/,
  );
});

test("tool callback preserves safe API errors and does not expose its permit in metadata", async () => {
  const definitions: NativeToolDefinition[] = [];
  const context = requireWebMcp({
    registerTool(tool: NativeToolDefinition) {
      definitions.push(tool);
    },
    async getTools() {
      return [];
    },
    async executeTool() {
      return "{}";
    },
  });
  const fail = async () => {
    throw Object.assign(new Error("Không còn ô chuồng trống."), {
      name: "ApiError",
      code: "RESOURCE_UNAVAILABLE",
    });
  };
  const runtime = await registerDemoTools(
    context,
    { context: fail, create: fail },
    new AbortController().signal,
  );
  const args = {
    scenario: "ADMISSION_PENDING" as const,
    horseName: "Sao Mai",
    ownerId: "610f5bf0-60a9-4e6c-9589-2385b1af33b1",
  };
  runtime.authorize({
    ...args,
    generationId: "e5181ae8-803e-417a-ad24-a4327d68e945",
    sessionNonce: "0f4a304f-e688-4fe3-a4cd-76fa8f3d8759",
    permit: "unit-only-private-permit",
  });
  assert.equal(
    JSON.stringify(definitions).includes("unit-only-private-permit"),
    false,
  );
  const callback = definitions.find(
    (tool) => tool.name === "demo_create_scenario",
  )!.execute;
  assert.deepEqual(await callback(args), {
    status: "ERROR",
    code: "RESOURCE_UNAVAILABLE",
    message: "Không còn ô chuồng trống.",
  });
});

test("resolveWebMcpRuntime selects native when complete and falls back to in-page bridge otherwise", () => {
  const nativeCandidate = {
    registerTool() {},
    async getTools() {
      return [];
    },
    async executeTool() {
      return "{}";
    },
  };
  const nativeResolved = resolveWebMcpRuntime(nativeCandidate, {
    origin: "http://localhost:5173",
    source: {},
  });
  assert.equal(nativeResolved.mode, "native");
  assert.equal(nativeResolved.context, nativeCandidate);

  const bridgeResolved = resolveWebMcpRuntime(undefined, {
    origin: "http://localhost:5173",
    source: {},
  });
  assert.equal(bridgeResolved.mode, "bridge");
});

test("in-page WebMCP bridge executes registered tools and unregisters on abort", async () => {
  const source = {};
  const origin = "http://localhost:5173";
  const bridge = createInPageWebMcpBridge({ origin, source });
  const controller = new AbortController();
  const args = {
    scenario: "ADMISSION_PENDING" as const,
    horseName: "Sao Mai",
    ownerId: "610f5bf0-60a9-4e6c-9589-2385b1af33b1",
  };

  let createdWithPermit = "";
  const tools = await registerDemoTools(
    bridge,
    {
      context: async () => ({
        serverTime: "2026-11-25T07:00:00.000Z",
        timeZone: "Asia/Ho_Chi_Minh",
        availableStalls: 2,
        aiConfigured: true,
        owners: [{ id: args.ownerId, fullName: "Chủ ngựa mẫu" }],
        recipes: [],
      }),
      create: async (envelope) => {
        createdWithPermit = envelope.permit;
        return {
          generationId: envelope.generationId,
          scenario: envelope.scenario,
          status: "CREATED",
          createdAt: "2026-11-25T07:00:00.000Z",
          horseId: envelope.generationId,
          records: [{ entity: "Horse", ids: [envelope.generationId] }],
          links: [],
          warnings: [],
        };
      },
    },
    controller.signal,
  );

  tools.authorize({
    ...args,
    generationId: "e5181ae8-803e-417a-ad24-a4327d68e945",
    sessionNonce: "0f4a304f-e688-4fe3-a4cd-76fa8f3d8759",
    permit: "bridge-secret-permit",
  });

  const receipt = await executeDemoTool(
    bridge,
    "demo_create_scenario",
    args,
    controller.signal,
    { origin, source },
  );
  assert.equal(createdWithPermit, "bridge-secret-permit");
  assert.equal((receipt as { status: string }).status, "CREATED");

  controller.abort();
  assert.deepEqual(await bridge.getTools(), []);
});
