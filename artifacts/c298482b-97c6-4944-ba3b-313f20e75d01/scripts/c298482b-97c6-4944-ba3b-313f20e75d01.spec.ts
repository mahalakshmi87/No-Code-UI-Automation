import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {

  test('test transportation scenario', async ({ page }) => {
    // When the user enters username as "apiuserplaywright@onelineage.com.sit"
    await page.getByLabel('Username').fill('apiuserplaywright@onelineage.com.sit');
    // And the user enters password as "Lineage@789"
    await page.getByLabel('Password').fill('Lineage@789');
  });
});
