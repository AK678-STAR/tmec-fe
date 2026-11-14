import { test, expect, type Page } from '@playwright/test';

async function renderedTrack(page: Page, selector: string, screenshotPath: string) {
  const canvas = page.locator(selector).locator('canvas').first();
  await expect(canvas).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.load('16px Silkscreen');
    await document.fonts.load('16px VT323');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(255);
  await canvas.screenshot({ path: screenshotPath });
  return canvas.evaluate(async el => {
    const blob = await new Promise<Blob>(resolve => (el as HTMLCanvasElement).toBlob(value => resolve(value!)));
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  });
}
test('embedded trial canvas matches the original Simulator renderer pixel for pixel', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('equiflow-lang-v2', 'vi'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { success: true, data: { id: 'u1', role: 'HEAD_TRAINER', fullName: 'QA', permissions: {} } } }));
  await page.goto('/tests/browser/index.html?reference=1');
  const source = await renderedTrack(page, '[data-testid="source-reference"]', 'test-results/original-simulator-track.png');
  await page.goto('/tests/browser/index.html?mode=WORKOUT&session=WORKOUT-parity&inline=1');
  const embedded = await renderedTrack(page, '[data-testid="native-trial-screen"]', 'test-results/embedded-simulator-track.png');
  expect(embedded).toBe(source);
  expect(await page.pageErrors()).toEqual([]);
});
