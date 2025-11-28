import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Meeting Preparation Feature
 */

test.describe('Meeting Preparation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Go to the app
    await page.goto('/');
  });

  test('homepage loads correctly', async ({ page }) => {
    // Check that the homepage loads
    await expect(page).toHaveTitle(/SalesPrep/i);
  });

  test('login page is accessible', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    
    // Check login form exists
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('signup page is accessible', async ({ page }) => {
    // Navigate to signup
    await page.goto('/signup');
    
    // Check signup form exists
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

});

test.describe('Authenticated User - Preparation', () => {
  
  // Skip these tests if no test credentials are provided
  test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD, 
    'Skipping authenticated tests - no test credentials provided');

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || '');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || '');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('dashboard shows meeting preps section', async ({ page }) => {
    // Check dashboard has Meeting Preps section
    await expect(page.locator('text=Meeting Preps')).toBeVisible();
  });

  test('can navigate to preparation page', async ({ page }) => {
    // Click on Prepare for Meeting button
    await page.click('text=Prepare for Meeting');
    
    // Should be on preparation page
    await expect(page).toHaveURL(/.*preparation/);
    await expect(page.locator('text=Meeting Preparation')).toBeVisible();
  });

  test('preparation form is visible', async ({ page }) => {
    await page.goto('/dashboard/preparation');
    
    // Check form elements
    await expect(page.locator('input#company')).toBeVisible();
    await expect(page.locator('text=Meeting Type')).toBeVisible();
    await expect(page.locator('button:has-text("Generate")')).toBeVisible();
  });

  test('can select meeting type', async ({ page }) => {
    await page.goto('/dashboard/preparation');
    
    // Click on meeting type selector
    await page.click('[role="combobox"]');
    
    // Check options are visible
    await expect(page.locator('text=Discovery Call')).toBeVisible();
    await expect(page.locator('text=Product Demo')).toBeVisible();
    await expect(page.locator('text=Closing Call')).toBeVisible();
  });

  test('form validation - requires company name', async ({ page }) => {
    await page.goto('/dashboard/preparation');
    
    // Try to submit without company name
    const submitButton = page.locator('button:has-text("Generate")');
    
    // Button should be disabled when no company name
    await expect(submitButton).toBeDisabled();
  });

  test('can start meeting prep generation', async ({ page }) => {
    await page.goto('/dashboard/preparation');
    
    // Fill in company name
    await page.fill('input#company', 'Test Company');
    
    // Select meeting type (default is discovery)
    
    // Submit form
    await page.click('button:has-text("Generate")');
    
    // Should show loading or success message
    await expect(page.locator('text=Generating')).toBeVisible({ timeout: 5000 });
  });

});

test.describe('UI Components', () => {

  test('Select component renders correctly', async ({ page }) => {
    await page.goto('/dashboard/preparation');
    
    // Check if select trigger is visible
    const selectTrigger = page.locator('[role="combobox"]');
    await expect(selectTrigger).toBeVisible();
    
    // Click to open
    await selectTrigger.click();
    
    // Check dropdown content
    const dropdown = page.locator('[role="listbox"]');
    await expect(dropdown).toBeVisible();
  });

});

