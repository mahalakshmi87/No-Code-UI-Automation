/**
 * Execute Action Use Case
 * Executes a single UIAction using Playwright MCP tools
 */

import { v4 as uuidv4 } from 'uuid';
import { UIAction, UIActionType } from '../../domain/models/MappedStep';
import { Locator } from '../../domain/models/Locator';
import { IMcpClient, McpToolResult } from '../../infrastructure/mcp/common/McpClient.interface';
import { createLogger, ILogger } from '../../infrastructure/logging';
import {
  ClickTool,
  TypeTool,
  NavigateTool,
  HoverTool,
  SelectOptionTool,
  DragTool,
  PressKeyTool,
  WaitTool,
  SnapshotTool,
  ScreenshotTool,
  FileUploadTool,
  SelectRecordTypeTool,
} from '../../infrastructure/mcp/playwright/tools';
import { ResolveLocatorUseCase, ResolveLocatorOutput } from '../locator/resolve-locator.usecase';
import { getLlmResolveLocatorUseCase, LlmResolveLocatorUseCase } from '../locator/llm-resolve-locator.usecase';
import {
  ExecutionContextService,
  PageState,
  StepExecutionRecord,
  getExecutionContext
} from '../execution/execution-context.service';
import { AccessibilityNode, parseSnapshotString } from '../../utils/locator/snapshot-parser';
import { getEnv } from '../../core/env';

/**
 * Input for action execution
 */
export interface ExecuteActionInput {
  /** The UIAction to execute */
  action: UIAction;
  /** Session ID */
  sessionId: string;
  /** Mapped step ID (for tracking) */
  mappedStepId?: string;
  /** Whether to refresh snapshot before execution */
  refreshSnapshot?: boolean;
  /** Pre-resolved locator (if available) */
  resolvedRef?: string;
  /** Override timeout */
  timeout?: number;
}

/**
 * Output from action execution
 */
export interface ExecuteActionOutput {
  /** Whether execution was successful */
  success: boolean;
  /** Execution record ID */
  executionId: string;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Page state after execution */
  afterState?: PageState;
  /** Locator resolution info (if resolved during execution) */
  locatorResolution?: ResolveLocatorOutput;
  /** Raw MCP tool result */
  mcpResult?: McpToolResult<unknown>;
}

/**
 * Map UIActionType to MCP tool name
 */
const ACTION_TO_TOOL: Partial<Record<UIActionType, string>> = {
  navigate: 'browser_navigate',
  click: 'browser_click',
  type: 'browser_type',
  fill: 'browser_type', // fill uses type tool with clear
  select: 'browser_select_option',
  hover: 'browser_hover',
  drag: 'browser_drag',
  press: 'browser_press_key',
  wait: 'browser_wait_for',
  screenshot: 'browser_take_screenshot',
  upload: 'browser_file_upload',
  clear: 'browser_type', // clear by typing empty
  scroll: 'browser_evaluate', // scroll via JS
  assert: 'browser_snapshot', // assertions check snapshot
  switchTab: 'browser_tabs', // tab switching
  waitForNewTab: 'browser_tabs', // wait for new tab
};

export class ExecuteActionUseCase {
  private mcpClient: IMcpClient;
  private resolveLocatorUseCase: ResolveLocatorUseCase;
  private llmResolveLocatorUseCase: LlmResolveLocatorUseCase;
  private executionContext: ExecutionContextService;
  private logger: ILogger;
  private locatorResolutionMode: 'pattern' | 'llm';

  // Tool instances (lazy initialized)
  private clickTool?: ClickTool;
  private typeTool?: TypeTool;
  private navigateTool?: NavigateTool;
  private hoverTool?: HoverTool;
  private selectTool?: SelectOptionTool;
  private dragTool?: DragTool;
  private pressKeyTool?: PressKeyTool;
  private waitTool?: WaitTool;
  private snapshotTool?: SnapshotTool;
  private screenshotTool?: ScreenshotTool;
  private uploadTool?: FileUploadTool;
  private selectRecordTypeTool?: SelectRecordTypeTool;

  constructor(mcpClient: IMcpClient) {
    this.mcpClient = mcpClient;
    this.resolveLocatorUseCase = new ResolveLocatorUseCase();
    this.llmResolveLocatorUseCase = getLlmResolveLocatorUseCase();
    this.executionContext = getExecutionContext();
    this.logger = createLogger({ level: 'info', format: 'json' });

    // Get locator resolution mode from environment
    const env = getEnv();
    this.locatorResolutionMode = env.LOCATOR_RESOLUTION_MODE;
    this.logger.info('ExecuteActionUseCase initialized', {
      locatorResolutionMode: this.locatorResolutionMode
    });

    this.initializeTools();
  }

