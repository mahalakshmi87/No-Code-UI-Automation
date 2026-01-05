/**
 * Salesforce Record Type Modal Handler
 * Provides utilities for interacting with Salesforce record type selection modals
 * 
 * This integrates with the PlaywrightAgent and can be used in step definitions
 * or directly called for Salesforce-specific UI interactions
 */

/**
 * Minimal Page interface matching Playwright's Page API
 * This allows the handler to work with any Playwright-compatible page object
 */
export interface PlaywrightPage {
  waitForSelector(selector: string, options?: { timeout?: number; state?: string }): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<void>;
  evaluate<T, A = unknown>(fn: (arg: A) => T, arg?: A): Promise<T>;
  $(selector: string): Promise<PlaywrightElementHandle | null>;
  locator(selector: string): PlaywrightLocator;
}

export interface PlaywrightElementHandle {
  isVisible(): Promise<boolean>;
}

export interface PlaywrightLocator {
  first(): PlaywrightLocator;
  isVisible(): Promise<boolean>;
  click(): Promise<void>;
}

/**
 * Record type option from the modal
 */
export interface RecordTypeOption {
  id: string;
  label: string;
  description: string;
  isSelected: boolean;
}

/**
 * Salesforce Record Type Modal Handler
 * Handles interactions with the forceChangeRecordType modal
 */
export class SalesforceRecordTypeModalHandler {
  constructor(private page: PlaywrightPage) {}

  /**
   * Gets all available record type options from the modal
   * @returns Array of record type options
   * @throws Error if modal not found or parsing fails
   */
  async getAvailableRecordTypes(): Promise<RecordTypeOption[]> {
    // Wait for modal to be visible
    await this.page.waitForSelector('div.forceChangeRecordType', { timeout: 5000 });

    // Extract all radio button options
    const recordTypes = await this.page.evaluate((): RecordTypeOption[] => {
      const options: RecordTypeOption[] = [];
      const labels = document.querySelectorAll('label.slds-radio');

      labels.forEach((label) => {
        const radioBtn = label.querySelector('input[type="radio"]');
        const labelText = label.querySelector('span.slds-form-element__label');
        const description = label.querySelector('div.changeRecordTypeItemDescription');

        if (radioBtn && labelText) {
          const radioBtnElement = radioBtn as HTMLInputElement;
          options.push({
            id: radioBtn.id || '',
            label: labelText.textContent?.trim() || '',
            description: description?.textContent?.trim() || '',
            isSelected: radioBtnElement.checked,
          });
        }
      });

      return options;
    });

    if (recordTypes.length === 0) {
      throw new Error('No record type options found in modal');
    }

    return recordTypes;
  }

  /**
   * Selects a record type by label text
   * @param recordTypeLabel - The text label of the record type (e.g., "Transportation")
   * @throws Error if record type not found
   */
  async selectRecordType(recordTypeLabel: string): Promise<void> {
    // Wait for modal to be visible
    await this.page.waitForSelector('div.forceChangeRecordType', { timeout: 5000 });

    // Find and click the radio button matching the label
    const found = await this.page.evaluate((label: string): boolean => {
      const labels = document.querySelectorAll('label.slds-radio');

      for (const labelEl of labels) {
        const labelText = labelEl.querySelector('span.slds-form-element__label');
        if (labelText && labelText.textContent?.trim() === label) {
          const radioBtn = labelEl.querySelector('input[type="radio"]');
          if (radioBtn) {
            const radioBtnElement = radioBtn as HTMLInputElement;
            radioBtnElement.click();
            return true;
          }
        }
      }
      return false;
    }, recordTypeLabel);

    if (!found) {
      throw new Error(`Record type "${recordTypeLabel}" not found in modal`);
    }

    // Wait a bit for selection to register
    await this.page.waitForTimeout(500);
  }

  /**
   * Gets the currently selected record type
   * @returns The label of the selected record type or null if none selected
   */
  async getSelectedRecordType(): Promise<string | null> {
    // Wait for modal to be visible
    await this.page.waitForSelector('div.forceChangeRecordType', { timeout: 5000 });

    const selected = await this.page.evaluate((): string | null => {
      const labels = document.querySelectorAll('label.slds-radio');

      for (const label of labels) {
        const radioBtnElement = label.querySelector('input[type="radio"]') as HTMLInputElement | null;
        if (radioBtnElement && radioBtnElement.checked) {
          const labelText = label.querySelector('span.slds-form-element__label');
          return labelText?.textContent?.trim() || null;
        }
      }
      return null;
    });

    return selected;
  }

  /**
   * Waits for the modal to appear
   * @param timeout - Timeout in milliseconds (default: 5000)
   */
  async waitForModal(timeout = 5000): Promise<void> {
    await this.page.waitForSelector('div.forceChangeRecordType', { timeout });
  }

  /**
   * Checks if the modal is visible
   * @returns True if modal is visible, false otherwise
   */
  async isModalVisible(): Promise<boolean> {
    const element = await this.page.$('div.forceChangeRecordType');
    if (!element) {
      return false;
    }
    return element.isVisible();
  }

  /**
   * Closes the modal by clicking the X button or Cancel button
   * @param useCancelButton - If true, click "Cancel" button; if false, click close (X) button
   */
  async closeModal(useCancelButton = true): Promise<void> {
    if (useCancelButton) {
      // Look for Cancel button
      const cancelButton = await this.page.locator(
        'button:has-text("Cancel")'
      ).first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    } else {
      // Look for close (X) button
      const closeButton = await this.page.locator(
        'button[aria-label*="Close"], .forceChangeRecordType button.slds-button_icon-inverse'
      ).first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    // Wait for modal to disappear
    await this.page.waitForSelector('div.forceChangeRecordType', { state: 'hidden', timeout: 5000 });
  }

  /**
   * Selects a record type and verifies it was selected
   * @param recordTypeLabel - The record type label to select
   * @throws Error if selection fails or verification fails
   */
  async selectAndVerifyRecordType(recordTypeLabel: string): Promise<void> {
    await this.selectRecordType(recordTypeLabel);

    // Verify selection
    const selected = await this.getSelectedRecordType();
    if (selected !== recordTypeLabel) {
      throw new Error(
        `Failed to verify record type selection. Expected "${recordTypeLabel}", got "${selected}"`
      );
    }
  }
}

/**
 * Create a record type modal handler for the given page
 * @param page - Playwright page instance
 * @returns SalesforceRecordTypeModalHandler instance
 */
export function createRecordTypeModalHandler(page: PlaywrightPage): SalesforceRecordTypeModalHandler {
  return new SalesforceRecordTypeModalHandler(page);
}

/**
 * Helper function to wait for and select a record type
 * Useful for step definitions
 * @param page - Playwright page instance
 * @param recordTypeLabel - Record type label to select
 * @param timeout - Timeout in milliseconds
 */
export async function selectSalesforceRecordType(
  page: PlaywrightPage,
  recordTypeLabel: string,
  timeout = 5000
): Promise<void> {
  const handler = createRecordTypeModalHandler(page);
  await handler.waitForModal(timeout);
  await handler.selectAndVerifyRecordType(recordTypeLabel);
}
