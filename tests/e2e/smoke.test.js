import { test, expect } from '@playwright/test';

test('app loads and shows new bracket dialog', async ({ page }) => {
  await page.goto('/');

  // Should show the new bracket dialog since no localStorage data
  await expect(page.locator('#new-bracket-dialog')).toBeVisible();
  await expect(page.locator('#new-bracket-create-btn')).toBeVisible();
});

test('create bracket and verify it renders', async ({ page }) => {
  await page.goto('/');

  // Create a bracket
  await page.fill('#new-bracket-title-input', 'Test Bracket');
  await page.click('#new-bracket-create-btn');

  // Dialog should close
  await expect(page.locator('#new-bracket-dialog')).toBeHidden();

  // Bracket container should have cells
  await expect(page.locator('#bracket-container .cell').first()).toBeVisible();

  // Title should be set
  await expect(page.locator('#bracket-title')).toHaveText('Test Bracket');
});

test('click cell to edit, type name, confirm', async ({ page }) => {
  await page.goto('/');

  // Create bracket
  await page.fill('#new-bracket-title-input', 'Edit Test');
  await page.click('#new-bracket-create-btn');

  // Click first empty cell (round 0)
  const firstCell = page.locator('.cell[data-round="0"]').first();
  await firstCell.click();

  // Cell should be in editing mode
  await expect(firstCell.locator('.cell-text[contenteditable="true"]')).toBeVisible();

  // Type a name
  await page.keyboard.type('Alice');
  await page.keyboard.press('Enter');

  // After confirm, cell text should contain "Alice"
  const cellText = firstCell.locator('.cell-text');
  await expect(cellText).toContainText('Alice');
});

test('take screenshot of rendered bracket', async ({ page }) => {
  await page.goto('/');

  await page.fill('#new-bracket-title-input', 'Screenshot Test');
  await page.click('#new-bracket-create-btn');

  // Wait for bracket to render
  await expect(page.locator('#bracket-container .cell').first()).toBeVisible();

  await page.screenshot({ path: 'tests/e2e/screenshot.png', fullPage: true });
});
