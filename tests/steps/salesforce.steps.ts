/**
 * Salesforce UI Step Definitions
 * Handles Salesforce-specific Gherkin steps including record type selection
 * 
 * These step definitions work with the TestOrchestratorUseCase
 * Add these to your step definitions and register them in the test configuration
 */

import {
  createRecordTypeModalHandler,
  PlaywrightPage,
} from '../../src/utils/salesforce/RecordTypeModalHandler';

/**
 * Custom world to store shared context across steps
 */
export interface SalesforceWorld {
  page?: PlaywrightPage;
  lastRecordTypeSelected?: string;
  recordTypeModalHandler?: ReturnType<typeof createRecordTypeModalHandler>;
}

/**
 * Wait for the New Opportunity dialog to appear
 * This is the record type selection modal in Salesforce
 */
export async function waitForNewOpportunityDialog(world: SalesforceWorld): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized in world context');
  }

  const handler = createRecordTypeModalHandler(world.page);
  world.recordTypeModalHandler = handler;

  // Wait for the modal to appear
  await handler.waitForModal(10000);

  // Log available record types for debugging
  const options = await handler.getAvailableRecordTypes();
  console.log('Available record types:', options.map((o: any) => o.label));
}

/**
 * Click on the radio button next to a specific record type
 * Matches the step: "When the user clicks on the radio button left to the {string}"
 */
export async function clickRecordTypeRadioButton(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized in world context');
  }

  // Initialize handler if not already done
  if (!world.recordTypeModalHandler) {
    const handler = createRecordTypeModalHandler(world.page);
    world.recordTypeModalHandler = handler;
    await handler.waitForModal(5000);
  }

  // Select the record type
  await world.recordTypeModalHandler.selectRecordType(recordTypeLabel);
  world.lastRecordTypeSelected = recordTypeLabel;

  console.log(`Selected record type: ${recordTypeLabel}`);
}

/**
 * Select record type helper
 * Alternative step: "When the user select radio near {string} from the record type options"
 */
export async function selectRecordTypeOption(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  await clickRecordTypeRadioButton(world, recordTypeLabel);
}

/**
 * Verify that a specific record type is selected
 * Step: "Then the {string} record type option should be selected"
 */
export async function verifyRecordTypeSelected(
  world: SalesforceWorld,
  recordTypeLabel: string
): Promise<void> {
  if (!world.recordTypeModalHandler) {
    throw new Error('Modal handler not initialized. Make sure modal appeared first.');
  }

  const selected = await world.recordTypeModalHandler.getSelectedRecordType();

  if (selected !== recordTypeLabel) {
    throw new Error(
      `Expected record type "${recordTypeLabel}" to be selected, but got "${selected}"`
    );
  }

  console.log(`✓ Verified: ${recordTypeLabel} is selected`);
}

/**
 * Get all available record types
 * Step: "When the user checks available record types"
 */
export async function getAvailableRecordTypes(world: SalesforceWorld): Promise<string[]> {
  if (!world.recordTypeModalHandler) {
    throw new Error('Modal handler not initialized. Make sure modal appeared first.');
  }

  const options = await world.recordTypeModalHandler.getAvailableRecordTypes();
  const labels = options.map((o: any) => o.label);

  console.log('Available record types:', labels);
  return labels;
}

/**
 * Close the record type modal
 * Step: "When the user closes the record type modal"
 */
export async function closeRecordTypeModal(
  world: SalesforceWorld,
  buttonType: 'cancel' | 'close' = 'cancel'
): Promise<void> {
  if (!world.recordTypeModalHandler) {
    throw new Error('Modal handler not initialized');
  }

  await world.recordTypeModalHandler.closeModal(buttonType === 'cancel');
  world.recordTypeModalHandler = undefined;

  console.log('Record type modal closed');
}

/**
 * Wait for a specified number of seconds
 * Step: "And the user waits for {int} seconds"
 */
export async function waitForSeconds(world: SalesforceWorld, seconds: number): Promise<void> {
  if (!world.page) {
    throw new Error('Page not initialized in world context');
  }

  await world.page.waitForTimeout(seconds * 1000);
}

/**
 * Example of integrating with the existing step definition pattern
 * These are helper functions that can be called from your actual step definitions
 */

/**
 * Step definition registration example (would be used with Cucumber)
 * This is pseudocode showing how to register these in your test framework
 */
export const SalesforceStepDefinitions = {
  /**
   * Example: Given/When/Then step registration
   * You would register this in your test configuration
   */
  registerSteps: (Given: any, When: any, Then: any): void => {
    // Example step definitions
    When('the user waits for the New Opportunity dialog to appear', async function (
      this: SalesforceWorld
    ) {
      await waitForNewOpportunityDialog(this);
    });

    When(
      'the user clicks on the radio button left to the {string}',
      async function (this: SalesforceWorld, recordType: string) {
        await clickRecordTypeRadioButton(this, recordType);
      }
    );

    Then(
      'the {string} record type option should be selected',
      async function (this: SalesforceWorld, recordType: string) {
        await verifyRecordTypeSelected(this, recordType);
      }
    );

    When('the user closes the record type modal', async function (this: SalesforceWorld) {
      await closeRecordTypeModal(this, 'cancel');
    });

    When('the user waits for {int} seconds', async function (this: SalesforceWorld, seconds: number) {
      await waitForSeconds(this, seconds);
    });
  },
};
