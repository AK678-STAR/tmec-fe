import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

test("@capability native WebMCP registers, discovers, executes and unregisters a tool", async ({
  page,
  browser,
}, testInfo) => {
  // A controlled local document isolates browser capability from login and application state.
  await page.route("**/__demo_webmcp_probe__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="vi"><title>WebMCP capability</title><body>Kiểm tra WebMCP</body></html>',
    }),
  );
  await page.goto("/__demo_webmcp_probe__");
  const result = await page.evaluate(async () => {
    type NativeTool = { name: string };
    type NativeContext = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          execute: (input: { message: string }) => { message: string };
        },
        options: { signal: AbortSignal },
      ) => Promise<void>;
      getTools: () => Promise<NativeTool[]>;
      executeTool: (
        tool: NativeTool,
        input: { message: string },
      ) => Promise<string>;
    };
    const context = (document as Document & { modelContext?: NativeContext })
      .modelContext;
    const legacy = (navigator as Navigator & { modelContext?: object })
      .modelContext;
    const methods = ["registerTool", "getTools", "executeTool"] as const;
    const missing = methods.filter(
      (name) => typeof context?.[name] !== "function",
    );
    const capability = {
      secureContext: isSecureContext,
      documentModelContext: Boolean(context),
      navigatorModelContext: Boolean(legacy),
      methods: Object.fromEntries(
        methods.map((name) => [name, typeof context?.[name]]),
      ),
      missing,
    };
    if (missing.length || !context) return { status: "BLOCKED", capability };
    const registration = new AbortController();
    const name = "demo_capability_echo";
    let calls = 0;
    try {
      await context.registerTool(
        {
          name,
          description:
            "Echo a fixed capability-test message without data or network access.",
          inputSchema: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
            additionalProperties: false,
          },
          execute: ({ message }) => {
            calls += 1;
            return { message };
          },
        },
        { signal: registration.signal },
      );
      const tool = (await context.getTools()).find(
        (item) => item.name === name,
      );
      if (!tool)
        throw new Error("Native discovery did not return the registered tool");
      const metadata = tool as unknown as {
        origin: string;
        source?: unknown;
        window?: unknown;
        inputSchema: unknown;
      };
      const toolSnapshot = {
        origin: metadata.origin,
        windowExists: "window" in tool,
        windowMatches: metadata.window === window,
        sourceExists: "source" in tool,
        sourceType: typeof metadata.source,
        sourceIsNull: metadata.source === null,
        sourceMatches: metadata.source === window,
        inputSchema: metadata.inputSchema,
        attributes: Object.getOwnPropertyNames(Object.getPrototypeOf(tool)),
      };
      const output = await context.executeTool(tool, {
        message: "demo-webmcp-ok",
      });
      registration.abort();
      const removed = !(await context.getTools()).some(
        (item) => item.name === name,
      );
      return {
        status: "SUPPORTED",
        capability,
        output,
        calls,
        removed,
        toolSnapshot,
      };
    } catch (error) {
      return {
        status: "BLOCKED",
        capability,
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      };
    } finally {
      registration.abort();
    }
  });
  const evidence = {
    checkedAt: new Date().toISOString(),
    project: testInfo.project.name,
    browserVersion: browser.version(),
    experimentalFlags: testInfo.project.use.launchOptions?.args ?? [],
    ...result,
  };
  const evidenceDir = resolve("..", "tmp", "demo-data-chat", "t0");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    resolve(evidenceDir, `${testInfo.project.name}.json`),
    JSON.stringify(evidence, null, 2),
  );
  await testInfo.attach("native-webmcp-capability", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  expect(result.status, JSON.stringify(evidence)).toBe("SUPPORTED");
  if (result.status === "SUPPORTED") {
    expect(JSON.parse(result.output!)).toEqual({ message: "demo-webmcp-ok" });
    expect(result.calls).toBe(1);
    expect(
      result.toolSnapshot!.sourceMatches || result.toolSnapshot!.windowMatches,
    ).toBe(true);
    expect(result.removed).toBe(true);
  }
});

