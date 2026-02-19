/**
 * Salesforce Record Type Modal Integration Guide
 * 
 * This guide explains how to use the new Salesforce record type modal handling
 * features with your No-Code UI Automation platform.
 */

// ============================================================================
// OVERVIEW
// ============================================================================

/**
 * Three new files have been added to support Salesforce record type modals:
 * 
 * 1. RecordTypeModal.ts
 *    - MCP tool classes for the Playwright agent
 *    - SelectRecordTypeTool: Select a record type by label
 *    - GetRecordTypesTool: Get available record types
 * 
 * 2. utils/salesforce/RecordTypeModalHandler.ts
 *    - High-level handler class for interactive use
 *    - Provides methods like selectRecordType(), getAvailableRecordTypes()
 *    - Works directly with Playwright pages
 * 
 * 3. tests/steps/salesforce.steps.ts
 *    - Step definitions for Cucumber/Gherkin
 *    - Ready to use in feature files
 */

// ============================================================================
// QUICK START - Using the Handler Class
// ============================================================================

/**
 * EXAMPLE 1: Basic Selection
 * 
 * const { createRecordTypeModalHandler } = require('./utils/salesforce/RecordTypeModalHandler');
 * 
 * // In your step definition or test:
 * const handler = createRecordTypeModalHandler(page);
 * await handler.waitForModal(5000);
 * await handler.selectRecordType('Transportation');
 * 
 * // Verify it was selected
 * const selected = await handler.getSelectedRecordType();
 * console.log(selected); // "Transportation"
 */

/**
 * EXAMPLE 2: Get All Options
 * 
 * const handler = createRecordTypeModalHandler(page);
 * const options = await handler.getAvailableRecordTypes();
 * 
 * // options = [
 * //   { id: '0124Q...', label: 'Warehouse', description: '...', isSelected: true },
 * //   { id: '0124Q...', label: 'Cost Savings', description: '...', isSelected: false },
 * //   ...
 * // ]
 * 
 * options.forEach(opt => {
 *   console.log(`${opt.label}: ${opt.description}`);
 * });
 */

/**
 * EXAMPLE 3: Select and Verify
 * 
 * const handler = createRecordTypeModalHandler(page);
 * await handler.waitForModal();
 * 
 * // This will throw if verification fails
 * await handler.selectAndVerifyRecordType('Transportation');
 * 
 * console.log('Transportation was successfully selected!');
 */

// ============================================================================
// GHERKIN FEATURE FILE USAGE
// ============================================================================

/**
 * EXAMPLE 4: Feature File Integration
 * 
 * Feature: Create Opportunity with Transportation Type
 * 
 *   Scenario: Select Transportation record type
 *     Given the user navigates to "https://lineage--sit.sandbox.lightning.force.com"
 *     When the user clicks on "New Opportunity" button
 *     And the user waits for the New Opportunity dialog to appear
 *     When the user clicks on the radio button left to the "Transportation"
 *     And the user waits for 2 seconds
 *     Then the "Transportation" record type option should be selected
 */

// ============================================================================
// MCP TOOL USAGE (For Advanced Integration)
// ============================================================================

/**
 * EXAMPLE 5: Using MCP Tools Directly
 * 
 * If you want to use the MCP tools in the Playwright agent:
 * 
 * const selectTool = new SelectRecordTypeTool(mcpClient);
 * const result = await selectTool.execute({
 *   recordType: 'Transportation',
 *   timeout: 5000
 * });
 * 
 * if (result.success) {
 *   console.log(`Selected: ${result.data?.selectedType}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 */

/**
 * EXAMPLE 6: Get All Available Types via MCP
 * 
 * const getTool = new GetRecordTypesTool(mcpClient);
 * const result = await getTool.execute({ timeout: 5000 });
 * 
 * if (result.success) {
 *   const types = result.data?.recordTypes || [];
 *   console.log('Available types:', types);
 * }
 */

// ============================================================================
// DOM STRUCTURE REFERENCE
// ============================================================================

/**
 * Understanding the Salesforce Record Type Modal DOM
 * 
 * The modal has this structure:
 * 
 * <div class="forceChangeRecordType">
 *   <h2>New Opportunity</h2>
 *   <div class="modal__content changeRecordTypeLeftRightContent">
 *     <div class="changeRecordTypeRow">
 *       <fieldset class="slds-form-element">
 *         <legend>Select a record type</legend>
 *         <div class="changeRecordTypeRightColumn">
 *           <!-- RADIO OPTIONS START -->
 *           <label for="0124Q0000018L6lQAE" class="slds-radio">
 *             <input 
 *               type="radio" 
 *               id="0124Q0000018L6lQAE" 
 *               name="changeRecordTypeRadio..."
 *               value="0124Q0000018L6lQAE"
 *             />
 *             <span class="slds-radio--faux"></span>
 *             <div class="changeRecordTypeOptionRightColumn">
 *               <span class="slds-form-element__label">Transportation</span>
 *               <div class="changeRecordTypeItemDescription">
 *                 To be used when selling transportation or managed transportation services
 *               </div>
 *             </div>
 *           </label>
 *           <!-- ...more options... -->
 *         </div>
 *       </fieldset>
 *     </div>
 *   </div>
 * </div>
 */

