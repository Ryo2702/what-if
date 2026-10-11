import { test, expect } from '@playwright/test';

const decisions = [
  ['💎', 'NEVER SOLD'],
  ['🚀', 'SOLD AT ATH'],
  ['⚖️', 'SOLD 50%, HELD 50%'],
  ['🪙', 'BOUGHT 2× MORE'],
  ['⏳', 'SOLD ONE DAY LATER'],
  ['🛡️', 'TOOK INITIAL INVESTMENT AT 2×'],
  ['🕰️', 'HELD UNTIL TODAY'],
];

test('demo timeline keeps emoji decisions usable and reports the calculated outcome', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '[ EXPLORE A TRADE ]', exact: true }).click();

  const terminal = page.getByRole('log', { name: 'Terminal output' });
  await expect(terminal).toContainText('🪙');
  await expect(terminal).toContainText('📈');

  const menu = page.locator('.decision-window .command-menu');
  for (const [icon, label] of decisions) {
    const row = menu.locator('label').filter({ hasText: label });
    await expect(row).toContainText(icon);
    await expect(row).toContainText(label);
  }

  const athRow = menu.locator('label').filter({ hasText: 'SOLD AT ATH' });
  const beforeHover = await athRow.locator('.decision-emoji').evaluate(element => getComputedStyle(element).transform);
  await athRow.hover();
  await expect.poll(() => athRow.locator('.decision-emoji').evaluate(element => getComputedStyle(element).transform)).not.toBe(beforeHover);

  const neverSold = menu.getByRole('radio', { name: /NEVER SOLD/ });
  const soldAtAth = menu.getByRole('radio', { name: /SOLD AT ATH/ });
  await neverSold.focus();
  await page.keyboard.press('ArrowDown');
  await expect(soldAtAth).toBeChecked();

  await menu.getByText('NEVER SOLD', { exact: true }).click();
  await expect(neverSold).toBeChecked();

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.getByRole('button', { name: /OPEN TIMELINE/ }).click();
  const timeline = page.getByRole('dialog', { name: 'Same memory. Another ending.' });
  await expect(timeline).toBeVisible();

  const endingPrice = timeline.locator('input[type="range"]');
  await endingPrice.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
  await expect(timeline.getByText(/Ending price \/ 0\.4× entry/)).toBeVisible();

  await timeline.getByRole('button', { name: /REWRITE TIMELINE/ }).click();
  const report = timeline.locator('.timeline-report');
  await expect(report).toBeVisible();
  await expect(report.locator('.outcome-emoji')).toContainText('🫡');
  await expect(report.locator('.outcome-emoji')).toContainText('GREAT ESCAPE');
  await expect(report.locator('.outcome-signals')).toContainText('📉');
  await expect(report.locator('.outcome-signals')).toContainText('MARKET CRASH');
  await expect(report.getByRole('button', { name: 'EXPORT PNG', exact: true })).toBeEnabled();
});
