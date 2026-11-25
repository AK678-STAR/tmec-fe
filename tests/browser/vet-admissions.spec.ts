import { test, expect, type Page } from '@playwright/test';

const doctor = { id: 'vet', fullName: 'Bác sĩ được phân công', email: 'vet@gmail.com', role: 'VETERINARIAN', permissions: { viewMedical: true, viewHorses: false, manageAccounts: false } };
const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const admission = {
  id: 'assigned', admissionCode: 'ADM-TEST-001', horseId: 'horse', ownerId: 'owner',
  horse: { id: 'horse', name: 'Atlas', breed: 'Thoroughbred', microchip: '985123456789012' },
  owner: { id: 'owner', fullName: 'Chủ ngựa', email: 'owner@gmail.com' },
  status: 'APPOINTED', veterinarianUserId: 'vet', veterinarian: { id: 'vet', fullName: doctor.fullName },
  declaredMicrochip: '985123456789012', scannedMicrochip: '985123456789012', microchipVerified: true,
  legalVerified: true, isHealthEligible: null, healthCheckNotes: '',
  appointmentDate: `${day}T02:00:00.000Z`, appointmentEndDate: `${day}T03:00:00.000Z`,
  createdAt: `${day}T01:00:00.000Z`, updatedAt: `${day}T01:00:00.000Z`,
};

async function mockDoctor(page: Page, onSave?: (body: Record<string, unknown>) => void) {
  await page.addInitScript(() => localStorage.setItem('equiflow-lang-v2', 'vi'));
  await page.route(/^https?:\/\/[^/]+\/api\//, route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path.endsWith('/auth/me')) return ok(doctor);
    if (path.endsWith('/accounts')) return ok({ accounts: [] });
    if (path.endsWith('/notifications')) return ok({ notifications: [], unreadCount: 0 });
    if (path.endsWith('/horses/admissions/capacity')) return ok({ available: 1 });
    if (path.endsWith('/horses/admissions')) return ok({ data: [admission], total: 1, page: 1, pageSize: 10, totalPages: 1 });
    if (path.endsWith('/horses/admissions/assigned/history')) return ok({ admission, history: [] });
    if (path.endsWith('/history')) return route.fulfill({ status: 404, json: { code: 'ADMISSION_NOT_FOUND', message: 'Không tìm thấy hồ sơ tiếp nhận.' } });
    if (path.endsWith('/horses/admissions/assigned/inspect')) {
      const body = route.request().postDataJSON(); onSave?.(body);
      return ok({ ...admission, ...body, healthFinalizedAt: new Date().toISOString(), status: 'INSPECTION_IN_PROGRESS' });
    }
    if (path.endsWith('/staff-work')) return ok({ members: [{ id: 'vet', fullName: doctor.fullName, role: doctor.role }],
      events: [{ id: 'admission:assigned', title: 'Thẩm định Atlas · ADM-TEST-001', kind: 'ADMISSION', userIds: ['vet'],
        startsAt: admission.appointmentDate, endsAt: admission.appointmentEndDate, allDay: false, status: 'PENDING', location: 'Cổng A', link: '/medical/admissions?inspection=assigned' }], openIncidents: 0,
      summary: { total: 1, completed: 0, inProgress: 0, overdue: 0, unassigned: 0 } });
    return ok([]);
  });
}

