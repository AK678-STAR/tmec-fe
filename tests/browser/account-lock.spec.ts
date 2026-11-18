import { test, expect } from '@playwright/test';

const emptyAssignments = {
  userId: 'groom-test', hasAssignments: false, stalls: [], workouts: [], shifts: [], plans: [],
};
const activeAssignments = {
  ...emptyAssignments, hasAssignments: true,
  stalls: [{ id: 'a1', stall: { id: 's1', code: 'STALL-A01', zone: 'A' },
    horse: { id: 'h1', name: 'Atlas', horseCode: 'HR-000001' } }],
};

for (const action of ['lock', 'deactivate']) {
  test(`${action}: failed check blocks confirmation; retry preserves the reason and confirms assignments`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('equiflow-lang-v2', 'en'));
    let unavailable = true;
    let requests = 0;
    await page.route('**/api/accounts/groom-test/active-assignments', route => {
      requests++;
      return unavailable
        ? route.fulfill({ status: 503, json: { success: false, code: 'SERVICE_UNAVAILABLE' } })
        : route.fulfill({ json: { success: true, data: activeAssignments } });
    });
    await page.goto(`/tests/browser/account-lock.html?action=${action}`);
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: action === 'lock' ? 'Lock account' : 'Deactivate account', exact: true });
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByRole('alert')).toContainText('Could not check active assignments');
    await dialog.getByRole('textbox').fill('A detailed account status reason');
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => requests).toBe(2);
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(confirm).toBeDisabled();
    await expect(page.getByTestId('confirmation')).toBeEmpty();
    unavailable = false;
    await dialog.getByRole('button', { name: 'Try again' }).click();
    const anyway = dialog.getByRole('button', { name: action === 'lock' ? 'Lock anyway' : 'Deactivate anyway', exact: true });
    await expect(anyway).toBeEnabled();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByRole('textbox')).toHaveValue('A detailed account status reason');
    await expect(dialog.getByText('STALL-A01', { exact: false })).toBeVisible();
    await anyway.click();
    await expect(page.getByTestId('confirmation')).toHaveText(JSON.stringify({
      reason: 'A detailed account status reason', confirmedActiveAssignments: true,
    }));
    expect(await page.pageErrors()).toEqual([]);
  });
}

test('successful check without assignments still validates the reason before confirming', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('equiflow-lang-v2', 'en'));
  await page.route('**/api/accounts/groom-test/active-assignments', route =>
    route.fulfill({ json: { success: true, data: emptyAssignments } }));
  await page.goto('/tests/browser/account-lock.html');
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Lock account', exact: true });
  await expect(confirm).toBeEnabled();
  await dialog.getByRole('textbox').fill('short');
  await confirm.click();
  await expect(dialog.getByText('Reason must be 10 to 300 characters.')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toBeEmpty();
  await dialog.getByRole('textbox').fill('  A sufficiently detailed reason  ');
  await confirm.click();
  await expect(page.getByTestId('confirmation')).toHaveText(JSON.stringify({ reason: 'A sufficiently detailed reason' }));
  expect(await page.pageErrors()).toEqual([]);
});
