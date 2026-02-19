/**
 * Integration with TestOrchestratorUseCase
 * 
 * This file demonstrates how to integrate the Salesforce record type modal handler
 * with the existing TestOrchestratorUseCase for automated step execution
 */

// ============================================================================
// APPROACH 1: Using Handler in Test Orchestrator
// ============================================================================

/**
 * You can inject the handler into TestOrchestratorUseCase:
 * 
 * ```typescript
 * // In test-orchestrator.usecase.ts, add this to the executeAction method:
 * 
 * private async executeAction(action: UIAction, state: ExecutionState): Promise<void> {
 *   // ... existing code ...
 * 
 *   // Add this for Salesforce modal handling
 *   if (action.target?.includes('record type') || action.target?.includes('Transportation')) {
 *     const { createRecordTypeModalHandler } = await import('./utils/salesforce/RecordTypeModalHandler');
 *     const handler = createRecordTypeModalHandler(state.page);
 *     
 *     // Try to handle as record type selection
 *     try {
 *       await handler.waitForModal(5000);
 *       const recordType = this.extractRecordType(action);
 *       if (recordType) {
 *         await handler.selectAndVerifyRecordType(recordType);
 *         return; // Success, skip to next action
 *       }
 *     } catch (error) {
 *       // Not a record type modal, continue with normal execution
 *     }
 *   }
 * 
 *   // ... rest of existing code ...
 * }
 * ```
 */

// ============================================================================
// APPROACH 2: Using MCP Tools with Agent
// ============================================================================

/**
 * If using PlaywrightAgent with MCP client:
 * 
 * ```typescript
 * // In your test setup
 * import { SelectRecordTypeTool } from './infrastructure/mcp/playwright/tools/RecordTypeModal';
 * 
 * async function handleSalesforceStep(
 *   agent: PlaywrightAgent,
 *   stepText: string
 * ): Promise<boolean> {
 *   // Check if this is a record type selection step
 *   if (stepText.toLowerCase().includes('transportation') || 
 *       stepText.toLowerCase().includes('record type')) {
 *     
 *     const client = agent.getMcpClient();
 *     const tool = new SelectRecordTypeTool(client);
 *     
 *     // Extract record type from step text
 *     const match = stepText.match(/"([^"]+)"/);
 *     if (match) {
 *       const result = await tool.execute({
 *         recordType: match[1],
 *         timeout: 5000,
 *       });
 *       
 *       return result.success;
 *     }
 *   }
 *   
 *   return false; // Not handled by this function
 * }
 * ```
 */

// ============================================================================
// APPROACH 3: Step-Based Mapping (Current Recommended)
// ============================================================================

/**
 * The step definitions in tests/steps/salesforce.steps.ts are designed
 * to work with your existing Gherkin parsing and TestOrchestratorUseCase.
 * 
 * Feature file steps like:
 * 
 * ```gherkin
 * When the user clicks on the radio button left to the "Transportation"
 * Then the "Transportation" record type option should be selected
 * ```
 * 
 * Map directly to the step definitions, which use the handler internally.
 * 
 * The TestOrchestratorUseCase will:
 * 1. Parse the feature file
 * 2. Map steps to definitions (LLM-based)
 * 3. Execute the step definition functions
 * 4. The handler executes the actual modal interaction
 */

// ============================================================================
// APPROACH 4: Custom Action Handler
// ============================================================================

/**
 * Add this to your UIAction handling logic:
 * 
 * ```typescript
 * // Define a new action type
 * export type UIActionType = 
 *   | 'navigate'
 *   | 'click'
 *   | 'type'
 *   | 'select'
 *   | 'selectRecordType'  // NEW
 *   | ...other types
 * 
 * // In action executor
 * case 'selectRecordType': {
 *   const { createRecordTypeModalHandler } = 
 *     await import('./utils/salesforce/RecordTypeModalHandler');
 *   const handler = createRecordTypeModalHandler(page);
 *   await handler.waitForModal();
 *   await handler.selectAndVerifyRecordType(action.value);
 *   break;
 * }
 * ```
 */

// ============================================================================
// COMPLETE INTEGRATION EXAMPLE
// ============================================================================