// ============================================================================
// STEP DEFINITION REGISTRATION
// ============================================================================

/**
 * EXAMPLE 7: Registering Steps in Your Test Configuration
 * 
 * If you're using Cucumber, register the steps like this:
 * 
 * import { SalesforceStepDefinitions } from './tests/steps/salesforce.steps';
 * 
 * // In your test setup/hooks file:
 * export default {
 *   default: {
 *     require: ['tests/steps/**\/*.ts'],
 *     supportCode: {
 *       When: (pattern, fn) => { ... },
 *       Then: (pattern, fn) => { ... },
 *       Given: (pattern, fn) => { ... },
 *     }
 *   }
 * };
 */

// ============================================================================
// AVAILABLE RECORD TYPES
// ============================================================================

/**
 * These are the record types available in the modal:
 * 
 * 1. Warehouse
 *    - To be used when selling warehousing services
 * 
 * 2. Cost Savings
 *    - To be used for cost savings
 * 
 * 3. D2C
 *    - To be used when selling direct-to-consumer services
 * 
 * 4. Freight Forwarding
 *    - To be used when selling freight forwarding services
 * 
 * 5. Manufacturing
 *    - To be used when selling manufacturing services, such as making bread dough
 * 
 * 6. Rail Solutions
 *    - To be used when selling Lineage rail transportation services
 * 
 * 7. Redistribution
 *    - To be used when selling redistribution services
 * 
 * 8. Transportation
 *    - To be used when selling transportation or managed transportation services
 */

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * EXAMPLE 8: Handling Errors
 * 
 * try {
 *   const handler = createRecordTypeModalHandler(page);
 *   await handler.waitForModal(5000);
 *   await handler.selectRecordType('NonExistentType');
 * } catch (error) {
 *   if (error.message.includes('not found')) {
 *     console.log('Record type does not exist');
 *   } else if (error.message.includes('Modal')){
 *     console.log('Modal did not appear');
 *   }
 * }
 */

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

/**
 * Q: The modal doesn't appear when I click "New Opportunity"
 * A: Add a longer wait time:
 *    await handler.waitForModal(10000); // 10 seconds instead of 5
 * 
 * Q: The radio button click doesn't work
 * A: Ensure the modal is fully loaded:
 *    - Check for overlay/spinner elements
 *    - Try clicking the label instead of the input
 *    - Verify record type text matches exactly (case-sensitive)
 * 
 * Q: Selection succeeds but verification fails
 * A: The page might need more time to register the change:
 *    await handler.selectRecordType('Transportation');
 *    await page.waitForTimeout(1000); // Add delay
 *    const selected = await handler.getSelectedRecordType();
 * 
 * Q: How do I debug what's in the modal?
 * A: Use the getAvailableRecordTypes() method:
 *    const options = await handler.getAvailableRecordTypes();
 *    console.log(JSON.stringify(options, null, 2));
 */

// ============================================================================
// BEST PRACTICES
// ============================================================================

/**
 * 1. Always wait for modal before interacting
 *    await handler.waitForModal();
 * 
 * 2. Use selectAndVerifyRecordType() instead of separate select/verify
 *    await handler.selectAndVerifyRecordType('Transportation');
 * 
 * 3. Add appropriate timeouts for slower networks
 *    await handler.waitForModal(10000); // Longer timeout for slow connections
 * 
 * 4. Log what you're doing for debugging
 *    console.log('Available types:', await handler.getAvailableRecordTypes());
 *    console.log('Selected:', await handler.getSelectedRecordType());
 * 
 * 5. Clean up modal reference when done
 *    handler = undefined; // or close the modal properly
 */

// ============================================================================
// COMPATIBILITY WITH EXISTING CODE
// ============================================================================

/**
 * These new utilities are COMPATIBLE with:
 * 
 * ✓ Your existing PlaywrightAgent infrastructure
 * ✓ The TestOrchestratorUseCase for LLM-based step mapping
 * ✓ Gherkin/Cucumber feature files
 * ✓ Existing MCP tools and client
 * ✓ WindowTools (for other popup handling)
 * 
 * They DO NOT replace:
 * 
 * ✗ WindowTools - That's for browser tab/window management
 * ✗ Existing click/type tools - Used for other interactions
 * ✗ TestOrchestratorUseCase - Still orchestrates the overall test
 */

export {};
