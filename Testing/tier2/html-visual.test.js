// Testing/tier2/html-visual.test.js
// Run with: npx playwright test Testing/tier2/html-visual.test.js
// Requires: npx playwright install chromium

const { test, expect } = require('@playwright/test');
const path = require('node:path');

const SDLC_ROOT = path.resolve(__dirname, '..', '..');
const ARCHITECTURE_HTML = `file://${path.join(SDLC_ROOT, 'docs', 'architecture.html').replace(/\\/g, '/')}`;

test.describe('architecture.html visual', () => {

  test('renders without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(ARCHITECTURE_HTML);
    expect(errors).toEqual([]);
  });

  test('all sections visible on scroll', async ({ page }) => {
    await page.goto(ARCHITECTURE_HTML);
    const headings = page.locator('h2');
    const count = await headings.count();
    expect(count).toBe(9);
    for (let i = 0; i < count; i++) {
      await headings.nth(i).scrollIntoViewIfNeeded();
      await expect(headings.nth(i)).toBeVisible();
    }
  });

  test('3-column grid on desktop (1200px)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(ARCHITECTURE_HTML);
    const adapters = page.locator('.arch-box.adapter');
    const count = await adapters.count();
    expect(count).toBe(3);
    const boxes = [];
    for (let i = 0; i < count; i++) { boxes.push(await adapters.nth(i).boundingBox()); }
    const xPositions = [...new Set(boxes.map(b => Math.round(b.x)))];
    expect(xPositions.length).toBe(3);
  });

  test('stacks on mobile (400px)', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto(ARCHITECTURE_HTML);
    const adapters = page.locator('.arch-box.adapter');
    const count = await adapters.count();
    const boxes = [];
    for (let i = 0; i < count; i++) { boxes.push(await adapters.nth(i).boundingBox()); }
    const xPositions = [...new Set(boxes.map(b => Math.round(b.x / 10)))];
    expect(xPositions.length).toBeLessThanOrEqual(1);
  });

  test('agent pipeline has 6 agent boxes', async ({ page }) => {
    await page.goto(ARCHITECTURE_HTML);
    const agentBoxes = page.locator('.agent-box');
    await expect(agentBoxes).toHaveCount(6);
  });

  test('pipeline arrows are visible', async ({ page }) => {
    await page.goto(ARCHITECTURE_HTML);
    const arrows = page.locator('.arrow');
    const count = await arrows.count();
    for (let i = 0; i < count; i++) {
      const box = await arrows.nth(i).boundingBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
  });
});
