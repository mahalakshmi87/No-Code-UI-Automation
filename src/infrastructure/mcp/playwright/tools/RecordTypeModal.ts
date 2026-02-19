/**
 * Record Type Modal Helper
 * Handles Salesforce record type selection modals
 */

import { McpToolResult } from '../../common/McpClient.interface';
import { IMcpClient } from '../../common/McpClient.interface';
import { BaseTool, BaseToolOptions } from './BaseTool';

/**
 * Select record type parameters
 */
export interface SelectRecordTypeParams extends BaseToolOptions {
  /** Record type label to select (e.g., "Transportation", "Warehouse") */
  recordType: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Select record type result
 */
export interface SelectRecordTypeResult {
  /** Whether selection was successful */
  success: boolean;
  /** The selected record type */
  selectedType?: string;
  /** The radio button ID that was selected */
  radioBtnId?: string;
}

/**
 * Get available record types parameters
 */
export interface GetRecordTypesParams extends BaseToolOptions {
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Get available record types result
 */
export interface GetRecordTypesResult {
  /** Whether retrieval was successful */
  success: boolean;
  /** List of available record types */
  recordTypes?: string[];
}

/**
 * Select Record Type Tool
 * Selects a record type from a Salesforce record type modal
 * Handles the modal dialog with radio buttons that appears when creating records
 */
export class SelectRecordTypeTool extends BaseTool<SelectRecordTypeParams, SelectRecordTypeResult> {
  protected toolName = 'browser_click';

  async execute(params: SelectRecordTypeParams): Promise<McpToolResult<SelectRecordTypeResult>> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      const recordTypeText = params.recordType.trim();

      // Enhanced script with comprehensive strategies and proper event handling
      const clickRecordTypeScript = `
        (async function() {
          const targetText = "${recordTypeText}";
          let selectedRadio = null;
          let method = '';
          
          console.log('🔍 Looking for record type: ' + targetText);
          
          // Strategy 1: Look for exact label text match (Lightning Design System)
          const labels = Array.from(document.querySelectorAll('label'));
          console.log('📋 Found ' + labels.length + ' labels');
          
          for (const label of labels) {
            const text = label.textContent?.trim() || '';
            console.log('📝 Checking label text: "' + text.substring(0, 50) + '"');
            
            if (text.startsWith(targetText)) {
              console.log('✅ Found matching label: "' + text + '"');
              const radioInput = label.querySelector('input[type="radio"]');
              
              if (radioInput) {
                selectedRadio = radioInput;
                method = 'label-exact-match';
                console.log('✅ Found radio input for ' + targetText);
                break;
              }
            }
          }
          
          // Strategy 2: Look for any label/radio pair with matching text (case-insensitive)
          if (!selectedRadio) {
            console.log('⏭️ Strategy 1 failed, trying Strategy 2...');
            
            for (const label of labels) {
              const text = label.textContent?.trim() || '';
              if (text.toLowerCase().startsWith(targetText.toLowerCase())) {
                console.log('✅ Found case-insensitive match: "' + text + '"');
                selectedRadio = label.querySelector('input[type="radio"]');
                
                if (!selectedRadio) {
                  const forId = label.getAttribute('for');
                  if (forId) {
                    selectedRadio = document.getElementById(forId);
                    if (selectedRadio && selectedRadio.type !== 'radio') {
                      selectedRadio = null;
                    }
                  }
                }
                method = 'label-case-insensitive';
                if (selectedRadio) break;
              }
            }
          }
          
          // Strategy 3: Find radio buttons and check parent container text
          if (!selectedRadio) {
            console.log('⏭️ Strategy 2 failed, trying Strategy 3...');
            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
            console.log('📻 Found ' + radios.length + ' radio buttons');
            
            for (const radio of radios) {
              let parent = radio.closest('.changeRecordTypeOption, [class*="option"], [role="group"], label');
              if (!parent) parent = radio.parentElement;
              
              if (parent && parent.textContent) {
                const parentText = parent.textContent.toLowerCase();
                if (parentText.includes(targetText.toLowerCase())) {
                  console.log('✅ Found matching parent text');
                  selectedRadio = radio;
                  method = 'parent-container';
                  break;
                }
              }
            }
          }
          
          // Strategy 4: Direct search in modal by looking at all text nodes
          if (!selectedRadio) {
            console.log('⏭️ Strategy 3 failed, trying Strategy 4...');
            const modal = document.querySelector('.forceChangeRecordType, [class*="changeRecordType"], [data-aura-class*="Modal"], [role="dialog"]');
            
            if (modal) {
              const radios = Array.from(modal.querySelectorAll('input[type="radio"]'));
              console.log('🔎 Found ' + radios.length + ' radios in modal');
              
              for (const radio of radios) {
                const container = radio.closest('[class*="option"], div[data-aura-rendered-by]');
                if (container && container.textContent.toLowerCase().includes(targetText.toLowerCase())) {
                  console.log('✅ Found via modal search');
                  selectedRadio = radio;
                  method = 'modal-search';
                  break;
                }
              }
            }
          }
          
          if (!selectedRadio) {
            console.log('❌ Could not find record type: ' + targetText);
            return { success: false, error: 'Record type not found: ' + targetText };
          }
          
          console.log('📍 Selected radio using method: ' + method);
          
          // Execute the click with proper event handling
          try {
            // Step 1: Set checked property
            selectedRadio.checked = true;
            console.log('✅ Set checked = true');
            
            // Step 2: Dispatch input event
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            selectedRadio.dispatchEvent(inputEvent);
            console.log('✅ Dispatched input event');
            
            // Step 3: Dispatch change event (critical for Salesforce Lightning)
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            selectedRadio.dispatchEvent(changeEvent);
            console.log('✅ Dispatched change event');
            
            // Step 4: Dispatch click event
            const clickEvent = new MouseEvent('click', { 
              bubbles: true, 
              cancelable: true,
              view: window 
            });
            selectedRadio.dispatchEvent(clickEvent);
            console.log('✅ Dispatched click event');
            
            // Step 5: Also dispatch on the parent label if it exists
            const parentLabel = selectedRadio.closest('label');
            if (parentLabel) {
              parentLabel.dispatchEvent(clickEvent);
              console.log('✅ Dispatched click event on parent label');
            }
            
            // Step 6: Wait for Salesforce to process the events
            await new Promise(resolve => setTimeout(resolve, 800));
            console.log('⏳ Waited 800ms for event processing');
            
            // Step 7: Verify the selection was registered
            const isStillChecked = selectedRadio.checked;
            const parentText = parentLabel?.textContent?.trim() || selectedRadio.parentElement?.textContent?.trim() || '';
            const verified = isStillChecked && parentText.includes(targetText);
            
            if (verified) {
              console.log('✅ Verified: Selection registered successfully');
            } else {
              console.log('⚠️ Warning: Selection may not be fully registered');
            }
            
            // Step 8: Check if Next button is now enabled
            const nextButton = Array.from(document.querySelectorAll('button'))
              .find(btn => btn.textContent?.includes('Next'));
            const nextEnabled = nextButton && !nextButton.hasAttribute('disabled');
            console.log('🔘 Next button enabled: ' + nextEnabled);
            
            return { 
              success: true, 
              method: method, 
              id: selectedRadio.id,
              isChecked: isStillChecked,
              verified: verified,
              nextEnabled: nextEnabled
            };
          } catch (e) {
            console.log('❌ Error during click: ' + e.message);
            return { success: false, error: 'Failed to click radio: ' + e.message };
          }
        })()
      `;