async function openManagerToolkit(page: import("@playwright/test").Page) {
  const source = readFileSync(
    resolve("src/shared/components/DemoMagicToolkit.tsx"),
    "utf8",
  );
  const password =
    process.env.DEMO_TEST_PASSWORD ??
    source.match(/await login\(email, "([^"]+)"/)?.[1];
  if (!password)
    throw new Error(
      "Configure the existing demo manager password before UI checks",
    );
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(process.env.DEMO_TEST_EMAIL ?? "manager@gmail.com");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 20_000,
  });
  await page
    .getByRole("button", { name: "Nút Thần Thánh", exact: true })
    .click();
}

test("@ui manager opens a Vietnamese chat panel inside the existing Toolkit", async ({
  page,
}) => {
  await openManagerToolkit(page);
  await page.screenshot({
    path: resolve("../tmp/demo-data-chat/t6/toolkit-before-or-after.png"),
  });
  await page
    .getByRole("button", { name: "Trợ lý tạo dữ liệu mẫu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị dữ liệu mẫu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Thời gian thật", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByLabel("Yêu cầu tạo bộ mẫu", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve("../tmp/demo-data-chat/t6/panel.png"),
    fullPage: true,
  });
});

test("@native-agent creates one pending admission through Gemini, native WebMCP and local DB", async ({
  page,
}) => {
  test.skip(
    process.env.DEMO_ALLOW_DB_WRITE !== "true",
    "Set explicit local fixture-write opt-in to run the real-provider scenario",
  );
  test.setTimeout(100_000);
  const targetApi = process.env.DEMO_TEST_API_URL;
  if (targetApi) {
    const target = new URL(targetApi);
    if (
      target.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(target.hostname)
    )
      throw new Error("Fixture API must be local");
    await page.route("**/api/demo-data/**", async (route) => {
      const original = new URL(route.request().url());
      original.host = target.host;
      await route.continue({ url: original.toString() });
    });
  }
  const evidence: {
    requests: { method: string; path: string }[];
    chat: { status?: string; tool?: string; code?: string }[];
  } = { requests: [], chat: [] };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/demo-data/"))
      evidence.requests.push({ method: request.method(), path });
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/demo-data/chat") {
      void response
        .json()
        .then((body) => {
          evidence.chat.push({
            status: body?.data?.status,
            tool: body?.data?.tool?.name,
            code: body?.code,
          });
        })
        .catch(() => {});
    }
  });
  await openManagerToolkit(page);
  const fontBefore = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  await page
    .getByRole("button", { name: "Trợ lý tạo dữ liệu mẫu", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Chuẩn bị dữ liệu mẫu",
    exact: true,
  });
  const owner = panel.getByLabel("Chủ ngựa", { exact: true });
  await expect(owner.locator("option")).not.toHaveCount(1, { timeout: 15_000 });
  await owner.selectOption({ index: 1 });
  const horseName = `Sao Mai ${Date.now()}`;
  await panel
    .getByLabel("Yêu cầu tạo bộ mẫu", { exact: true })
    .fill(`Tạo một ngựa chờ tiếp nhận tên ${horseName}`);
  await panel.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click();
  const receipt = panel.getByRole("article", { name: "Biên nhận tạo mẫu" });
  try {
    await expect(receipt.or(panel.getByRole("alert")).first()).toBeVisible({
      timeout: 70_000,
    });
    if (await panel.getByRole("alert").isVisible())
      throw new Error(await panel.getByRole("alert").innerText());
    await expect(receipt).toBeVisible();
  } catch (error) {
    const folder = resolve("../tmp/demo-data-chat/cp1");
    await mkdir(folder, { recursive: true });
    await writeFile(
      resolve(folder, "failed-attempt.json"),
      JSON.stringify(
        {
          ...evidence,
          panelText: await panel.innerText(),
          writesRequested: evidence.requests.filter(
            (item) =>
              item.method === "POST" &&
              item.path === "/api/demo-data/scenarios",
          ).length,
        },
        null,
        2,
      ),
    );
    throw error;
  }
  const text = await receipt.innerText();
  const generationId = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  )?.[0];
  expect(generationId).toBeTruthy();
  const partialOut = resolve("../tmp/demo-data-chat/cp1");
  await mkdir(partialOut, { recursive: true });
  await writeFile(
    resolve(partialOut, "result.json"),
    JSON.stringify(
      {
        ...evidence,
        generationId,
        horseName: `DEMO ${horseName}`,
        receiptText: text,
        status: "CREATED_UI_VERIFICATION_PENDING",
      },
      null,
      2,
    ),
  );
  await expect(page).toHaveURL(new RegExp(`/horses/${generationId}$`));
  await expect(
    page.getByRole("heading", { name: `DEMO ${horseName}`, exact: true }),
  ).toBeVisible();
  const fontAfter = await panel.evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(fontAfter).toBe(fontBefore);
  expect(
    evidence.chat.some(
      (item) =>
        item.status === "TOOL_CALL" && item.tool === "demo_create_scenario",
    ),
  ).toBe(true);
  expect(
    evidence.requests.filter(
      (item) =>
        item.method === "POST" && item.path === "/api/demo-data/scenarios",
    ),
  ).toHaveLength(1);
  const out = resolve("../tmp/demo-data-chat/cp1");
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: resolve(out, "created-admission.png"),
    fullPage: true,
  });
  await writeFile(
    resolve(out, "result.json"),
    JSON.stringify(
      {
        ...evidence,
        generationId,
        horseName: `DEMO ${horseName}`,
        actualPath: new URL(page.url()).pathname,
        receiptText: text,
        fontBefore,
        fontAfter,
        provider: "real configured Gemini",
        webmcp:
          "native Edge experimental; production client and registered callbacks",
        database: "local PostgreSQL through production DemoDataModule",
      },
      null,
      2,
    ),
  );
});

