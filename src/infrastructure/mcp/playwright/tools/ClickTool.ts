/**
 * Click Tool
 * Clicks on an element with optional new tab/popup detection
 */

import { McpToolResult } from '../../common/McpClient.interface';
import { IMcpClient } from '../../common/McpClient.interface';
import { BaseTool, BaseToolOptions } from './BaseTool';

/**
 * Click tool parameters
 */
export interface ClickParams extends BaseToolOptions {
  /** Human-readable element description */
  element: string;
  /** Element reference from page snapshot */
  ref: string;
  /** Mouse button to use */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks */
  clickCount?: number;
  /** Modifier keys */
  modifiers?: ('Alt' | 'Control' | 'Meta' | 'Shift')[];
  /** Whether to expect and wait for a new tab/popup after click */
  expectNewTab?: boolean;
  /** Automatically switch to the new tab/popup if one opens */
  autoSwitchToNewTab?: boolean;
  /** Timeout in ms to wait for new tab (default: 5000) */
  newTabTimeout?: number;
}

/**
 * New tab info structure
 */
export interface NewTabInfo {
  /** Tab index */
  index: number;
  /** Tab URL */
  url: string;
  /** Tab title */
  title: string;
}

/**
 * Click tool result
 */
export interface ClickResult {
  /** Whether click was successful */
  clicked: boolean;
  /** New tab info if one was opened (when expectNewTab is true) */
  newTab?: NewTabInfo;
  /** Whether we automatically switched to the new tab */
  switchedToNewTab?: boolean;
  /** Debug info for troubleshooting */
  debug?: {
    initialTabCount: number;
    finalTabCount: number;
    tabsData: unknown;
  };
}

/**
 * Tab data structure from MCP response
 */
interface TabData {
  index?: number;
  url?: string;
  title?: string;
  active?: boolean;
}

/**
 * Helper to extract tabs from MCP response
 * The response can be: { tabs: [...] } or just an array [...] or a string
 */
function extractTabs(data: unknown): TabData[] {
  if (!data) return [];

  // If it's an object with 'tabs' property
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check for tabs array
    if (Array.isArray(obj.tabs)) {
      return obj.tabs as TabData[];
    }

    // Check if it's directly an array
    if (Array.isArray(data)) {
      return data as TabData[];
    }

    // Check for numbered keys (like { "0": {...}, "1": {...} })
    const keys = Object.keys(obj).filter(k => !isNaN(Number(k)));
    if (keys.length > 0) {
      return keys.map(k => obj[k] as TabData);
    }
  }

  return [];
}

/**
 * Click Tool
 * Wraps the browser_click MCP tool with optional new tab detection
 */
export class ClickTool extends BaseTool<ClickParams, ClickResult> {
  protected toolName = 'browser_click';

  constructor(client: IMcpClient) {
    super(client);
  }

  async execute(params: ClickParams): Promise<McpToolResult<ClickResult>> {
    this.validateConnection();

    const expectNewTab = params.expectNewTab ?? false;
    const autoSwitch = params.autoSwitchToNewTab ?? true;
    const newTabTimeout = params.newTabTimeout ?? 5000;

    // Get initial tab count if expecting new tab
    let initialTabs: TabData[] = [];
    if (expectNewTab) {
      try {
        const tabsResult = await this.client.executeTool<unknown>(
          'browser_tabs',
          { action: 'list' }
        );
        if (tabsResult.success && tabsResult.data) {
          initialTabs = extractTabs(tabsResult.data);
        }
      } catch {
        // Continue with click even if we can't get initial count
      }
    }

    // Perform the click
    const clickResult = await this.client.executeTool<{ clicked?: boolean }>(this.toolName, {
      element: params.element,
      ref: params.ref,
      button: params.button,
      clickCount: params.clickCount,
      modifiers: params.modifiers,
    });

    if (!clickResult.success) {
      return clickResult as McpToolResult<ClickResult>;
    }

    const result: ClickResult = {
      clicked: true,
    };

    // Wait for and detect new tab if expected
    if (expectNewTab) {
      // Give the browser time to open the new tab
      await this.delay(1000);

      try {
        // Use browser_evaluate to detect and switch to new page
        const newTabResult = await this.client.executeTool<any>('browser_evaluate', {
          script: `
            const context = page.context();
            const initialPages = context.pages();
            const initialCount = initialPages.length;
            
            // Wait for new page to open (up to ${newTabTimeout}ms)
            let newPage = null;
            const startTime = Date.now();
            
            while (Date.now() - startTime < ${newTabTimeout}) {
              const currentPages = context.pages();
              if (currentPages.length > initialCount) {
                // New page detected - get the last one
                newPage = currentPages[currentPages.length - 1];
                break;
              }
              await new Promise(r => setTimeout(r, 100));
            }
            
            if (newPage) {
              // Switch to the new page
              await newPage.bringToFront();
              await newPage.waitForLoadState('load', { timeout: 5000 });
              
              return {
                detected: true,
                switched: true,
                url: newPage.url(),
                title: await newPage.title(),
                pageCount: context.pages().length
              };
            }
            
            return {
              detected: false,
              switched: false,
              pageCount: initialCount
            };
          `,
        });

        if (newTabResult.success && newTabResult.data) {
          const data = newTabResult.data;
          if (data.detected) {
            result.newTab = {
              index: data.pageCount - 1,
              url: data.url || '',
              title: data.title || '',
            };
            result.switchedToNewTab = data.switched || false;
          }

          result.debug = {
            initialTabCount: 0,
            finalTabCount: data.pageCount || 0,
            tabsData: data,
          };
        }
      } catch (err) {
        // Failed to detect/switch, but click still succeeded
        result.debug = {
          initialTabCount: 0,
          finalTabCount: 0,
          tabsData: { error: err instanceof Error ? err.message : String(err) },
        };
      }
    }

    return {
      success: true,
      data: result,
      duration: clickResult.duration,
      toolName: this.toolName,
      timestamp: new Date(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