      const clickResult = await this.client.executeTool('browser_evaluate', {
        function: clickRecordTypeScript,
      } as any);

      if (!clickResult.success) {
        return {
          success: false,
          error: `Failed to execute script: ${clickResult.error}`,
          errorCode: 'SCRIPT_ERROR',
          duration: Date.now() - startTime,
          toolName: this.toolName,
          timestamp: new Date(),
        };
      }

      const resultData = clickResult.data as { success: boolean; method?: string; id?: string; error?: string };
      
      if (!resultData || !resultData.success) {
        return {
          success: false,
          error: resultData?.error || `Record type "${params.recordType}" not found in modal`,
          errorCode: 'RECORD_TYPE_NOT_FOUND',
          duration: Date.now() - startTime,
          toolName: this.toolName,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        data: {
          success: true,
          selectedType: params.recordType,
          radioBtnId: resultData.id,
        },
        duration: Date.now() - startTime,
        toolName: this.toolName,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'RECORD_TYPE_ERROR',
        duration: Date.now() - startTime,
        toolName: this.toolName,
        timestamp: new Date(),
      };
    }
  }
}

/**
 * Get Available Record Types Tool
 * Retrieves all available record type options from a Salesforce record type modal
 */
export class GetRecordTypesTool extends BaseTool<GetRecordTypesParams, GetRecordTypesResult> {
  protected toolName = 'browser_evaluate';

  async execute(params: GetRecordTypesParams): Promise<McpToolResult<GetRecordTypesResult>> {
    this.validateConnection();
    const startTime = Date.now();

    try {
      // Find all record type labels in the modal
      const getTypesScript = `
        const labels = document.querySelectorAll('label.slds-radio span.slds-form-element__label');
        const recordTypes = Array.from(labels).map(label => label.textContent.trim());
        return recordTypes;
      `;

      const result = await this.client.executeTool('browser_evaluate', {
        function: `() => {
          ${getTypesScript}
        }`,
      } as any);

      if (!result.success || !Array.isArray(result.data)) {
        return {
          success: false,
          error: 'Failed to retrieve record types from modal',
          errorCode: 'RETRIEVAL_FAILED',
          duration: Date.now() - startTime,
          toolName: this.toolName,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        data: {
          success: true,
          recordTypes: result.data,
        },
        duration: Date.now() - startTime,
        toolName: this.toolName,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'GET_TYPES_ERROR',
        duration: Date.now() - startTime,
        toolName: this.toolName,
        timestamp: new Date(),
      };
    }
  }
}
