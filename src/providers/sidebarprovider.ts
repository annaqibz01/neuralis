// src/providers/sidebarProvider.ts

/**
 * @fileoverview
 * Neuralis - Sidebar Provider Controller
 * 
 * This module implements the VS Code WebviewViewProvider interface for the
 * Neuralis extension sidebar. It handles the complete lifecycle of the webview,
 * including HTML generation, resource management, and message delegation to
 * the centralized MessageRouter.
 * 
 * Features:
 * - Clean dependency injection for all backend services
 * - Delegation of all IPC messages to MessageRouter
 * - Secure Content Security Policy configuration
 * - Proper resource loading from compiled frontend build
 * - Environment-aware asset path resolution
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MessageRouter } from '../utils/messageRouter';
import { SessionManager } from '../services/sessionManager';
import { ConfigManager } from '../services/configManager';
import { DeepseekClient } from '../services/deepseekClient';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Extension identifier for URI schemes */
const EXTENSION_ID = 'neuralis';

/** Webview view type identifier */
const VIEW_TYPE = 'neuralis.sidebar';

/** Content Security Policy source directives */
const CSP_SOURCES = {
  scripts: [
    "'unsafe-inline'", // Hilangkan "'unsafe-eval'" dari array ini
    'https://*.vscode-cdn.net',
    'https://*.vscode-resource.vscode-cdn.net',
  ],
  styles: [
    "'unsafe-inline'",
    'https://*.vscode-cdn.net',
    'https://*.vscode-resource.vscode-cdn.net',
  ],
  images: [
    'https:',
    'data:',
    'vscode-resource:',
    'https://*.vscode-resource.vscode-cdn.net',
  ],
};

// ============================================================================
// SIDEBAR PROVIDER
// ============================================================================