test("@native-agent @cp2 creates one race-ready horse through Gemini, native WebMCP and local DB", async ({
  page,
}) => {
  test.skip(
    process.env.DEMO_ALLOW_DB_WRITE !== "true",
    "Set explicit local fixture-write opt-in to run the real-provider scenario",
  );
  test.setTimeout(120_000);
  const targetApi = process.env.DEMO_TEST_API_URL;
  if (targetApi) {
    const target = new URL(targetApi);
    if (
      target.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(target.hostname)
    )
      throw new Error("Fixture API must be local");
    await page.route("**/api/demo-data/**", async (route) => {
      const original = new URL(route.request().url());
      original.host = target.host;
      await route.continue({ url: original.toString() });
    });
  }
  const evidence: {
    requests: { method: string; path: string }[];
    chat: { status?: string; tool?: string; code?: string }[];
  } = { requests: [], chat: [] };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/demo-data/"))
      evidence.requests.push({ method: request.method(), path });
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/demo-data/chat") {
      void response
        .json()
        .then((body) => {
          evidence.chat.push({
            status: body?.data?.status,
            tool: body?.data?.tool?.name,
            code: body?.code,
          });
        })
        .catch(() => {});
    }
  });
  await openManagerToolkit(page);
  const fontBefore = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  await page
    .getByRole("button", { name: "Trợ lý tạo dữ liệu mẫu", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Chuẩn bị dữ liệu mẫu",
    exact: true,
  });
  const owner = panel.getByLabel("Chủ ngựa", { exact: true });
  await expect(owner.locator("option")).not.toHaveCount(1, { timeout: 15_000 });
  await owner.selectOption({ index: 1 });
  const horseName = `Phong Van ${Date.now()}`;
  await panel
    .getByLabel("Yêu cầu tạo bộ mẫu", { exact: true })
    .fill(`Tạo một ngựa sẵn sàng thi đấu tên ${horseName}`);
  await panel.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click();
  const receipt = panel.getByRole("article", { name: "Biên nhận tạo mẫu" });
  const folder = resolve("../tmp/demo-data-chat/cp2");
  await mkdir(folder, { recursive: true });
  try {
    await expect(receipt.or(panel.getByRole("alert")).first()).toBeVisible({
      timeout: 80_000,
    });
    if (await panel.getByRole("alert").isVisible())
      throw new Error(await panel.getByRole("alert").innerText());
    await expect(receipt).toBeVisible();
  } catch (error) {
    await writeFile(
      resolve(folder, "failed-attempt.json"),
      JSON.stringify(
        {
          ...evidence,
          panelText: await panel.innerText(),
          writesRequested: evidence.requests.filter(
            (item) =>
              item.method === "POST" &&
              item.path === "/api/demo-data/scenarios",
          ).length,
        },
        null,
        2,
      ),
    );
    throw error;
  }
  const text = await receipt.innerText();
  const generationId = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  )?.[0];
  expect(generationId).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`/horses/${generationId}$`));
  await expect(
    page.getByRole("heading", { name: `DEMO ${horseName}`, exact: true }),
  ).toBeVisible();
  const fontAfter = await panel.evaluate(
    (element) => getComputedStyle(element).fontFamily,
  );
  expect(fontAfter).toBe(fontBefore);
  expect(
    evidence.chat.some(
      (item) =>
        item.status === "TOOL_CALL" && item.tool === "demo_create_scenario",
    ),
  ).toBe(true);
  expect(
    evidence.requests.filter(
      (item) =>
        item.method === "POST" && item.path === "/api/demo-data/scenarios",
    ),
  ).toHaveLength(1);
  expect(text).toContain("Giải đấu mẫu");
  expect(text).toContain("Giáo án mẫu");
  expect(text).toContain("Buổi tập mẫu");
  expect(text).toContain("Bệnh án mẫu");
  expect(text).toContain("Phân bổ chuồng");
  await page.screenshot({
    path: resolve(folder, "created-race-ready.png"),
    fullPage: true,
  });

  // Open the /races destination from receipt without registering or paying
  const racesLink = receipt.locator('a[href="/races"]');
  await expect(racesLink).toBeVisible();
  await racesLink.click();
  await expect(page).toHaveURL(/\/races$/);
  await page.screenshot({
    path: resolve(folder, "races-page.png"),
    fullPage: true,
  });

  // Verify receipt recovery after reload with pointer intact (no duplicate write)
  await page.reload({ waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Nút Thần Thánh", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Trợ lý tạo dữ liệu mẫu", exact: true })
    .click();
  const recoveredReceipt = page
    .getByRole("region", { name: "Chuẩn bị dữ liệu mẫu", exact: true })
    .getByRole("article", { name: "Biên nhận tạo mẫu" });
  await expect(recoveredReceipt).toBeVisible({ timeout: 15_000 });
  expect(await recoveredReceipt.innerText()).toContain(generationId!);
  expect(
    evidence.requests.filter(
      (item) =>
        item.method === "POST" && item.path === "/api/demo-data/scenarios",
    ),
  ).toHaveLength(1);

  await writeFile(
    resolve(folder, "result.json"),
    JSON.stringify(
      {
        ...evidence,
        generationId,
        horseName: `DEMO ${horseName}`,
        actualPath: `/horses/${generationId}`,
        racesPath: new URL(page.url()).pathname,
        receiptText: text,
        fontBefore,
        fontAfter,
        recoveryVerifiedWithoutDuplicatePost: true,
        provider: "real configured Gemini",
        webmcp:
          "native Edge experimental; production client and registered callbacks",
        database: "local PostgreSQL through production DemoDataModule",
      },
      null,
      2,
    ),
  );
});
