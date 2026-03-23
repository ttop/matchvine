import { test, expect } from '@playwright/test';

test('new bracket dialog shows all settings sections', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#new-bracket-dialog')).toBeVisible();

  // Font picker has options
  const fontGrid = page.locator('#new-bracket-font-picker-grid');
  await expect(fontGrid).toBeVisible();
  expect(await fontGrid.locator('.font-option').count()).toBeGreaterThan(0);

  // Background color grid has swatches
  const bgGrid = page.locator('#new-bracket-bg-color-grid');
  await expect(bgGrid).toBeVisible();
  expect(await bgGrid.locator('.color-swatch').count()).toBeGreaterThan(0);

  // Toggle labels visible (inputs are hidden by toggle-switch CSS)
  await expect(page.locator('label[for="new-bracket-toggle-seed-numbers"]')).toBeVisible();
  await expect(page.locator('label[for="new-bracket-toggle-auto-color"]')).toBeVisible();

  // Layout toggles
  await expect(page.locator('#new-bracket-layout-toggles')).toBeVisible();

  // Create button reachable
  const createBtn = page.locator('#new-bracket-create-btn');
  await createBtn.scrollIntoViewIfNeeded();
  await expect(createBtn).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/new-bracket-dialog-bottom.png' });
});

test('settings dialog shows title field', async ({ page }) => {
  await page.goto('/');

  await page.fill('#new-bracket-title-input', 'Test Bracket');
  await page.click('#new-bracket-create-btn');
  await expect(page.locator('#new-bracket-dialog')).toBeHidden();

  await page.click('#btn-settings');
  await expect(page.locator('#settings-dialog')).toBeVisible();

  const titleInput = page.locator('#settings-title-input');
  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveValue('Test Bracket');

  await page.screenshot({ path: 'tests/e2e/settings-dialog.png' });
});