test('doctor opens a dedicated assigned screen and can submit health fields only', async ({ page }) => {
  let saved: Record<string, unknown> | undefined;
  await mockDoctor(page, body => { saved = body; });
  await page.goto('/medical/admissions');
  await expect(page.getByRole('heading', { name: 'Thẩm định được phân công', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Thẩm định được phân công', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Khám thẩm định', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Khám thẩm định', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Khám thẩm định sức khỏe/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[autocomplete="off"]')).toBeDisabled();
  await dialog.locator('input[name="healthEligibility"]').first().check();
  await dialog.locator('textarea:not([disabled])').fill('Đã khám, đủ điều kiện sức khỏe.');
  await dialog.getByRole('button', { name: 'Chốt kết luận khám', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận chốt', exact: true }).click();
  await expect(dialog.locator('input[name="healthEligibility"]').first()).toBeDisabled();
  await expect.poll(() => saved).toEqual({ isHealthEligible: true, healthCheckNotes: 'Đã khám, đủ điều kiện sức khỏe.', finalizeHealth: true });
  expect(await page.pageErrors()).toEqual([]);
});

test('assignment notification opens the correct record even when it is not on the current list page', async ({ page }) => {
  await mockDoctor(page);
  await page.route('**/api/horses/admissions?**', route => route.fulfill({ json: { success: true, data: { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 } } }));
  await page.goto('/medical/admissions?inspection=assigned');
  await expect(page.getByRole('dialog', { name: /Khám thẩm định sức khỏe.*ADM-TEST-001/ })).toBeVisible();
  expect(await page.pageErrors()).toEqual([]);
});

test('doctor can use their work calendar without account-management permission', async ({ page }) => {
  await mockDoctor(page);
  await page.goto('/staff/schedule');
  await expect(page.getByRole('heading', { name: 'Lịch công việc của tôi', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Thẩm định Atlas · ADM-TEST-001', exact: true }).click();
  await expect(page).toHaveURL(/\/medical\/admissions\?inspection=assigned/);
  await expect(page.getByRole('dialog', { name: /Khám thẩm định sức khỏe/ })).toBeVisible();
  expect(await page.pageErrors()).toEqual([]);
});

test('a direct link to an unassigned record shows no clinical form', async ({ page }) => {
  await mockDoctor(page);
  await page.goto('/medical/admissions?inspection=another-doctor-record');
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy hồ sơ tiếp nhận.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test('manager selects an actual stall and two Groom responsibilities without a trainer field', async ({ page }) => {
  await mockDoctor(page);
  const record = { ...admission, isHealthEligible: true, healthCheckNotes: 'Đã khám đạt', healthFinalizedAt: new Date().toISOString(), status: 'INSPECTION_IN_PROGRESS' };
  await page.route('**/api/auth/me', route => route.fulfill({ json: { success: true, data: { id: 'manager', fullName: 'Quản lý', email: 'manager@example.com', role: 'CLUB_MANAGER', permissions: { viewHorses: true } } } }));
  await page.route('**/api/horses/admissions/assigned/history', route => route.fulfill({ json: { success: true, data: { admission: record, history: [] } } }));
  await page.route('**/api/horses/admissions/placement?**', route => route.fulfill({ json: { success: true, data: { stalls: [{ id: 'stall', code: 'A01', zoneId: 'zone', zoneRef: { name: 'Khu A' } }], grooms: [{ id: 'primary', fullName: 'Groom chính nghỉ ca', count: 5, max: 6, eligible: true }, { id: 'full', fullName: 'Groom đã đủ 6 ô', count: 6, max: 6, eligible: false }], receivingGrooms: [{ id: 'receiver', fullName: 'Groom đang trực' }] } } }));
  let approved: Record<string, unknown> | undefined;
  await page.route('**/api/horses/admissions/assigned/approve', route => { approved = route.request().postDataJSON(); return route.fulfill({ json: { success: true, data: { ...record, status: 'APPROVED' } } }); });
  await page.goto('/horses/admissions?inspection=assigned');
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Phân công Huấn luyện viên Quản lý:')).toHaveCount(0);
  await dialog.getByLabel('Ô chuồng tiếp nhận', { exact: true }).selectOption('stall');
  await expect(dialog.getByLabel('Groom chăm sóc chính').locator('option[value="full"]')).toHaveAttribute('disabled', '');
  await dialog.getByLabel('Groom chăm sóc chính').selectOption('primary');
  await dialog.getByLabel('Groom đang trực nhận bàn giao').selectOption('receiver');
  const button = dialog.getByRole('button', { name: 'Xác nhận tiếp nhận vào CLB', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect.poll(() => approved).toEqual({ stallId: 'stall', assignedGroomUserId: 'primary', receivingGroomUserId: 'receiver' });
  expect(await page.pageErrors()).toEqual([]);
});

test('a finalized ineligible conclusion remains read-only after reopening', async ({ page }) => {
  await mockDoctor(page);
  await page.route('**/api/horses/admissions/assigned/history', route => route.fulfill({ json: { success: true, data: { admission: { ...admission, isHealthEligible: false, healthCheckNotes: 'Cần cách ly', healthFinalizedAt: new Date().toISOString() }, history: [] } } }));
  await page.goto('/medical/admissions?inspection=assigned');
  const dialog = page.getByRole('dialog').first();
  await expect(dialog.locator('input[name="healthEligibility"]').last()).toBeChecked();
  await expect(dialog.locator('input[name="healthEligibility"]').last()).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Chốt kết luận khám' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Đánh giá bổ sung', exact: true })).toBeVisible();
});
