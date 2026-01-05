import { test, expect } from '@playwright/test';

test.describe('Create Transportation Opportunity in Salesforce', () => {

  test('Create a new Transportation Opportunity with all required fields', async ({ page }) => {
    // And the user clicks the "Log in to Sandbox" button
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
    // When the user clicks on the "Accounts" tab
    await page.getByRole('img', { name: 'An Agentforce menu on a screen. Multiple documents are uploaded, and the user has clicked the summarize matter button to get an overview from across the files. The agent lists context, key participants, and financials before the screen cuts off.' }).click();
  });
});
