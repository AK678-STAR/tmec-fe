import { test, expect, type Page } from '@playwright/test';
test.afterEach(async ({ page }) => { expect(await page.pageErrors()).toEqual([]); });

async function user(page: Page, role: string, language = 'en') {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.ui = 'v2'; }); });
  await page.addInitScript(lang => localStorage.setItem('equiflow-lang-v2', lang), language);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { success: true, data: { id: 'u1', role, fullName: 'QA', email: 'qa@gmail.com', permissions: {} } } }));
}
test('trainer quick simulation receives one ACK; replay does not save again', async ({ page, request }) => {
  await user(page, 'HEAD_TRAINER');
  await page.goto('/tests/browser/index.html?mode=WORKOUT&session=WORKOUT-quick&quick=1&inline=1');
  await expect(page.getByTestId('completions')).toHaveText('1');
  await expect(page.getByText('Simulation draft saved.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('workout-summary-card')).toBeVisible();
  await expect(page.getByTestId('completions')).toHaveText('1');
  const records = await (await request.get('http://127.0.0.1:4302/records')).json();
  expect(records.filter((r: any) => r.payload.session_id === 'WORKOUT-quick')).toHaveLength(1);
  expect(records.find((r: any) => r.payload.session_id === 'WORKOUT-quick').payload.result.hrRecovery10m).toBeGreaterThan(0);
});
test('vet drawer measures in Vietnamese, closes with Escape and restores focus', async ({ page }) => {
  await user(page, 'VETERINARIAN', 'vi');
  await page.goto('/tests/browser/index.html?mode=EXAM&session=EXAM-vet');
  await page.getByRole('button', { name: 'Open model' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAttribute('aria-label', 'Mô hình khám lâm sàng');
  await expect(dialog.getByText('Đã kết nối', { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const box = (await dialog.boundingBox())!;
    return Math.abs(box.x + box.width - 1280);
  }).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/simulation-vet.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Hoàn tất khám & Lưu kết quả' }).click();
  await expect(page.getByTestId('completions')).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open model' })).toBeFocused();
});
test('manager race supports eight runners and mobile width', async ({ page }) => {
  await user(page, 'CLUB_MANAGER');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/browser/index.html?mode=RACE&session=RACE-manager&quick=1');
  await page.getByRole('button', { name: 'Open model' }).click();
  await expect(page.getByTestId('completions')).toHaveText('1');
  await expect(page.getByRole('checkbox')).toHaveCount(8);
  await page.screenshot({ path: 'test-results/simulation-race-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('owner cannot fetch context or connect to simulation', async ({ page }) => {
  await user(page, 'HORSE_OWNER');
  const contexts: string[] = [];
  page.on('request', r => { if (r.url().includes('/context')) contexts.push(r.url()); });
  await page.goto('/tests/browser/index.html?mode=WORKOUT&inline=1');
  await expect(page.getByText('This simulation is not available for your role.')).toBeVisible();
  expect(contexts).toHaveLength(0);
});
test('rejected ACK never reports a successful save', async ({ page }) => {
  await user(page, 'VETERINARIAN');
  await page.goto('/tests/browser/index.html?mode=EXAM&session=EXAM-reject&quick=1&inline=1');
  await expect(page.getByText('Could not synchronize simulation results.')).toBeVisible();
  await expect(page.getByTestId('completions')).toHaveText('0');
  await expect(page.getByText('Simulation draft saved.', { exact: false })).toHaveCount(0);
});
test('medical lock arriving during workout stops the engine', async ({ page, request }) => {
  await user(page, 'HEAD_TRAINER');
  await page.goto('/tests/browser/index.html?mode=WORKOUT&session=WORKOUT-lock&inline=1');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start trial', exact: true }).click();
  await request.get('http://127.0.0.1:4302/lock');
  await expect(page.getByText('Simulation stopped: the horse is medically locked or ineligible.')).toBeVisible();
  await expect(page.getByTestId('completions')).toHaveText('0');
});
test('training caller translates entry buttons, protects edits and unmounts the previous workout', async ({ page }) => {
  await user(page, 'HEAD_TRAINER');
  await page.goto('/tests/browser/index.html?caller=training');
  await page.getByRole('button', { name: 'Watch simulation', exact: true }).click();
  await expect(page.getByTestId('simulation-panel')).toBeVisible();
  await expect(page.locator('fieldset')).toHaveAttribute('disabled', '');
  await expect(page.getByRole('button', { name: 'Save result', exact: true })).toBeDisabled();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Next workout' }).click();
  await expect(page.getByTestId('simulation-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Watch simulation', exact: true })).toBeEnabled();
  await expect(page.locator('fieldset')).not.toHaveAttribute('disabled');
});
test('native trial restores source HUD, pixel styling and lameness control', async ({ page, request }) => {
  await user(page, 'HEAD_TRAINER');
  await page.goto('/tests/browser/index.html?mode=WORKOUT&session=WORKOUT-lameness&inline=1');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start trial', exact: true }).click();
  await expect(page.getByText('Stride length', { exact: true })).toBeVisible();
  await expect(page.getByText('Body temperature', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acute leg fracture', exact: true })).toBeEnabled();
  await expect.poll(async () => Number(await page.getByTestId('trial-chart-meta').getAttribute('data-sample-count'))).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Lameness', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Acute leg fracture', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lameness', exact: true })).toBeDisabled();
  await expect.poll(async () => (await (await request.get('http://127.0.0.1:4302/incidents')).json()).filter((r: any) => r.session_id === 'WORKOUT-lameness').length).toBe(1);
  const incidents = await (await request.get('http://127.0.0.1:4302/incidents')).json();
  const incident = incidents.find((r: any) => r.session_id === 'WORKOUT-lameness');
  expect(incident.incident.kind).toBe('LAMENESS');
  expect(incident.snapshot.covered_distance_m).toBeGreaterThan(0);
  const scope = page.getByTestId('native-simulator');
  expect(await scope.evaluate(el => getComputedStyle(el).getPropertyValue('--parchment').trim())).toBe('#f3e6c4');
  await page.screenshot({ path: 'test-results/native-trial.png', fullPage: true });
});
test('native fracture aborts the workout and sends one injury result without creating a medical lock', async ({ page, request }) => {
  await user(page, 'HEAD_TRAINER');
  await page.goto('/tests/browser/index.html?mode=WORKOUT&session=WORKOUT-fracture&inline=1');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start trial', exact: true }).click();
  await page.getByRole('button', { name: 'Acute leg fracture', exact: true }).click();
  await page.getByRole('button', { name: '60×', exact: true }).click();
  await expect(page.getByTestId('completions')).toHaveText('1');
  const records = await (await request.get('http://127.0.0.1:4302/records')).json();
  const result = records.filter((r: any) => r.payload.session_id === 'WORKOUT-fracture');
  expect(result).toHaveLength(1);
  expect(result[0].payload.status).toBe('ABORTED_INJURY');
  expect(result[0].payload.horse.medical_lock).toBe(false);
  await expect(page.getByRole('button', { name: 'Start trial', exact: true })).toBeDisabled();
});
test('Vietnamese rejected race never claims official results have been finalized', async ({ page }) => {
  await user(page, 'CLUB_MANAGER', 'vi');
  await page.goto('/tests/browser/index.html?mode=RACE&session=RACE-reject-vi&quick=1&inline=1');
  await expect(page.getByText('Không đồng bộ được kết quả mô phỏng.', { exact: true })).toBeVisible();
  await expect(page.getByText('Đã chốt kết quả', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('completions')).toHaveText('0');
});
test('native race targets the selected lane and preserves all official entrants', async ({ page, request }) => {
  await user(page, 'CLUB_MANAGER');
  await page.goto('/tests/browser/index.html?mode=RACE&session=RACE-lane&inline=1');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open starting gate', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).toBeDisabled();
  await expect(page.getByRole('button', { name: '1000m', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Select lane' }).selectOption('3');
  await page.getByRole('button', { name: 'Leg fracture', exact: true }).click();
  await page.getByRole('button', { name: '60×', exact: true }).click();
  await expect(page.getByTestId('completions')).toHaveText('1', { timeout: 10000 });
  const records = await (await request.get('http://127.0.0.1:4302/records')).json();
  const result = records.find((r: any) => r.payload.session_id === 'RACE-lane').payload;
  expect(result.results).toHaveLength(8);
  expect(result.results.find((r: any) => r.lane === 3)).toMatchObject({ horse_id: 'h3', status: 'DNF' });
  const incidents = await (await request.get('http://127.0.0.1:4302/incidents')).json();
  expect(incidents.find((r: any) => r.session_id === 'RACE-lane').horse.horse_id).toBe('h3');
  await expect(page.getByRole('button', { name: 'Reset track', exact: true })).toBeDisabled();
});
