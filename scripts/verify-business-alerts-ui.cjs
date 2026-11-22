// Run after npm run build. Optional CHROMIUM_PATH points to an installed browser. API responses are test fixtures; no real accounts or mail.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(
  require.resolve("playwright", { paths: [process.cwd()] }),
);
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [];
  const posts = [];
  const externalRequests = [];
  let sent = true;
  let staleRoute;
  let staleData;
  let role = "GROOM";
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(12000);
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    if (!pathname.startsWith("/api/")) {
      if (url.hostname !== "tmec.test") {
        externalRequests.push(url.href);
        return route.abort();
      }
      let local = path.join(
        process.cwd(),
        "dist",
        pathname === "/stable/shifts" ||
          pathname === "/tasks" ||
          pathname === "/complaints"
          ? "index.html"
          : pathname,
      );
      if (!fs.existsSync(local))
        local = path.join(process.cwd(), "dist/index.html");
      const ext = path.extname(local);
      return route.fulfill({
        status: 200,
        contentType:
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
          }[ext] || "application/octet-stream",
        body: fs.readFileSync(local),
      });
    }
    let data = [];
    if (req.method() === "POST")
      posts.push({ pathname, body: req.postDataJSON() });
    if (pathname.endsWith("/auth/me"))
      data = {
        id: "user1",
        fullName: "Test Groom",
        email: "test@example.invalid",
        role,
        status: "ACTIVE",
        permissions: { viewHorses: true, viewMedical: true },
        notify: {},
      };
    else if (pathname.endsWith("/shift-rosters/my"))
      data = [
        {
          id: "roster1",
          date: today,
          zone: { id: "zone1", code: "A", name: "Zone A" },
          shift: {
            id: "shift1",
            name: "Afternoon",
            startTime: "23:00",
            endTime: "23:59",
            isOvernight: false,
          },
          assignedHorses: [
            {
              id: "horse1",
              name: "Comet",
              horseCode: "H001",
              isMedicalLocked: true,
            },
          ],
          assignedHorsesCount: 1,
        },
      ];
    else if (pathname.endsWith("/daily-tasks"))
      data = {
        items: [
          {
            id: "task1",
            horseId: "horse1",
            horse: { id: "horse1", name: "Comet", horseCode: "H001" },
            stallZoneId: "zone1",
            stallZone: { id: "zone1", code: "A", name: "Zone A" },
            stall: { id: "stall1", code: "A-01" },
            shiftId: "shift1",
            shift: {
              id: "shift1",
              name: "Afternoon",
              startTime: "23:00",
              endTime: "23:59",
              sortOrder: 1,
            },
            taskType: "MEDICATION",
            title: "Give prescribed medicine",
            scheduledTime: "23:10",
            isCompleted: false,
          },
        ],
        total: 1,
        stats: {
          total: 1,
          completed: 0,
          pending: 1,
          completionRatePct: 0,
          medicalLockedCount: 1,
        },
      };
    else if (pathname.endsWith("/zones"))
      data = [{ id: "zone1", name: "Zone A", code: "A", isActive: true }];
    else if (pathname.endsWith("/complaints/subjects"))
      data = [{ id: "staff1", fullName: "Staff Subject", role: "GROOM" }];
    else if (pathname.endsWith("/complaints"))
      data =
        req.method() === "POST"
          ? { id: "cmp1" }
          : {
              items: [
                {
                  id: "cmp1",
                  code: "CMP-TEST",
                  subjectUserId: "staff1",
                  subject: {
                    id: "staff1",
                    fullName: "Staff Subject",
                    role: "GROOM",
                  },
                  reporterId: role === "CLUB_MANAGER" ? "other" : "user1",
                  reason: "Report from own reporter",
                  status: "OPEN",
                  createdAt: new Date().toISOString(),
                },
              ],
              total: 1,
            };
    else if (pathname.endsWith("/invoices/owner-summary"))
      data = {
        outstandingDebt: 900,
        totalBoarding: 1000,
        totalMedical: 0,
        totalTraining: 0,
        totalExpense: 1000,
        totalPrizeCredit: 100,
        totalNet: 900,
        invoiceCount: 1,
        invoices: [
          {
            id: "inv1",
            horseId: "horse1",
            horse: { id: "horse1", name: "Comet" },
            ownerId: "owner1",
            owner: {
              id: "owner1",
              fullName: "Owner One",
              email: "owner@example.invalid",
            },
            billingPeriod: "2026-10",
            boardingFee: 1000,
            medicalFee: 0,
            trainingFee: 0,
            prizeCredit: 100,
            netAmount: 900,
            status: "SENT",
            dueAt: "2026-12-01",
            createdAt: new Date().toISOString(),
          },
        ],
      };
    else if (pathname.endsWith("/remind")) {
      data = { sent };
      sent = false;
    } else if (pathname.includes("/notifications"))
      data = { items: [], total: 0, unreadCount: 0 };
    if (pathname.endsWith("/daily-tasks")) {
      const horseId = url.searchParams.get("horseId");
      if (horseId && horseId !== "horse1") {
        data.items[0].horseId = horseId;
        data.items[0].horse.id = horseId;
        data.items[0].title = "Medication " + horseId;
      }
      if (horseId === "horse2") {
        staleRoute = route;
        staleData = data;
        return;
      }
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.goto("http://tmec.test/stable/shifts");
  await page.getByText("A-01 · Comet", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "no horizontal overflow at 390px",
  );
  await page
    .getByRole("link", { name: /Open care checklist|Mở checklist/ })
    .click();
  await page
    .getByRole("button", { name: /Complete task|Hoàn thành công việc/ })
    .waitFor();
  await page.evaluate(
    ({ date }) => {
      history.pushState(
        {},
        "",
        `/tasks?date=${date}&zoneId=zone1&horseId=horse2`,
      );
      dispatchEvent(new PopStateEvent("popstate"));
    },
    { date: today },
  );
  await page.waitForTimeout(100);
  await page.evaluate(
    ({ date }) => {
      history.pushState(
        {},
        "",
        `/tasks?date=${date}&zoneId=zone1&horseId=horse3`,
      );
      dispatchEvent(new PopStateEvent("popstate"));
    },
    { date: today },
  );
  await page.getByText("Medication horse3", { exact: true }).waitFor();
  assert.ok(staleRoute, "same-route horse query refetched");
  await staleRoute.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: staleData }),
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.getByText("Medication horse3", { exact: true }).count(),
    1,
    "stale horse2 response cannot replace horse3",
  );
  await page
    .getByRole("button", { name: /Complete task|Hoàn thành công việc/ })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    posts.filter((p) => p.pathname.endsWith("/complete")).length,
    0,
    "medication requires confirmation",
  );
  await page.waitForTimeout(500);
  fs.mkdirSync("../tmp", { recursive: true });
  await page.screenshot({
    path: "../tmp/groom-medication-mobile.png",
    fullPage: true,
  });
  await page.goto("http://tmec.test/complaints");
  await page.getByText("CMP-TEST", { exact: false }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: /Request review|Yêu cầu giải trình/ })
      .count(),
    0,
    "reporter cannot handle own complaint",
  );
  const form = page.locator("form").first();
  await form.locator("select").selectOption("staff1");
  await form
    .locator("textarea")
    .nth(0)
    .fill("Evidence based report of an incident");
  await form.getByRole("button").click();
  await page.getByText(/Report recorded|Đã ghi nhận phản ánh/).waitFor();
  assert.equal(
    posts.find((p) => p.pathname.endsWith("/complaints")).body.subjectUserId,
    "staff1",
  );
  role = "HORSE_OWNER";
  await page.goto("http://tmec.test/complaints");
  await page.waitForTimeout(500);
  assert.equal(
    await page.locator("form").count(),
    0,
    "owner denied complaint form",
  );
  role = "CLUB_MANAGER";
  await page.goto("http://tmec.test/complaints");
  await page
    .getByRole("button", { name: /Request review|Yêu cầu giải trình/ })
    .click();
  await page
    .getByRole("dialog")
    .locator("textarea")
    .fill("Please explain the documented incident");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Save review|Xác nhận lưu/ })
    .click();
  await page.getByText(/Review saved|Đã lưu kết quả xử lý/).waitFor();
  assert.equal(
    posts.find((p) => p.pathname.endsWith("/review")).body.reviewNote,
    "Please explain the documented incident",
  );
  await page.goto("http://tmec.test/financial-reports");
  await page.getByRole("button", { name: /^Remind$|^Nhắc nợ$/ }).click();
  await page
    .getByText(/Inbox delivery is not confirmed|Chưa xác nhận thư/)
    .waitFor();
  await page.getByRole("button", { name: /^Remind$|^Nhắc nợ$/ }).click();
  await page.getByText(/Reminder not sent|Chưa gửi nhắc nợ/).waitFor();
  assert.equal(
    externalRequests.some((url) => url.includes("onesignal.com")),
    false,
    "unconfigured push never loads SDK",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS manager review, reminder true/false wording, unconfigured push gating; same-route horse query refetch and stale response guard; mobile shift layout, checklist link, medication confirm-before-POST, own reporter cannot review, complaint submit, owner route denial; no page errors.",
  );
  await browser.close();
})();
