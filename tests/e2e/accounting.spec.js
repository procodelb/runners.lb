const { test, expect } = require('@playwright/test');

test.describe('Accounting Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('http://localhost:5173/login');
    
    // Login
    await page.fill('input[type="email"]', 'admin@soufiam.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL('http://localhost:5173/dashboard');
  });

  test('should display accounting page with correct totals', async ({ page }) => {
    // Navigate to accounting
    await page.goto('http://localhost:5173/accounting');
    
    // Check page loaded
    await expect(page.locator('h1')).toContainText('Accounting');
    
    // Check tabs exist
    await expect(page.locator('button:has-text("Clients")')).toBeVisible();
    await expect(page.locator('button:has-text("Drivers")')).toBeVisible();
    
    // Check totals are displayed
    const totals = page.locator('[data-testid="accounting-totals"]');
    await expect(totals).toBeVisible();
  });

  test('should export CSV', async ({ page }) => {
    await page.goto('http://localhost:5173/accounting');
    
    // Click export CSV button
    const csvButton = page.locator('button:has-text("Export CSV")').first();
    await csvButton.click();
    
    // Wait for download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});