/**
 * Full example showing integration with TestOrchestratorUseCase:
 * 
 * ```typescript
 * import { TestOrchestratorUseCase } from './application/execution/test-orchestrator.usecase';
 * import { createRecordTypeModalHandler } from './utils/salesforce/RecordTypeModalHandler';
 * 
 * // Extend TestOrchestratorUseCase
 * class EnhancedTestOrchestratorUseCase extends TestOrchestratorUseCase {
 *   protected async executeAction(action: UIAction, state: ExecutionState): Promise<void> {
 *     // Check for Salesforce record type actions
 *     if (this.isSalesforceRecordTypeAction(action)) {
 *       await this.executeSalesforceRecordTypeAction(action, state);
 *       return;
 *     }
 * 
 *     // Fall back to parent implementation
 *     await super.executeAction(action, state);
 *   }
 * 
 *   private isSalesforceRecordTypeAction(action: UIAction): boolean {
 *     return (
 *       action.target?.toLowerCase().includes('record type') ||
 *       action.target?.toLowerCase().includes('transportation') ||
 *       action.target?.toLowerCase().includes('warehouse') ||
 *       action.target?.toLowerCase().includes('cost savings') ||
 *       action.target?.toLowerCase().includes('manufacturing') ||
 *       action.target?.toLowerCase().includes('d2c') ||
 *       action.target?.toLowerCase().includes('freight forwarding') ||
 *       action.target?.toLowerCase().includes('rail solutions') ||
 *       action.target?.toLowerCase().includes('redistribution')
 *     );
 *   }
 * 
 *   private async executeSalesforceRecordTypeAction(
 *     action: UIAction,
 *     state: ExecutionState
 *   ): Promise<void> {
 *     const handler = createRecordTypeModalHandler(state.page);
 *     
 *     // Extract record type from action
 *     const recordType = this.extractRecordTypeFromAction(action);
 *     
 *     if (!recordType) {
 *       throw new Error('Could not extract record type from action');
 *     }
 * 
 *     // Execute with proper error handling
 *     try {
 *       await handler.waitForModal(10000);
 *       await handler.selectAndVerifyRecordType(recordType);
 *       
 *       this.logger.info(`Selected record type: ${recordType}`);
 *       
 *       // Resolve element info for code generation
 *       action.resolvedElement = {
 *         found: true,
 *         locator: `record-type-${recordType}`,
 *         tagName: 'input',
 *         type: 'radio',
 *       };
 *     } catch (error) {
 *       this.logger.error(`Failed to select record type: ${error}`);
 *       throw error;
 *     }
 *   }
 * 
 *   private extractRecordTypeFromAction(action: UIAction): string | null {
 *     // Try to extract from different possible locations
 *     const possibleValues = [
 *       action.value,
 *       action.target,
 *       action.description,
 *     ].filter(Boolean);
 * 
 *     for (const value of possibleValues) {
 *       // Check against known record types
 *       const knownTypes = [
 *         'Transportation', 'Warehouse', 'Cost Savings', 'D2C',
 *         'Freight Forwarding', 'Manufacturing', 'Rail Solutions',
 *         'Redistribution'
 *       ];
 * 
 *       for (const type of knownTypes) {
 *         if (value?.includes(type)) {
 *           return type;
 *         }
 *       }
 *     }
 * 
 *     return null;
 *   }
 * }
 * ```
 */

// ============================================================================
// MINIMAL INTEGRATION
// ============================================================================

/**
 * If you don't want to modify TestOrchestratorUseCase, just use the
 * step definitions with your feature files:
 * 
 * 1. Place tests/steps/salesforce.steps.ts in your steps directory
 * 2. Register it in your test configuration
 * 3. Use the step text in your feature files:
 * 
 * ```gherkin
 * Feature: Create Opportunity
 *   Scenario: Select Transportation
 *     When the user waits for the New Opportunity dialog to appear
 *     And the user clicks on the radio button left to the "Transportation"
 *     Then the "Transportation" record type option should be selected
 * ```
 * 
 * The step definitions will handle all the modal interaction automatically.
 */

// ============================================================================
// ENVIRONMENT-SPECIFIC HANDLING
// ============================================================================

/**
 * If modal behavior differs by environment:
 * 
 * ```typescript
 * // Add to handler or orchestrator
 * const selectors = {
 *   sit: {
 *     modal: 'div.forceChangeRecordType',
 *     radio: 'input[type="radio"]',
 *   },
 *   prod: {
 *     modal: 'div.forceChangeRecordType', // May be different
 *     radio: 'input[type="radio"]',
 *   },
 * };
 * 
 * const env = process.env.SALESFORCE_ENV || 'sit';
 * const selector = selectors[env];
 * ```
 */

// ============================================================================
// TROUBLESHOOTING INTEGRATION
// ============================================================================

/**
 * If record type selection isn't working:
 * 
 * 1. Check step definition is registered:
 *    - Import from tests/steps/salesforce.steps.ts
 *    - Register in test configuration
 * 
 * 2. Verify modal appears:
 *    - Check Salesforce is loaded
 *    - Check "New Opportunity" button click works
 *    - Add explicit wait for modal
 * 
 * 3. Check record type text:
 *    - Must exactly match label (case-sensitive)
 *    - Common issue: extra spaces or different capitalization
 * 
 * 4. Debug with handler directly:
 *    ```typescript
 *    const handler = createRecordTypeModalHandler(page);
 *    const options = await handler.getAvailableRecordTypes();
 *    console.log('Available:', options); // See exact labels
 *    ```
 * 
 * 5. Check timeouts:
 *    - Increase from 5000 to 10000ms for slow networks
 *    - Add explicit waits between steps
 */

// ============================================================================
// COMPATIBILITY MATRIX
// ============================================================================

/**
 * Works with:
 * 
 * ✅ TestOrchestratorUseCase (execute steps)
 * ✅ PlaywrightAgent (page management)
 * ✅ Gherkin parser (feature files)
 * ✅ MCP Client (tool execution)
 * ✅ Cucumber (step definitions)
 * ✅ Playwright (page interactions)
 * ✅ TypeScript (type safety)
 * 
 * Does NOT require:
 * 
 * ❌ Changes to existing step execution
 * ❌ Modifications to TestOrchestratorUseCase
 * ❌ New test framework
 * ❌ Additional dependencies
 */

export {};
