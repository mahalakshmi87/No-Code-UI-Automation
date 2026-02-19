/**
 * Window Management Tools
 * Handles popup windows and multiple browser windows/contexts
 */

import { McpToolResult } from '../../common/McpClient.interface';
import { IMcpClient } from '../../common/McpClient.interface';
import { BaseTool, BaseToolOptions } from './BaseTool';

/**
 * Window info structure
 */
export interface WindowInfo {
    /** Window index */
    index: number;
    /** Window URL */
    url: string;
    /** Window title */
    title: string;
    /** Whether window is active/focused */
    isActive: boolean;
}

// ============================================================================
// Wait For Popup Tool
// ============================================================================

/**
 * Wait for popup parameters
 */
export interface WaitForPopupParams extends BaseToolOptions {
    /** Timeout in milliseconds to wait for popup */
    timeout?: number;
    /** Automatically switch to the popup when it opens */
    autoSwitch?: boolean;
}

/**
 * Wait for popup result
 */
export interface WaitForPopupResult {
    /** Whether a popup was detected */
    popupDetected: boolean;
    /** Popup URL */
    url?: string;
    /** Popup title */
    title?: string;
    /** Index of the new popup window/tab */
    windowIndex?: number;
    /** Whether we automatically switched to the popup */
    autoSwitched?: boolean;
}

/**
 * Wait For Popup Tool
 * Waits for a popup window to appear after an action
 * Uses browser_tabs with special handling for new windows
 */
export class WaitForPopupTool extends BaseTool<WaitForPopupParams, WaitForPopupResult> {
    protected toolName = 'browser_tabs';

    constructor(client: IMcpClient) {
        super(client);
    }

    async execute(params: WaitForPopupParams = {}): Promise<McpToolResult<WaitForPopupResult>> {
        this.validateConnection();

        const timeout = params.timeout || 5000;
        const autoSwitch = params.autoSwitch ?? true;
        const startTime = Date.now();

        try {
            // Get initial tab count
            const initialResult = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                this.toolName,
                { action: 'list' }
            );

            if (!initialResult.success || !initialResult.data?.tabs) {
                return {
                    success: false,
                    error: 'Failed to get initial tab list',
                    errorCode: 'INITIAL_LIST_FAILED',
                    duration: Date.now() - startTime,
                    toolName: this.toolName,
                    timestamp: new Date(),
                };
            }

            const initialCount = initialResult.data.tabs.length;

            // Poll for new popup/tab
            while (Date.now() - startTime < timeout) {
                await this.delay(250); // Check every 250ms

                const currentResult = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                    this.toolName,
                    { action: 'list' }
                );

                if (currentResult.success && currentResult.data?.tabs) {
                    const currentCount = currentResult.data.tabs.length;

                    if (currentCount > initialCount) {
                        // New window/tab detected
                        const newTab = currentResult.data.tabs[currentCount - 1];

                        // Auto-switch if requested
                        if (autoSwitch) {
                            await this.client.executeTool(this.toolName, {
                                action: 'select',
                                index: newTab.index,
                            });
                        }

                        return {
                            success: true,
                            data: {
                                popupDetected: true,
                                url: newTab.url,
                                title: newTab.title,
                                windowIndex: newTab.index,
                                autoSwitched: autoSwitch,
                            },
                            duration: Date.now() - startTime,
                            toolName: this.toolName,
                            timestamp: new Date(),
                        };
                    }
                }
            }

