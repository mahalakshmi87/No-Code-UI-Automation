import { test, expect } from '@playwright/test';

test.describe('Create Transportation Opportunity in Salesforce', () => {

  test('Successfully create a Transportation opportunity with complete details', async ({ page }) => {
    // When the user enters username "apiuserplaywright@onelineage.com.sit"
    await page.getByLabel('Username').fill('apiuserplaywright@onelineage.com.sit');
    // And the user enters password "Lineage@789"
    await page.getByLabel('Password').fill('Lineage@789');
    // And the user clicks on "Log in to Sandbox" button
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
    // When the user clicks on the "Accounts" tab
    await page.getByRole('button', { name: 'Accounts List' }).click();
    // And the user navigates to the account URL "https://lineage--sit.sandbox.lightning.force.com/lightning/r/Account/0010c00001vlGl5AAE/view"
    await page.goto('https://lineage--sit.sandbox.lightning.force.com/lightning/r/Account/0010c00001vlGl5AAE/view');
    // And the user clicks on "New Opportunity" button from the top right corner
    await page.getByRole('button', { name: 'New Opportunity' }).click();
    // And the user waits for the New Opportunity dialog to appear
    await page.waitForTimeout(5000);
    // And I "switch to" the "New Opportunity" popup window
    // Switch to new tab
    const pages = context.pages();
    if (pages.length > 1) {
    page = pages[pages.length - 1];
    await page.bringToFront();
    }
  });
});
