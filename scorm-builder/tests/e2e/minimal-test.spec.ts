import { test, expect } from '@playwright/test';

test('Can load the application', async ({ page }) => {
  console.log('Starting test...');
  
  await page.goto('http://localhost:1420');
  console.log('Navigated to page');
  
  await page.waitForLoadState('networkidle');
  console.log('Page loaded');
  
  // Just check that something is visible
  const body = page.locator('body');
  await expect(body).toBeVisible();
  
  console.log('Test passed!');
});