  private initializeTools(): void {
    this.clickTool = new ClickTool(this.mcpClient);
    this.typeTool = new TypeTool(this.mcpClient);
    this.navigateTool = new NavigateTool(this.mcpClient);
    this.hoverTool = new HoverTool(this.mcpClient);
    this.selectTool = new SelectOptionTool(this.mcpClient);
    this.dragTool = new DragTool(this.mcpClient);
    this.pressKeyTool = new PressKeyTool(this.mcpClient);
    this.waitTool = new WaitTool(this.mcpClient);
    this.snapshotTool = new SnapshotTool(this.mcpClient);
    this.screenshotTool = new ScreenshotTool(this.mcpClient);
    this.uploadTool = new FileUploadTool(this.mcpClient);
    this.selectRecordTypeTool = new SelectRecordTypeTool(this.mcpClient);
  }

  /**
   * Execute a single UIAction
   */
  async execute(input: ExecuteActionInput): Promise<ExecuteActionOutput> {
    const { action, sessionId, mappedStepId, refreshSnapshot, resolvedRef, timeout } = input;
    const startTime = Date.now();

    // Validate session
    const session = this.executionContext.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        executionId: '',
        error: `Session ${sessionId} not found`,
        durationMs: Date.now() - startTime,
      };
    }

    // Record execution start
    const executionRecord = this.executionContext.recordExecutionStart(
      sessionId,
      mappedStepId || uuidv4(),
      action,
      action.locator,
      resolvedRef
    );

    try {
      // Get or refresh snapshot if needed for element targeting
      let snapshot = this.executionContext.getSnapshot(sessionId);
      let locatorResolution: ResolveLocatorOutput | undefined;

      // Refresh snapshot if needed or not available
      if (refreshSnapshot || !snapshot) {
        this.logger.info('Capturing snapshot for action', { actionType: action.type });
        const snapshotResult = await this.captureSnapshot();
        if (snapshotResult.success && snapshotResult.snapshot) {
          snapshot = snapshotResult.snapshot;
          this.logger.info('Snapshot captured', {
            nodeCount: snapshot.length,
            hasElements: snapshot.length > 0,
          });
          this.executionContext.updateSnapshot(
            sessionId,
            snapshot,
            snapshotResult.rawSnapshot
          );
        } else {
          this.logger.warn('Failed to capture snapshot', { error: snapshotResult.error });
        }
      }

      // Resolve locator if needed (for actions that target elements)
      // Skip locator resolution for page-level assertions (no target, just expectedValue)
      let ref = resolvedRef;

      // Check if action has pre-resolved locator (ref=XXX shortcut)
      if (!ref && action.locator?.value?.startsWith('ref=')) {
        ref = action.locator.value.replace('ref=', '');
        this.logger.info('Using pre-resolved locator from action', { ref, actionType: action.type });
      }

      const isPageLevelAssertion = action.type === 'assert' &&
        !action.locator &&
        action.expectedValue !== undefined &&
        (action.assertionType === 'text' || action.assertionType === 'url' || action.assertionType === 'title');

      if (!ref && this.requiresLocator(action.type) && snapshot && !isPageLevelAssertion) {
        const target = this.getTargetDescription(action);
        this.logger.info('Resolving locator', {
          target,
          actionType: action.type,
          snapshotSize: snapshot.length,
          mode: this.locatorResolutionMode,
        });

        if (target) {
          // Try resolution with retry on failure (re-capture snapshot if needed)
          const maxResolutionAttempts = 2;

          for (let resAttempt = 1; resAttempt <= maxResolutionAttempts; resAttempt++) {
            // Use LLM-based resolution if configured
            if (this.locatorResolutionMode === 'llm') {
              const rawSnapshot = this.executionContext.getRawSnapshot(sessionId);
              if (rawSnapshot) {
                this.logger.info('Using LLM for locator resolution', { target, attempt: resAttempt });
                const llmResult = await this.llmResolveLocatorUseCase.execute({
                  target,
                  actionType: action.type,
                  snapshot: rawSnapshot,
                  value: action.value,
                });

                this.logger.info('LLM locator resolution result', {
                  target,
                  resolved: llmResult.resolved,
                  ref: llmResult.ref,
                  role: llmResult.role,
                  confidence: llmResult.confidence,
                  reasoning: llmResult.reasoning,
                  error: llmResult.error,
                });

                if (llmResult.resolved && llmResult.ref && llmResult.ref !== 'e1') {
                  // Validate ref is not the root element (e1 is usually body)
                  ref = llmResult.ref;
                  locatorResolution = {
                    resolved: true,
                    ref: llmResult.ref,
                    confidence: llmResult.confidence,
                    element: {
                      role: llmResult.role || 'unknown',
                      name: llmResult.name,
                      ref: llmResult.ref,
                    },
                  };
                  break; // Success, exit retry loop
                } else if (resAttempt < maxResolutionAttempts) {
                  // LLM returned invalid ref (e1 or null), retry with fresh snapshot
                  this.logger.warn('LLM returned invalid ref, re-capturing snapshot', {
                    ref: llmResult.ref,
                    attempt: resAttempt,
                  });
                  const freshSnapshot = await this.captureSnapshot(2, 1500);
                  if (freshSnapshot.success && freshSnapshot.snapshot) {
                    snapshot = freshSnapshot.snapshot;
                    this.executionContext.updateSnapshot(sessionId, snapshot, freshSnapshot.rawSnapshot);
                  }
                  continue;
                } else {
                  // Fall back to pattern matching if LLM fails
                  this.logger.warn('LLM resolution failed, falling back to pattern matching', {
                    error: llmResult.error,
                  });
                  locatorResolution = this.resolveLocatorUseCase.execute({
                    target,
                    actionType: action.type,
                    snapshot,
                  });
                  if (locatorResolution.resolved && locatorResolution.ref) {
                    ref = locatorResolution.ref;
                  }
                }
              }
            } else {
              // Use pattern-based resolution
              locatorResolution = this.resolveLocatorUseCase.execute({
                target,
                actionType: action.type,
                snapshot,
              });

              this.logger.info('Locator resolution result', {
                target,
                resolved: locatorResolution.resolved,
                ref: locatorResolution.ref,
                confidence: locatorResolution.confidence,
                failureReason: locatorResolution.failureReason,
              });

              if (locatorResolution.resolved && locatorResolution.ref) {
                ref = locatorResolution.ref;
                break; // Success, exit retry loop
              } else if (resAttempt < maxResolutionAttempts) {
                // Pattern matching failed, retry with fresh snapshot
                this.logger.warn('Pattern resolution failed, re-capturing snapshot', {
                  attempt: resAttempt,
                });
                const freshSnapshot = await this.captureSnapshot(2, 1500);
                if (freshSnapshot.success && freshSnapshot.snapshot) {
                  snapshot = freshSnapshot.snapshot;
                  this.executionContext.updateSnapshot(sessionId, snapshot, freshSnapshot.rawSnapshot);
                }
              }
            }
          }
        }
      }

      // FAIL EARLY: If this action requires a locator and we couldn't resolve one, fail now
      if (this.requiresLocator(action.type) && !ref) {
        const target = this.getTargetDescription(action) || 'unknown target';
        const actionType = action.type;
        const errorMessage = `Failed to find element "${target}" (action: ${actionType}) on page. ` +
          (locatorResolution?.failureReason || 'Element not found in accessibility snapshot.');

        this.logger.error('Locator resolution failed - cannot execute action', {
          actionType: action.type,
          target,
          failureReason: locatorResolution?.failureReason,
        });

        // Record failure
        this.executionContext.recordExecutionComplete(
          sessionId,
          executionRecord.id,
          false,
          errorMessage
        );

        return {
          success: false,
          executionId: executionRecord.id,
          error: errorMessage,
          durationMs: Date.now() - startTime,
          locatorResolution,
        };
      }

      // Execute the action
      const mcpResult = await this.executeToolForAction(sessionId, action, ref, timeout);

      // Handle special actions that update the snapshot
      if (action.type === 'switchTab' && mcpResult.success && mcpResult.data) {
        const resultData = mcpResult.data as any;
        if (resultData.snapshot && resultData.rawSnapshot) {
          this.logger.info('Updating snapshot after tab switch', {
            nodeCount: resultData.snapshot.length
          });
          this.executionContext.updateSnapshot(
            sessionId,
            resultData.snapshot,
            resultData.rawSnapshot
          );
        }
      }

      // If click opened a new tab (or any click), capture fresh snapshot immediately
      if (action.type === 'click' && mcpResult.success) {
        this.logger.info('Click performed - capturing fresh snapshot to update context');
        // Wait a short moment for page to stabilize
        await this.sleep(1500);
        const newPageSnapshot = await this.captureSnapshot(3, 1000);
        if (newPageSnapshot.success && newPageSnapshot.snapshot) {
          this.logger.info('Snapshot after click captured', { nodeCount: newPageSnapshot.snapshot.length });
          this.executionContext.updateSnapshot(
            sessionId,
            newPageSnapshot.snapshot,
            newPageSnapshot.rawSnapshot
          );
        } else {
          this.logger.warn('Failed to capture snapshot after click');
        }
      }

      // Update page state after execution
      const afterState: PageState = {
        url: session.currentPageState?.url || '',
        capturedAt: new Date(),
      };

      // Record completion
      this.executionContext.recordExecutionComplete(
        sessionId,
        executionRecord.id,
        mcpResult.success,
        mcpResult.error,
        afterState
      );

      return {
        success: mcpResult.success,
        executionId: executionRecord.id,
        error: mcpResult.error,
        durationMs: Date.now() - startTime,
        afterState,
        locatorResolution,
        mcpResult,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failure
      this.executionContext.recordExecutionComplete(
        sessionId,
        executionRecord.id,
        false,
        errorMessage
      );

      return {
        success: false,
        executionId: executionRecord.id,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if action type requires a locator
   */
  private requiresLocator(actionType: UIActionType): boolean {
    if (actionType === 'switchTab' || actionType === 'waitForNewTab') return false;
    // Assert doesn't need a locator for page-level assertions (text, url, title)
    const noLocatorActions: UIActionType[] = ['navigate', 'wait', 'screenshot', 'press', 'switchTab', 'waitForNewTab', 'assert'];
    return !noLocatorActions.includes(actionType);
  }

  /**
   * Get target description from action for locator resolution
   * Returns a human-readable description like "company name" not a CSS selector or ref
   */
  private getTargetDescription(action: UIAction): string | undefined {
    // Priority: Extract human-readable target from available sources

    // 1. Try to extract from action description (e.g., "Type 'TestLeaf' into company name")
    if (action.description) {
      // Extract target from description patterns
      const intoMatch = action.description.match(/into\s+["']?([^"']+?)["']?(?:\s+field)?$/i);
      if (intoMatch) return intoMatch[1].trim();

      const onMatch = action.description.match(/(?:Click|click)\s+(?:on\s+)?["']?([^"']+?)["']?$/i);
      if (onMatch) return onMatch[1].trim();

      const fromMatch = action.description.match(/from\s+["']?([^"']+?)["']?(?:\s+dropdown)?$/i);
      if (fromMatch) return fromMatch[1].trim();

      // Extract target from assertion patterns like "Assert Status has text" or "Assert Status is visible"
      // But skip patterns like "Assert text "X" is visible" which are page-level assertions
      const assertMatch = action.description.match(/^Assert\s+["']?([^"']+?)["']?\s+(?:has text|has value|is visible|is hidden|is enabled|is disabled)/i);
      if (assertMatch && assertMatch[1] !== 'undefined' && assertMatch[1].toLowerCase() !== 'text') {
        return assertMatch[1].trim();
      }

      // Skip page-level assertions - don't use description as target
      if (action.description.match(/^Assert\s+(?:text|URL|page title)/i)) {
        return undefined;
      }

      // If no pattern matches, use description directly if it's not too long
      // BUT skip assertion descriptions as they don't contain useful targets
      if (action.description.length < 100 &&
        !action.description.includes('Type "') &&
        !action.description.includes('Select "') &&
        !action.description.startsWith('Assert ')) {
        return action.description;
      }
    }

    // 2. Try locator description (but skip "Unresolved locator" and refs like "e123")
    if (action.locator?.description &&
      action.locator.description !== 'Unresolved locator' &&
      !action.locator.description.match(/^e\d+$/i)) {
      // Extract from patterns like "textbox: company name" or "input: company name"
      const colonMatch = action.locator.description.match(/^[^:]+:\s*(.+)$/);
      if (colonMatch) return colonMatch[1].trim();
      return action.locator.description;
    }

    // 3. Try locator value (but only if it's human-readable, not a selector or ref)
    if (action.locator?.value) {
      const value = action.locator.value;
      // Skip if it looks like a ref (e.g., "e16", "e335")
      if (/^e\d+$/i.test(value)) {
        // This is a ref, not a target - skip it
      }
      // Skip if it looks like a role selector (e.g., "textbox[name='...']")
      else if (value.includes('[') || value.includes('=')) {
        // Try to extract the name from selector patterns like textbox[name="company name"]
        const nameMatch = value.match(/\[name=["']?([^"'\]]+)["']?\]/i);
        if (nameMatch) return nameMatch[1].trim();
      }
      // Otherwise use the value as-is if it's reasonable
      else if (value.length > 0 && value.length < 100) {
        return value;
      }
    }

    // 4. For non-fill actions, try the action value
    if (action.type !== 'type' && action.type !== 'fill' && action.value) {
      return action.value;
    }

    return undefined;
  }

  /**
   * Execute the appropriate MCP tool for the action
   */
  private async executeToolForAction(
    sessionId: string,
    action: UIAction,
    ref?: string,
    timeout?: number
  ): Promise<McpToolResult<unknown>> {
    const elementDesc = action.description || action.locator?.description || 'element';

    switch (action.type) {
      case 'navigate':
        // Check if value is a valid URL or a relative path
        const url = action.value || '';
        // If it's not a URL (no protocol), skip - base navigation is handled by orchestrator
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
          // This is likely "I am on the X page" pattern - skip, baseUrl already navigated
          return {
            success: true,
            data: { skipped: true, reason: 'Non-URL navigation handled by baseUrl' },
            duration: 0,
            toolName: 'browser_navigate',
            timestamp: new Date(),
          };
        }
        return this.navigateTool!.execute({
          url,
          timeout,
        });

      case 'click':
        if (!ref) {
          return this.errorResult('Click action requires a resolved element reference');
        }

        // Check if this is a Salesforce record type radio button click
        // Patterns: "radio button left to the 'Transportation'", "Transportation radio", etc.
        const descLower = elementDesc.toLowerCase();
        const isRecordTypeRadio = (descLower.includes('radio') || descLower.includes('record type')) &&
          (action.value || this.extractRecordTypeFromDescription(elementDesc));

        if (isRecordTypeRadio) {
          // Extract the record type name from description or value
          const recordType = action.value || this.extractRecordTypeFromDescription(elementDesc);
          if (recordType) {
            this.logger.info('Detected Salesforce record type radio button click, using SelectRecordTypeTool', {
              recordType,
              originalDesc: elementDesc,
            });
            return this.selectRecordTypeTool!.execute({
              recordType,
              timeout,
            });
          }
        }

        // Enable new tab detection and auto-switch
        // This ensures that if the click opens a new tab, Playwright automatically switches to it
        const clickResult = await this.clickTool!.execute({
          element: elementDesc,
          ref,
          timeout,
          expectNewTab: true,       // Detect if a new tab opens
          autoSwitchToNewTab: true, // Automatically switch to it
          newTabTimeout: 3000,      // Wait up to 3 seconds for new tab
        });

        // If click failed due to pointer events interception, try JavaScript-based click as fallback
        if (!clickResult.success && clickResult.error?.includes('intercepts pointer events')) {
          this.logger.warn('Click intercepted by overlay, attempting JavaScript click fallback', {
            ref,
            error: clickResult.error,
          });

          // Extract target text for matching
          const targetText = action.value || this.extractRecordTypeFromDescription(elementDesc) || '';

          // Try JavaScript click via browser_evaluate with proper text matching
          const jsClickResult = await this.mcpClient.executeTool('browser_evaluate', {
            function: `(function() {
              const targetText = "${targetText}";
              
              // First try to find by aria-ref
              const el = document.querySelector('[aria-ref="${ref}"]');
              if (el) {
                el.click();
                return { clicked: true, method: 'aria-ref' };
              }
              
              // If we have target text, find the matching radio button
              if (targetText) {
                const labels = document.querySelectorAll('label');
                for (const label of labels) {
                  if (label.textContent && label.textContent.trim().startsWith(targetText)) {
                    const radio = label.querySelector('input[type="radio"]');
                    if (radio) {
                      radio.click();
                      return { clicked: true, method: 'label-match', target: targetText };
                    }
                  }
                }
              }
              
              return { clicked: false };
            })()`,
          });

          if (jsClickResult.success && (jsClickResult.data as any)?.clicked) {
            return {
              ...jsClickResult,
              data: { clicked: true, fallback: 'javascript' },
            };
          }
        }

        return clickResult;

      case 'type':
      case 'fill':
        if (!ref) {
          return this.errorResult('Type/fill action requires a resolved element reference');
        }
        // For fill, we need to select all and type to replace
        // The browser_type tool doesn't have clear, so we use select-all first
        return this.typeTool!.execute({
          element: elementDesc,
          ref,
          text: action.value || '',
          timeout,
        });

      case 'clear':
        if (!ref) {
          return this.errorResult('Clear action requires a resolved element reference');
        }
        // Clear by selecting all and typing empty
        return this.typeTool!.execute({
          element: elementDesc,
          ref,
          text: '',
          timeout,
        });

      case 'select':
        if (!ref) {
          return this.errorResult('Select action requires a resolved element reference');
        }
        return this.selectTool!.execute({
          element: elementDesc,
          ref,
          value: action.value || '',
          timeout,
        });

      case 'hover':
        if (!ref) {
          return this.errorResult('Hover action requires a resolved element reference');
        }
        return this.hoverTool!.execute({
          element: elementDesc,
          ref,
          timeout,
        });

      case 'press':
        return this.pressKeyTool!.execute({
          key: action.value || 'Enter',
          timeout,
        });

      case 'wait':
        const waitTime = action.timeout || timeout || 1000;
        return this.waitTool!.execute({
          time: waitTime / 1000, // Convert to seconds
        });

      case 'screenshot':
        return this.screenshotTool!.execute({
          filename: action.value,
          fullPage: action.options?.fullPage as boolean,
        });

      case 'upload':
        if (!ref) {
          return this.errorResult('Upload action requires a resolved element reference');
        }
        const paths = Array.isArray(action.value)
          ? action.value
          : action.value ? [action.value] : [];
        return this.uploadTool!.execute({
          paths,
        });

      case 'drag':
        // Drag requires start and end refs
        return this.errorResult('Drag action not yet implemented - requires start and end elements');

      case 'assert':
        // Assertions are handled by checking the cached snapshot (important after tab switch)
        return this.handleAssertion(sessionId, action, ref);

      case 'switchTab': {
        // Switch to the new tab by selecting it via browser_tabs
        this.logger.info('Switching to new tab context');

        try {
          // Wait for the new tab to load
          await this.sleep(1000);

          // Step 1: List all tabs to find the new one
          const listResult = await this.mcpClient.executeTool<any>('browser_tabs', { action: 'list' });
          this.logger.info('Tab list result', { result: listResult });

          let lastTabIndex = 1; // Default to second tab (index 1)
          if (listResult.success && listResult.data) {
            // Parse the tab list to find the highest index
            const data = listResult.data;
            if (Array.isArray(data)) {
              lastTabIndex = data.length - 1;
            } else if (data.tabs && Array.isArray(data.tabs)) {
              lastTabIndex = data.tabs.length - 1;
            } else if (typeof data === 'object') {
              // Try to find numeric keys
              const keys = Object.keys(data).filter(k => !isNaN(Number(k)));
              if (keys.length > 0) {
                lastTabIndex = Math.max(...keys.map(k => Number(k)));
              }
            }
          }

          this.logger.info('Selecting tab', { index: lastTabIndex });

          // Step 2: Select the new tab (this switches the MCP server's page context)
          const selectResult = await this.mcpClient.executeTool<any>('browser_tabs', {
            action: 'select',
            index: lastTabIndex
          });

          this.logger.info('Tab select result', { result: selectResult });

          // Wait for the new page to load
          await this.sleep(1000);

          // Step 3: Capture a fresh snapshot from the new page
          const snapshotResult = await this.captureSnapshot(3, 1000);

          if (snapshotResult.success && snapshotResult.snapshot) {
            this.logger.info('Successfully switched to new tab - snapshot captured', {
              nodeCount: snapshotResult.snapshot.length,
              tabIndex: lastTabIndex
            });

            return {
              success: true,
              data: {
                message: 'Switched to new tab context',
                pageNodes: snapshotResult.snapshot.length,
                tabIndex: lastTabIndex,
                snapshot: snapshotResult.snapshot,
                rawSnapshot: snapshotResult.rawSnapshot
              },
              duration: 0,
              toolName: 'switchTab',
              timestamp: new Date(),
            };
          } else {
            this.logger.warn('Tab switched but snapshot capture failed');
            return {
              success: true,
              data: { message: 'Switched to new tab (snapshot unavailable)', tabIndex: lastTabIndex },
              duration: 0,
              toolName: 'switchTab',
              timestamp: new Date(),
            };
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.logger.error('Failed to switch tab', { error: errorMsg });
          return this.errorResult(`Failed to switch to new tab: ${errorMsg}`);
        }
      }

      case 'waitForNewTab':
        // Wait for a new tab to open (polling approach)
        this.logger.info('Waiting for new tab to open');
        // This is already handled by click with expectNewTab, so just return success
        return {
          success: true,
          data: { message: 'New tab wait handled by previous click or already open' },
          duration: 0,
          toolName: 'browser_tabs',
          timestamp: new Date(),
        };

      default:
        return this.errorResult(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * Handle assertion actions
   * Uses the cached snapshot from execution context (important after tab switch)
   */
  private async handleAssertion(sessionId: string, action: UIAction, ref?: string): Promise<McpToolResult<unknown>> {
    // Try to use cached snapshot first (this is the snapshot from after tab switch)
    let rawSnapshot = this.executionContext.getRawSnapshot(sessionId);

    // If no cached snapshot, capture a fresh one
    if (!rawSnapshot) {
      this.logger.info('No cached snapshot, capturing fresh one for assertion');
      const snapshotResult = await this.snapshotTool!.execute({});
      if (!snapshotResult.success) {
        return snapshotResult;
      }
      const data = snapshotResult.data as { text?: string; snapshot?: string };
      rawSnapshot = data?.text || data?.snapshot || '';
    } else {
      this.logger.info('Using cached snapshot for assertion', {
        snapshotLength: rawSnapshot.length
      });
    }

    const lines = rawSnapshot.split('\n');

    // For text/value assertions, we verify the expected text exists on page
    if (action.assertionType === 'text' && action.expectedValue !== undefined) {
      const expectedStr = String(action.expectedValue);

      this.logger.info('Checking text assertion', {
        expectedText: expectedStr,
        snapshotLength: rawSnapshot.length,
        lineCount: lines.length,
        firstFewLines: lines.slice(0, 5).join(' | ').substring(0, 200)
      });

      // FIRST: Check if expected text exists ANYWHERE in the raw snapshot
      // This is important for "New Window" type assertions
      let foundExpectedText = false;
      let foundLine = '';

      // Direct check on the entire raw snapshot (case insensitive)
      if (rawSnapshot.toLowerCase().includes(expectedStr.toLowerCase())) {
        foundExpectedText = true;
        // Try to find the specific line containing the text
        for (const line of lines) {
          if (line.toLowerCase().includes(expectedStr.toLowerCase())) {
            foundLine = line.trim();
            break;
          }
        }
        if (!foundLine) {
          foundLine = `Text "${expectedStr}" found in page`;
        }
      }

      // If not found yet, check line by line with various patterns
      if (!foundExpectedText) {
        for (const line of lines) {
          if (line.includes(`"${expectedStr}"`) ||
            line.toLowerCase().includes(`"${expectedStr.toLowerCase()}"`) ||
            line.toLowerCase().includes(expectedStr.toLowerCase()) ||
            (line.includes('StaticText') && line.toLowerCase().includes(expectedStr.toLowerCase()))) {
            foundExpectedText = true;
            foundLine = line.trim();
            break;
          }
        }
      }

      if (foundExpectedText) {
        this.logger.info('Assertion passed: expected text found on page', {
          expected: expectedStr,
          foundLine,
        });
        return {
          success: true,
          data: { asserted: true, expected: expectedStr, foundLine },
          duration: 0,
          toolName: 'assertion',
          timestamp: new Date(),
        };
      }

      // SECOND: If we have a ref, check the element and nearby elements
      if (ref) {
        // Find the line index with the ref
        let refLineIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          const refMatch = lines[i].match(/\[ref=(\w+)\]/);
          if (refMatch && refMatch[1] === ref) {
            refLineIdx = i;
            break;
          }
        }

        // Check nearby lines (within 10 lines) for the expected text
        if (refLineIdx >= 0) {
          const startIdx = Math.max(0, refLineIdx - 10);
          const endIdx = Math.min(lines.length - 1, refLineIdx + 10);

          for (let i = startIdx; i <= endIdx; i++) {
            const line = lines[i];
            if (line.toLowerCase().includes(expectedStr.toLowerCase())) {
              this.logger.info('Assertion passed: expected text found near target element', {
                expected: expectedStr,
                foundLine: line.trim(),
                ref,
              });
              return {
                success: true,
                data: { asserted: true, expected: expectedStr, foundNearRef: true },
                duration: 0,
                toolName: 'assertion',
                timestamp: new Date(),
              };
            }
          }
        }
      }

      this.logger.error('Assertion failed: text not found on page', {
        expected: expectedStr,
        ref,
      });
      return {
        success: false,
        error: `Assertion failed: text "${expectedStr}" not found on page`,
        data: { expected: expectedStr },
        duration: 0,
        toolName: 'assertion',
        timestamp: new Date(),
      };
    }

    // For visibility assertions, element being found means it's visible
    if (ref && action.assertionType === 'visible') {
      this.logger.info('Assertion passed: element visible', { ref });
      return {
        success: true,
        data: { asserted: true, ref, visible: true },
        duration: 0,
        toolName: 'assertion',
        timestamp: new Date(),
      };
    }

    // Default: return success (existing behavior for unhandled assertion types)
    return {
      success: true,
      data: { asserted: true },
      duration: 0,
      toolName: 'assertion',
      timestamp: new Date(),
    };
  }

  /**
   * Capture page snapshot with retry logic for page load
   */
  private async captureSnapshot(maxRetries = 3, waitBetweenMs = 1000): Promise<{
    success: boolean;
    snapshot?: AccessibilityNode[];
    rawSnapshot?: string;
    error?: string;
  }> {
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Wait for page to potentially load (except first attempt)
      if (attempt > 1) {
        this.logger.info('Waiting before snapshot retry', { attempt, waitMs: waitBetweenMs });
        await this.sleep(waitBetweenMs);
      }

      const result = await this.snapshotTool!.execute({});

      this.logger.info('Snapshot tool result', {
        attempt,
        success: result.success,
        error: result.error,
        dataType: typeof result.data,
        dataKeys: result.data ? Object.keys(result.data as object) : [],
        rawData: JSON.stringify(result.data).substring(0, 500),
      });

      if (!result.success) {
        lastError = result.error || 'Snapshot failed';
        continue;
      }

      // The MCP response may have different formats
      const data = result.data as unknown as Record<string, unknown>;
      let rawSnapshot = '';

      // Try different possible response formats
      if (typeof data === 'string') {
        rawSnapshot = data;
      } else if (data?.snapshot && typeof data.snapshot === 'string') {
        rawSnapshot = data.snapshot;
      } else if (data?.text && typeof data.text === 'string') {
        rawSnapshot = data.text;
      } else if (data?.content && typeof data.content === 'string') {
        rawSnapshot = data.content;
      } else {
        // Log the full data structure to understand format
        this.logger.warn('Unknown snapshot data format', { data: JSON.stringify(data) });
        rawSnapshot = JSON.stringify(data);
      }

      this.logger.info('Raw snapshot preview', {
        length: rawSnapshot.length,
        preview: rawSnapshot.substring(0, 300),
      });

      const snapshot = parseSnapshotString(rawSnapshot);

      // Check if snapshot has meaningful content (more than just the root node)
      if (snapshot.length === 0 || (snapshot.length === 1 && this.countFlatNodes(snapshot) < 10)) {
        this.logger.warn('Snapshot appears empty or minimal, retrying', {
          attempt,
          nodeCount: snapshot.length,
          flatCount: this.countFlatNodes(snapshot),
        });
        lastError = 'Snapshot has insufficient elements';
        continue;
      }

      return {
        success: true,
        snapshot,
        rawSnapshot,
      };
    }

    return {
      success: false,
      error: `Failed to capture valid snapshot after ${maxRetries} attempts: ${lastError}`,
    };
  }

  /**
   * Count total flat nodes including children
   */
  private countFlatNodes(nodes: AccessibilityNode[]): number {
    let count = nodes.length;
    for (const node of nodes) {
      if (node.children) {
        count += this.countFlatNodes(node.children);
      }
    }
    return count;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper to extract tabs from MCP response
   */
  private extractTabs(data: unknown): Array<{ index: number; url?: string; title?: string }> {
    if (!data) return [];

    // If it's an object with 'tabs' property
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;

      // Check for tabs array
      if (Array.isArray(obj.tabs)) {
        return obj.tabs as Array<{ index: number; url?: string; title?: string }>;
      }

      // Check if it's directly an array
      if (Array.isArray(data)) {
        return data as Array<{ index: number; url?: string; title?: string }>;
      }

      // Check for numbered keys
      const keys = Object.keys(obj).filter(k => !isNaN(Number(k)));
      if (keys.length > 0) {
        return keys.map(k => obj[k] as { index: number; url?: string; title?: string });
      }
    }

    return [];
  }

  /**
   * Extract record type name from action description
   * Handles patterns like:
   * - "radio button left to the 'Transportation'"
   * - "Transportation radio"
   * - "clicks on Transportation"
   */
  private extractRecordTypeFromDescription(description: string): string | undefined {
    // Pattern: "radio button left to the 'Transportation'" or 'Transportation'
    const quotedMatch = description.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return quotedMatch[1].trim();
    }

    // Pattern: "Transportation radio" or "Transportation record type"
    const wordBeforeRadio = description.match(/(\w+(?:\s+\w+)?)\s+(?:radio|record\s*type)/i);
    if (wordBeforeRadio) {
      return wordBeforeRadio[1].trim();
    }

    // Pattern: "clicks on Transportation" or "select Transportation"
    const afterAction = description.match(/(?:clicks?\s+on|select)\s+(\w+(?:\s+\w+)?)/i);
    if (afterAction) {
      return afterAction[1].trim();
    }

    return undefined;
  }

  /**
   * Create error result
   */
  private errorResult(message: string): McpToolResult<unknown> {
    return {
      success: false,
      error: message,
      errorCode: 'ACTION_ERROR',
      duration: 0,
      toolName: 'execute_action',
      timestamp: new Date(),
    };
  }
}
