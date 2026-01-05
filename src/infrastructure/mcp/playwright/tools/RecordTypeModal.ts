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

      // Combined script to find and click the radio button in one go
      // This handles various Salesforce Lightning DOM structures
      const clickRecordTypeScript = `
        (function() {
          const targetText = "${recordTypeText}";
          
          // Strategy 1: Look for slds-radio labels (Lightning Design System)
          const sldsLabels = document.querySelectorAll('label.slds-radio');
          for (const label of sldsLabels) {
            const labelSpan = label.querySelector('span.slds-form-element__label');
            if (labelSpan && labelSpan.textContent.trim() === targetText) {
              const radio = label.querySelector('input[type="radio"]');
              if (radio) {
                radio.click();
                return { success: true, method: 'slds-radio', id: radio.id };
              }
            }
          }
          
          // Strategy 2: Look for any label/radio pair with matching text
          const allLabels = document.querySelectorAll('label');
          for (const label of allLabels) {
            const text = label.textContent || '';
            // Check if label text starts with the target (handles "Transportation\\nTo be used...")
            if (text.trim().startsWith(targetText)) {
              const radio = label.querySelector('input[type="radio"]');
              if (radio) {
                radio.click();
                return { success: true, method: 'label-text', id: radio.id };
              }
              // Try finding radio by for attribute
              const forId = label.getAttribute('for');
              if (forId) {
                const radio = document.getElementById(forId);
                if (radio && radio.type === 'radio') {
                  radio.click();
                  return { success: true, method: 'label-for', id: forId };
                }
              }
            }
          }
          
          // Strategy 3: Look for radio buttons near text containing the target
          const allText = document.body.innerText;
          if (allText.includes(targetText)) {
            // Find all radio buttons and check their associated text
            const radios = document.querySelectorAll('input[type="radio"]');
            for (const radio of radios) {
              // Check parent elements for the text
              let parent = radio.parentElement;
              for (let i = 0; i < 5 && parent; i++) {
                if (parent.textContent && parent.textContent.trim().startsWith(targetText)) {
                  radio.click();
                  return { success: true, method: 'parent-text', id: radio.id };
                }
                parent = parent.parentElement;
              }
            }
          }
          
          // Strategy 4: Look in the changeRecordType modal specifically
          const modal = document.querySelector('.forceChangeRecordType, [class*="changeRecordType"]');
          if (modal) {
            const labels = modal.querySelectorAll('label');
            for (const label of labels) {
              if (label.textContent && label.textContent.includes(targetText)) {
                const radio = label.querySelector('input[type="radio"]') || 
                              label.previousElementSibling?.querySelector('input[type="radio"]');
                if (radio) {
                  radio.click();
                  return { success: true, method: 'modal-label', id: radio.id };
                }
              }
            }
          }
          
          return { success: false, error: 'Record type not found: ' + targetText };
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