/**
 * VS Code WebviewViewProvider implementation for the Neuralis sidebar.
 * Acts as the pure controller layer, delegating all business logic to
 * the MessageRouter and its dependent services.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _messageRouter!: MessageRouter;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Creates a new SidebarProvider instance.
   * Initializes the service layer with dependency injection.
   * 
   * @param context - The VS Code ExtensionContext for accessing storage and resources
   */
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.initializeServices();
  }

  /**
   * Initializes backend services with proper dependency injection.
   * Creates the service chain: ConfigManager -> DeepseekClient -> SessionManager -> MessageRouter
   */
  private initializeServices(): void {
    try {
      // Initialize services in dependency order
      const configManager = new ConfigManager(this._context);
      const sessionManager = new SessionManager(this._context);
      const deepseekClient = new DeepseekClient(configManager);
      
      // Create the message router with all dependencies
      this._messageRouter = new MessageRouter(
        sessionManager,
        configManager,
        deepseekClient
      );

      console.log('[SidebarProvider] Services initialized successfully');
    } catch (error) {
      console.error('[SidebarProvider] Failed to initialize services:', error);
      throw new Error('Failed to initialize Neuralis extension services');
    }
  }

  /**
   * Called by VS Code when the webview is first created or revealed.
   * Sets up the webview options, HTML content, and message listener.
   * 
   * @param webviewView - The webview view instance
   * @param context - The webview view resolution context
   * @param token - Cancellation token
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    // Store reference to the view
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = this.getWebviewOptions();

    // Set the HTML content
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Set up message listener delegating to the router
    this.setupMessageListener(webviewView);

    // Handle view disposal
    this.setupDisposalHandlers(webviewView);

    console.log('[SidebarProvider] Webview resolved successfully');
  }

  /**
   * Configures the webview options including script execution and local resource access.
   * 
   * @returns WebviewOptions configuration object
   */
  private getWebviewOptions(): vscode.WebviewOptions {
    return {
      // Enable JavaScript in the webview
      enableScripts: true,

      // Restrict the webview to only load resources from the extension's directories
      localResourceRoots: this.getLocalResourceRoots(),
    };
  }

  /**
   * Determines the allowed local resource roots based on the build environment.
   * Supports both development and production build structures.
   * 
   * @returns Array of URIs for allowed resource directories
   */
  private getLocalResourceRoots(): vscode.Uri[] {
    const resourceRoots: vscode.Uri[] = [];

    // Add the extension root directory
    resourceRoots.push(this._context.extensionUri);

    // Add the webview UI build directory if it exists
    const webviewBuildPath = vscode.Uri.joinPath(
      this._context.extensionUri,
      'webview-ui',
      'dist'
    );
    
    // Check if the directory exists before adding it
    try {
      const fsPath = webviewBuildPath.fsPath;
      if (fs.existsSync(fsPath)) {
        resourceRoots.push(webviewBuildPath);
      }
    } catch {
      // Directory doesn't exist, skip adding
    }

    // Add the compiled output directory
    const outPath = vscode.Uri.joinPath(this._context.extensionUri, 'out');
    resourceRoots.push(outPath);

    return resourceRoots;
  }

  /**
   * Sets up the message event listener that delegates all incoming
   * IPC messages to the MessageRouter for processing.
   * 
   * @param webviewView - The webview view instance
   */
  private setupMessageListener(webviewView: vscode.WebviewView): void {
    const messageDisposable = webviewView.webview.onDidReceiveMessage(
      async (message: any) => {
        try {
          console.log('[SidebarProvider] Received message from webview:', message?.command);
          
          // Delegate all messages to the router
          await this._messageRouter.handleMessage(message, webviewView.webview);
        } catch (error) {
          console.error('[SidebarProvider] Error handling message:', error);
          
          // Attempt to send error back to webview
          try {
            const { createExtensionEnvelope, ExtensionCommand } = await import('../contracts/message.contracts');
            webviewView.webview.postMessage(
              createExtensionEnvelope(ExtensionCommand.SHOW_ERROR, {
                message: `⚠️ Internal error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                code: 'ROUTER_ERROR',
              })
            );
          } catch {
            // Failed to send error, log it
            console.error('[SidebarProvider] Failed to send error to webview');
          }
        }
      }
    );

    // Track disposable for cleanup
    this._disposables.push(messageDisposable);
  }

  /**
   * Sets up handlers for webview disposal and cleanup.
   * 
   * @param webviewView - The webview view instance
   */
  private setupDisposalHandlers(webviewView: vscode.WebviewView): void {
    // Clean up when the webview is disposed
    webviewView.onDidDispose(() => {
      this.cleanup();
    });

    // Track visibility changes for analytics or reconnection
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log('[SidebarProvider] Webview became visible');
      } else {
        console.log('[SidebarProvider] Webview became hidden');
      }
    });
  }

  /**
   * Cleans up resources when the webview is disposed.
   */
  private cleanup(): void {
    console.log('[SidebarProvider] Cleaning up webview resources');
    
    // Dispose all tracked disposables
    this._disposables.forEach(disposable => {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('[SidebarProvider] Error disposing resource:', error);
      }
    });
    
    this._disposables = [];
    this._view = undefined;
  }

  /**
   * Generates the HTML content for the webview.
   * Injects the compiled React application with proper script and style references.
   * 
   * @param webview - The webview instance for resolving URIs
   * @returns Complete HTML string for the webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Determine the base path for the webview UI build
    const webviewBuildPath = this.getWebviewBuildPath();
    
    const webviewBuildUri = webview.asWebviewUri(webviewBuildPath);
    const logoPath = vscode.Uri.joinPath(this._context.extensionUri, "icon.svg");
    const logoUri = webview.asWebviewUri(logoPath).toString();
    
    // Get URIs for the required assets
    const scriptUri = this.getAssetUri(webview, webviewBuildPath, 'assets', 'index.js');
    const styleUri = this.getAssetUri(webview, webviewBuildPath, 'assets', 'index.css');
    const faviconUri = this.getAssetUri(webview, webviewBuildPath, '', 'favicon.ico');
    // Build the Content Security Policy
    const csp = this.buildContentSecurityPolicy(webview, webviewBuildPath);

    // Generate the HTML template
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Content Security Policy -->
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  
  <!-- Favicon -->
  <link rel="icon" href="${faviconUri}">
  
  <!-- Styles -->
  <link rel="stylesheet" href="${styleUri}">
  
  <title>Neuralis AI</title>
  
  <!-- Preload critical assets -->
  <link rel="preload" href="${scriptUri}" as="script">
  <link rel="preload" href="${styleUri}" as="style">
  
  <style>
    /* Prevent flash of unstyled content */
    body {
      margin: 0;
      padding: 0;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    
    #root {
      min-height: 100vh;
    }
    
    /* Loading indicator */
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <!-- React mount point -->
  <div id="root">
    <div class="loading">Loading Neuralis AI...</div>
  </div>
  
  <!-- Application script -->
  <script src="${scriptUri}"></script>
  
  <!-- Initialization script -->
  <script>
    (function() {
      // Notify the extension that the webview is ready
      const vscode = acquireVsCodeApi();
      
      // Store vscode API reference for the React app
      window.__VSCODE_API__ = vscode;

      window.__NEURALIS_LOGO__ = "${logoUri}";
      
      // Handle any initialization errors
      window.addEventListener('error', function(event) {
        vscode.postMessage({
          command: 'SHOW_ERROR',
          payload: {
            message: '⚠️ An error occurred in the webview: ' + event.message,
            code: 'WEBVIEW_ERROR'
          }
        });
      });
      
      console.log('[Neuralis] Webview initialized');
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Determines the webview build path, checking multiple possible locations.
   * Supports both development and production builds.
   * 
   * @returns URI of the webview build directory
   */
  private getWebviewBuildPath(): vscode.Uri {
    
    return vscode.Uri.joinPath(this._context.extensionUri, 'out', 'webview-ui');
  }

  /**
   * Determines the allowed local resource roots based on the build environment.
   */
  
  /**
   * Resolves the URI for a webview asset file.
   * Handles both existing files and fallbacks gracefully.
   * 
   * @param webview - The webview instance
   * @param basePath - The base directory URI
   * @param subdir - The subdirectory within the base path
   * @param filename - The asset filename
   * @returns Webview-compatible URI for the asset
   */
  private getAssetUri(
    webview: vscode.Webview,
    basePath: vscode.Uri,
    subdir: string,
    filename: string
  ): string {
    const assetPath = vscode.Uri.joinPath(basePath, subdir, filename);
    
    // Check if the file exists, return a data URI fallback if not
    try {
      if (fs.existsSync(assetPath.fsPath)) {
        return webview.asWebviewUri(assetPath).toString();
      }
    } catch {
      // File doesn't exist, return a fallback
    }

    // Return empty string as fallback (the app will handle missing assets)
    return '';
  }

  /**
   * Builds a secure Content Security Policy string for the webview.
   * Ensures only trusted sources can execute scripts and load resources.
   * 
   * @param webview - The webview instance for resolving URIs
   * @param webviewBuildPath - The build directory URI
   * @returns CSP string
   */
  private buildContentSecurityPolicy(
    webview: vscode.Webview,
    webviewBuildPath: vscode.Uri
  ): string {
    const webviewUri = webview.asWebviewUri(webviewBuildPath).toString();
    const extensionAuthUri = webview.asWebviewUri(this._context.extensionUri).toString();
    
    // Build CSP directives
    const directives = [
      "default-src 'none'",
      `script-src ${webviewUri} ${CSP_SOURCES.scripts.join(' ')}`,
      `style-src ${webviewUri} ${CSP_SOURCES.styles.join(' ')}`,
      `img-src ${webviewUri} ${extensionAuthUri} ${CSP_SOURCES.images.join(' ')}`,
      `font-src ${webviewUri} data:`,
      `connect-src ${webviewUri} https:`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ];
    return directives.join('; ');
  }

  /**
   * Posts a message to the webview if it's available.
   * Provides a safe way to send data from the extension to the frontend.
   * 
   * @param message - The message to send
   * @returns True if the message was sent successfully
   */
  public postMessageToWebview(message: any): boolean {
    if (this._view && this._view.webview) {
      try {
        this._view.webview.postMessage(message);
        return true;
      } catch (error) {
        console.error('[SidebarProvider] Failed to post message to webview:', error);
        return false;
      }
    }
    
    console.warn('[SidebarProvider] Cannot post message: webview not available');
    return false;
  }

  /**
   * Reveals the sidebar view in the VS Code UI.
   * Can optionally preserve the current focus state.
   * 
   * @param preserveFocus - Whether to preserve the current focus
   */
  public async reveal(preserveFocus: boolean = false): Promise<void> {
    try {
      await vscode.commands.executeCommand(`${VIEW_TYPE}.focus`);
      
      if (!preserveFocus && this._view) {
        this._view.show?.(true);
      }
    } catch (error) {
      console.error('[SidebarProvider] Failed to reveal view:', error);
    }
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default SidebarProvider;