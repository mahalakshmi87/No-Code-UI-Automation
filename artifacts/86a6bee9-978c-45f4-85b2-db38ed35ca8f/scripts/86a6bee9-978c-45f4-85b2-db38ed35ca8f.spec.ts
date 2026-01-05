import { test, expect } from '@playwright/test';

test.describe('Create New Opportunity with Transportation Record Type', () => {

  test('User logs in and creates a new opportunity with Transportation record type', async ({ page }) => {
    // When the user enters username "apiuserplaywright@onelineage.com.sit"
    await page.getByLabel('Username').fill('apiuserplaywright@onelineage.com.sit');
    // And the user enters password "Lineage@789"
    await page.getByLabel('Password').fill('Lineage@789');
    // And the user clicks on "Log in to Sandbox" button
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
  });
});
