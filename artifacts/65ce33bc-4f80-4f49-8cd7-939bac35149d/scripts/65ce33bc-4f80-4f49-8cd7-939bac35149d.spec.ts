import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {

  test('test transportation scenario', async ({ page }) => {
    // When the user enters username as "apiuserplaywright@onelineage.com.sit"
    await page.getByLabel('Username').fill('apiuserplaywright@onelineage.com.sit');
    // And the user enters password as "Lineage@789"
    await page.getByLabel('Password').fill('Lineage@789');
    // And the user clicks on "Log in to Sandbox" button
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
    // And I click on Accounts tab
    await page.getByRole('button', { name: 'Accounts List' }).click();
    // And Load the url as "https://lineage--sit.sandbox.lightning.force.com/lightning/r/Account/0010c00001vlGl5AAE/view"
    await page.goto('https://lineage--sit.sandbox.lightning.force.com/lightning/r/Account/0010c00001vlGl5AAE/view');
    // When I wait for 15 seconds and i click on the "New Opportunity" button
    await page.getByRole('button', { name: 'New Opportunity' }).click();
    // And I click on the "Transportation" radio button
    await page.getByRole('button', { name: 'Next' }).click();
    // And I click on Next button
    await page.getByRole('button', { name: 'Next Step Help Info' }).click();
  });
});
