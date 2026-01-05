import { test, expect } from '@playwright/test';

test.describe('Create Transportation Opportunity in Salesforce', () => {

  test('Successfully create a Transportation opportunity with complete details', async ({ page }) => {
    // And the user clicks on "Log in to Sandbox" button
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
  });
});
