import { test, expect, type Page } from '@playwright/test';

const members = [
  { id: 'manager', fullName: 'Quản lý thử nghiệm', role: 'CLUB_MANAGER' },
  { id: 'vet', fullName: 'Bác sĩ thử nghiệm', role: 'VETERINARIAN' },
];
const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const shared = { id: 'admission:one', title: 'Thẩm định Atlas · ADM-001', kind: 'ADMISSION', userIds: ['manager', 'vet'], startsAt: `${day}T02:00:00.000Z`, endsAt: `${day}T03:00:00.000Z`, allDay: false, status: 'PENDING', location: 'Cổng A', link: '/horses/admissions' };
const result = { members, events: [shared], openIncidents: 0, summary: { total: 1, completed: 0, inProgress: 0, overdue: 0, unassigned: 0 } };

async function mockApp(page: Page) {
  await page.addInitScript(() => localStorage.setItem('equiflow-lang-v2', 'vi'));
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { success: true, data: { ...members[0], email: 'qa@gmail.com', permissions: { manageAccounts: true, viewHorses: true } } } });
    if (path.endsWith('/accounts')) return route.fulfill({ json: { success: true, data: { accounts: [] } } });
    if (path.endsWith('/notifications')) return route.fulfill({ json: { success: true, data: { notifications: [], unreadCount: 0 } } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
}

test('shared admission appears once and remains visible in both employee rows', async ({ page }) => {
  await mockApp(page);
  await page.route('**/api/staff-work?**', route => route.fulfill({ json: { success: true, data: result } }));
  await page.goto('/staff/schedule');
  await expect(page.getByRole('heading', { name: 'Tổng quan công việc nhân viên' })).toBeVisible();
  await expect(page.getByRole('link', { name: shared.title })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: members[0].fullName })).toContainText('0/1');
  await expect(page.getByRole('row').filter({ hasText: members[1].fullName })).toContainText('0/1');
  await expect(page.getByText('Thiếu người phụ trách', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/staff-overview-desktop.png', fullPage: true });
  expect(await page.pageErrors()).toEqual([]);
});

test('API failure is visible; retry shows a real empty state without demo events', async ({ page }) => {
  await mockApp(page);
  let unavailable = true;
  await page.route('**/api/staff-work?**', route => unavailable
    ? route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE', message: 'Tạm thời không tải được lịch.' } })
    : route.fulfill({ json: { success: true, data: { ...result, events: [] } } }));
  await page.goto('/staff/schedule');
  await expect(page.getByRole('alert')).toContainText('Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.');
  unavailable = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Không có công việc theo bộ lọc.')).toBeVisible();
  await expect(page.getByText('Lê Văn Groom')).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test('mobile overview and work creation preserve a server-side conflict error', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApp(page);
  await page.route('**/api/staff-work?**', route => route.fulfill({ json: { success: true, data: result } }));
  let body: Record<string, unknown> | undefined;
  await page.route('**/api/staff-work', route => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 409, json: { code: 'STAFF_SCHEDULE_CONFLICT', message: 'Người tham gia đã có công việc trong khoảng giờ này.' } });
  });
  await page.goto('/staff/schedule');
  await expect(page.getByRole('link', { name: shared.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/staff-overview-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên công việc *').fill('Kiểm tra khu chuồng');
  await dialog.getByRole('button', { name: 'Lưu công việc', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Người tham gia đã có công việc');
  await expect(dialog.getByLabel('Tên công việc *')).toHaveValue('Kiểm tra khu chuồng');
  expect(body?.userId).toBe('manager');
  expect(body?.startsAt).toMatch(/Z$/);
  expect(await page.pageErrors()).toEqual([]);
});