            // Timeout - no popup detected
            return {
                success: true,
                data: {
                    popupDetected: false,
                },
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: 'POPUP_WAIT_ERROR',
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// List Windows Tool
// ============================================================================

/**
 * List windows parameters
 */
export interface ListWindowsParams extends BaseToolOptions { }

/**
 * List windows result
 */
export interface ListWindowsResult {
    /** All open windows/tabs */
    windows: WindowInfo[];
    /** Index of the active window */
    activeIndex: number;
    /** Total count of windows */
    count: number;
}

/**
 * List Windows Tool
 * Lists all open browser windows/tabs
 */
export class ListWindowsTool extends BaseTool<ListWindowsParams, ListWindowsResult> {
    protected toolName = 'browser_tabs';

    constructor(client: IMcpClient) {
        super(client);
    }

    async execute(_params: ListWindowsParams = {}): Promise<McpToolResult<ListWindowsResult>> {
        this.validateConnection();

        const startTime = Date.now();

        try {
            const result = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                this.toolName,
                { action: 'list' }
            );

            if (!result.success || !result.data?.tabs) {
                return {
                    success: false,
                    error: result.error || 'Failed to list windows',
                    errorCode: 'LIST_FAILED',
                    duration: Date.now() - startTime,
                    toolName: this.toolName,
                    timestamp: new Date(),
                };
            }

            const windows: WindowInfo[] = result.data.tabs.map(tab => ({
                index: tab.index,
                url: tab.url,
                title: tab.title,
                isActive: tab.active,
            }));

            const activeWindow = windows.find(w => w.isActive);

            return {
                success: true,
                data: {
                    windows,
                    activeIndex: activeWindow?.index ?? 0,
                    count: windows.length,
                },
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: 'LIST_WINDOWS_ERROR',
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        }
    }
}

// ============================================================================
// Switch Window Tool
// ============================================================================

/**
 * Switch window parameters  
 */
export interface SwitchWindowParams extends BaseToolOptions {
    /** Window index to switch to */
    index?: number;
    /** Window title to switch to (partial match) */
    title?: string;
    /** Window URL to switch to (partial match) */
    url?: string;
}

/**
 * Switch window result
 */
export interface SwitchWindowResult {
    /** Whether switch was successful */
    switched: boolean;
    /** The window we switched to */
    window?: WindowInfo;
}

/**
 * Switch Window Tool
 * Switches focus to a specific window by index, title, or URL
 */
export class SwitchWindowTool extends BaseTool<SwitchWindowParams, SwitchWindowResult> {
    protected toolName = 'browser_tabs';

    constructor(client: IMcpClient) {
        super(client);
    }

    async execute(params: SwitchWindowParams): Promise<McpToolResult<SwitchWindowResult>> {
        this.validateConnection();

        const startTime = Date.now();

        try {
            let targetIndex: number | undefined = params.index;

            // If title or url provided, find the matching window
            if ((params.title || params.url) && targetIndex === undefined) {
                const listResult = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                    this.toolName,
                    { action: 'list' }
                );

                if (!listResult.success || !listResult.data?.tabs) {
                    return {
                        success: false,
                        error: 'Failed to list windows for matching',
                        errorCode: 'LIST_FAILED',
                        duration: Date.now() - startTime,
                        toolName: this.toolName,
                        timestamp: new Date(),
                    };
                }

                const matchedTab = listResult.data.tabs.find(tab => {
                    if (params.title && tab.title.toLowerCase().includes(params.title.toLowerCase())) {
                        return true;
                    }
                    if (params.url && tab.url.toLowerCase().includes(params.url.toLowerCase())) {
                        return true;
                    }
                    return false;
                });

                if (!matchedTab) {
                    return {
                        success: false,
                        error: `No window found matching title: "${params.title}" or url: "${params.url}"`,
                        errorCode: 'WINDOW_NOT_FOUND',
                        duration: Date.now() - startTime,
                        toolName: this.toolName,
                        timestamp: new Date(),
                    };
                }

                targetIndex = matchedTab.index;
            }

            if (targetIndex === undefined) {
                return {
                    success: false,
                    error: 'Must provide either index, title, or url to switch window',
                    errorCode: 'MISSING_PARAMS',
                    duration: Date.now() - startTime,
                    toolName: this.toolName,
                    timestamp: new Date(),
                };
            }

            // Switch to the target window
            const switchResult = await this.client.executeTool(this.toolName, {
                action: 'select',
                index: targetIndex,
            });

            if (!switchResult.success) {
                return {
                    success: false,
                    error: switchResult.error || 'Failed to switch window',
                    errorCode: 'SWITCH_FAILED',
                    duration: Date.now() - startTime,
                    toolName: this.toolName,
                    timestamp: new Date(),
                };
            }

            // Get current window info
            const verifyResult = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                this.toolName,
                { action: 'list' }
            );

            const activeTab = verifyResult.data?.tabs.find(t => t.active);

            return {
                success: true,
                data: {
                    switched: true,
                    window: activeTab ? {
                        index: activeTab.index,
                        url: activeTab.url,
                        title: activeTab.title,
                        isActive: true,
                    } : undefined,
                },
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: 'SWITCH_WINDOW_ERROR',
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        }
    }
}

// ============================================================================
// Close Window Tool
// ============================================================================

/**
 * Close window parameters
 */
export interface CloseWindowParams extends BaseToolOptions {
    /** Window index to close (closes active window if omitted) */
    index?: number;
    /** Close all windows except the active one */
    closeOthers?: boolean;
}

/**
 * Close window result
 */
export interface CloseWindowResult {
    /** Whether close was successful */
    closed: boolean;
    /** Number of windows closed */
    closedCount: number;
    /** Remaining window count */
    remainingCount: number;
}

/**
 * Close Window Tool  
 * Closes a specific window or all other windows
 */
export class CloseWindowTool extends BaseTool<CloseWindowParams, CloseWindowResult> {
    protected toolName = 'browser_tabs';

    constructor(client: IMcpClient) {
        super(client);
    }

    async execute(params: CloseWindowParams = {}): Promise<McpToolResult<CloseWindowResult>> {
        this.validateConnection();

        const startTime = Date.now();

        try {
            if (params.closeOthers) {
                // Close all except active window
                const listResult = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                    this.toolName,
                    { action: 'list' }
                );

                if (!listResult.success || !listResult.data?.tabs) {
                    return {
                        success: false,
                        error: 'Failed to list windows',
                        errorCode: 'LIST_FAILED',
                        duration: Date.now() - startTime,
                        toolName: this.toolName,
                        timestamp: new Date(),
                    };
                }

                const activeIndex = listResult.data.tabs.find(t => t.active)?.index ?? 0;
                const othersToClose = listResult.data.tabs.filter(t => t.index !== activeIndex);

                // Close from highest index to lowest to avoid index shifting issues
                const sortedIndices = othersToClose.map(t => t.index).sort((a, b) => b - a);

                for (const idx of sortedIndices) {
                    await this.client.executeTool(this.toolName, {
                        action: 'close',
                        index: idx,
                    });
                }

                return {
                    success: true,
                    data: {
                        closed: true,
                        closedCount: sortedIndices.length,
                        remainingCount: 1,
                    },
                    duration: Date.now() - startTime,
                    toolName: this.toolName,
                    timestamp: new Date(),
                };
            } else {
                // Close specific window or active window
                const closeResult = await this.client.executeTool(this.toolName, {
                    action: 'close',
                    index: params.index,
                });

                if (!closeResult.success) {
                    return {
                        success: false,
                        error: closeResult.error || 'Failed to close window',
                        errorCode: 'CLOSE_FAILED',
                        duration: Date.now() - startTime,
                        toolName: this.toolName,
                        timestamp: new Date(),
                    };
                }

                // Get remaining count
                const listResult = await this.client.executeTool<{ tabs: { index: number; url: string; title: string; active: boolean }[] }>(
                    this.toolName,
                    { action: 'list' }
                );

                return {
                    success: true,
                    data: {
                        closed: true,
                        closedCount: 1,
                        remainingCount: listResult.data?.tabs.length ?? 0,
                    },
                    duration: Date.now() - startTime,
                    toolName: this.toolName,
                    timestamp: new Date(),
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: 'CLOSE_WINDOW_ERROR',
                duration: Date.now() - startTime,
                toolName: this.toolName,
                timestamp: new Date(),
            };
        }
    }
}
