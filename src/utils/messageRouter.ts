// src/utils/messageRouter.ts

/**
 * @fileoverview
 * Neuralis - Centralized Message Router for Extension Host
 * 
 * This module implements the core command dispatcher that processes all incoming
 * IPC messages from the Webview UI. It acts as the bridge between the frontend
 * and backend services, ensuring type-safe message routing with comprehensive
 * error handling and logging.
 */

import * as vscode from 'vscode';
import {
  WebviewCommand,
  WebviewIpcEnvelope,
  WebviewCommandPayloadMap,
  isWebviewCommand,
  ExtensionCommand,
  createExtensionEnvelope,
  ContextFile,
  AiSettings,
  SessionMetadata,
  SessionDetail,
  Message,
} from '../contracts/message.contracts';

// ============================================================================
// SERVICE STUBS / INTERFACES
// ============================================================================

/**
 * Interface for session management operations.
 * Defines the contract for creating, reading, updating, and deleting sessions.
 */
interface ISessionManager {
  /** Lists all saved session metadata */
  listSessions(): Promise<SessionMetadata[]>;
  /** Loads a complete session by ID */
  loadSession(sessionId: string): Promise<SessionDetail | null>;
  /** Creates a new session with optional initial title */
  createNewSession(initialTitle?: string): Promise<SessionDetail>;
  /** Deletes a session by ID */
  deleteSession(sessionId: string): Promise<void>;
  /** Saves a session to persistent storage */
  saveSession(session: SessionDetail): Promise<void>;
}

/**
 * Interface for configuration management operations.
 * Handles reading and writing VS Code workspace configurations.
 */
interface IConfigManager {
  /** Loads the current AI settings from workspace configuration */
  load(): Promise<AiSettings>;
  /** Saves partial AI settings to workspace configuration */
  save(settings: Partial<AiSettings>): Promise<void>;
  /** Checks if an API key is configured */
  hasApiKey(): Promise<boolean>;
  /** Gets the API key if configured */
  getApiKey(): Promise<string | undefined>;
}

/**
 * Interface for DeepSeek AI client operations.
 * Manages streaming communication with the DeepSeek API.
 */
interface IDeepseekClient {
  /** Starts a streaming request to the AI */
  startStreaming(
    prompt: string,
    settings: AiSettings,
    sessionId: string,
    webview: vscode.Webview,
    files?: ContextFile[]
  ): Promise<Message>;
  /** Aborts the currently active stream */
  abortActiveStream(): Promise<void>;
  /** Checks if there's an active stream */
  isStreaming(): boolean;
}

// ============================================================================
// SERVICE STUB IMPLEMENTATIONS
// ============================================================================

/**
 * Stub implementation of SessionManager for development purposes.
 * Should be replaced with the actual implementation.
 */
class SessionManagerStub implements ISessionManager {
  private sessions: Map<string, SessionDetail> = new Map();

  async listSessions(): Promise<SessionMetadata[]> {
    const metadata: SessionMetadata[] = [];
    this.sessions.forEach((session) => {
      metadata.push({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastModifiedAt: session.createdAt,
      });
    });
    return metadata;
  }

  async loadSession(sessionId: string): Promise<SessionDetail | null> {
    return this.sessions.get(sessionId) || null;
  }

  async createNewSession(initialTitle?: string): Promise<SessionDetail> {
    const now = Date.now();
    const session: SessionDetail = {
      id: `session_${now}_${Math.random().toString(36).substr(2, 9)}`,
      title: initialTitle || `New Session ${new Date(now).toLocaleString()}`,
      messages: [],
      createdAt: now,
      settings: {
        model: 'deepseek-v4-flash',
        proOption: 'fast',
        mode: 'chat',
      },
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async saveSession(session: SessionDetail): Promise<void> {
    this.sessions.set(session.id, session);
  }
}

/**
 * Stub implementation of ConfigManager for development purposes.
 * Should be replaced with the actual implementation using VS Code Configuration API.
 */
class ConfigManagerStub implements IConfigManager {
  private settings: AiSettings = {
    model: 'deepseek-v4-flash',
    proOption: 'fast',
    mode: 'chat',
  };
  private apiKeyConfigured: boolean = false;

  async load(): Promise<AiSettings> {
    // In production, this would read from vscode.workspace.getConfiguration()
    return { ...this.settings };
  }

  async save(settings: Partial<AiSettings>): Promise<void> {
    // In production, this would write to vscode.workspace.getConfiguration().update()
    Object.assign(this.settings, settings);
  }

  async hasApiKey(): Promise<boolean> {
    // In production, this would check for API key in secret storage or configuration
    return this.apiKeyConfigured;
  }

  async getApiKey(): Promise<string | undefined> {
    // In production, this would retrieve from secret storage
    return this.apiKeyConfigured ? 'stub-api-key' : undefined;
  }

  /**
   * Sets the API key configured state (for testing)
   */
  setApiKeyConfigured(configured: boolean): void {
    this.apiKeyConfigured = configured;
  }
}

/**
 * Stub implementation of DeepseekClient for development purposes.
 * Should be replaced with the actual implementation using fetch/axios.
 */
class DeepseekClientStub implements IDeepseekClient {
  private abortController: AbortController | null = null;

  async startStreaming(
    prompt: string,
    settings: AiSettings,
    sessionId: string,
    webview: vscode.Webview,
    files?: ContextFile[]
  ): Promise<Message> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Send STREAM_START
    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.STREAM_START, {
        sessionId,
        model: settings.model,
        mode: settings.mode,
      })
    );

    try {
      // Simulate streaming with chunks
      const reasoningChunks = [
        'Let me analyze this request step by step.',
        'First, I need to understand the context.',
        'The user is asking about: ' + prompt.substring(0, 50) + '...',
        'Processing the information now.',
      ];

      const responseChunks = [
        'I understand your question about ' + prompt.substring(0, 30) + '.\n\n',
        'Here is my detailed response:\n\n',
        'Based on the information provided, I can help you with this.\n\n',
        '**Key Points:**\n',
        '- This is a simulated response\n',
        '- The actual implementation will call DeepSeek API\n',
        '- Streaming support is fully integrated\n\n',
        'The answer to your query involves multiple considerations.\n\n',
        'Let me know if you need any clarification!',
      ];

      // Send reasoning chunks
      for (const chunk of reasoningChunks) {
        if (signal.aborted) {
          throw new Error('Stream cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        webview.postMessage(
          createExtensionEnvelope(ExtensionCommand.STREAM_CHUNK, {
            reasoningContent: chunk + '\n',
          })
        );
      }

      // Send response chunks
      let fullContent = '';
      for (const chunk of responseChunks) {
        if (signal.aborted) {
          throw new Error('Stream cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        fullContent += chunk;
        webview.postMessage(
          createExtensionEnvelope(ExtensionCommand.STREAM_CHUNK, {
            content: chunk,
          })
        );
      }

      // Create final message
      const finalMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: fullContent,
        thinkContent: reasoningChunks.join('\n'),
        timestamp: Date.now(),
      };

      // Send STREAM_END
      webview.postMessage(
        createExtensionEnvelope(ExtensionCommand.STREAM_END, {
          finalMessage,
        })
      );

      return finalMessage;
    } catch (error) {
      if ((error as Error).message === 'Stream cancelled') {
        console.log('[Neuralis] Stream cancelled by user');
      } else {
        throw error;
      }
      // Return a partial message if cancelled
      return {
        id: `msg_${Date.now()}_cancelled`,
        role: 'assistant',
        content: '[Stream cancelled]',
        timestamp: Date.now(),
      };
    } finally {
      this.abortController = null;
    }
  }

  async abortActiveStream(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isStreaming(): boolean {
    return this.abortController !== null;
  }
}

// ============================================================================
// WORKSPACE UTILITY
// ============================================================================

/**
 * Utility class for workspace file system operations.
 * Handles file discovery and content reading within VS Code workspace.
 */
class WorkspaceUtility {
  /**
   * Finds all files in the workspace matching a glob pattern.
   * Returns relative paths for display in the frontend.
   */
  static async findWorkspaceFiles(): Promise<string[]> {
    const files: string[] = [];
    
    if (!vscode.workspace.workspaceFolders) {
      return files;
    }

    try {
      // Search for common file types in the workspace
      const patterns = [
        '**/*.{ts,tsx,js,jsx,json,md,py,html,css,scss,less}',
        '**/*.{go,rs,java,kt,swift,c,cpp,h,hpp}',
        '**/*.{yaml,yml,toml,xml,sql,graphql}',
        '**/*.{txt,log,env,gitignore,dockerfile}',
        '**/*.{vue,svelte,astro,php,rb,pl,pm}',
      ];

      for (const pattern of patterns) {
        const uris = await vscode.workspace.findFiles(
          pattern,
          '**/node_modules/**',
          1000 // Limit to 1000 files
        );

        for (const uri of uris) {
          const relativePath = vscode.workspace.asRelativePath(uri);
          if (!files.includes(relativePath)) {
            files.push(relativePath);
          }
        }
      }
    } catch (error) {
      console.error('[Neuralis] Error finding workspace files:', error);
    }

    return files.sort();
  }

  /**
   * Reads the content of a file by its relative path.
   * Returns a ContextFile object with the content buffer.
   */
  static async readFileContent(filePath: string): Promise<ContextFile | null> {
    if (!vscode.workspace.workspaceFolders) {
      return null;
    }

    try {
      // Resolve the full URI from the relative path
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
      const fileUri = vscode.Uri.joinPath(workspaceUri, filePath);

      // Check if file exists
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        return null;
      }

      // Read file content
      const contentBuffer = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(contentBuffer).toString('utf-8');

      return {
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        content,
      };
    } catch (error) {
      console.error(`[Neuralis] Error reading file ${filePath}:`, error);
      return null;
    }
  }
}

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

/**
 * Centralized command dispatcher for processing Webview-to-Extension messages.
 * Routes each command to the appropriate service handler with comprehensive
 * error handling and logging.
 */
export class MessageRouter {
  private readonly sessionManager: ISessionManager;
  private readonly configManager: IConfigManager;
  private readonly deepseekClient: IDeepseekClient;
  private readonly workspaceUtility: typeof WorkspaceUtility;

  /**
   * Creates a new MessageRouter instance.
   * 
   * @param sessionManager - Session management service (defaults to stub)
   * @param configManager - Configuration management service (defaults to stub)
   * @param deepseekClient - DeepSeek AI client service (defaults to stub)
   */
  constructor(
    sessionManager?: ISessionManager,
    configManager?: IConfigManager,
    deepseekClient?: IDeepseekClient
  ) {
    this.sessionManager = sessionManager || new SessionManagerStub();
    this.configManager = configManager || new ConfigManagerStub();
    this.deepseekClient = deepseekClient || new DeepseekClientStub();
    this.workspaceUtility = WorkspaceUtility;
  }

  /**
   * Validates an incoming message envelope and routes it to the appropriate handler.
   * Provides comprehensive error handling to ensure the frontend never hangs.
   * 
   * @param envelope - The raw message envelope from the Webview
   * @param webview - The VS Code Webview instance for sending responses
   */
  public async handleMessage(envelope: any, webview: vscode.Webview): Promise<void> {
    // Validate the incoming envelope
    if (!envelope || typeof envelope !== 'object') {
      console.warn('[Neuralis] Received invalid message envelope:', envelope);
      return;
    }

    const { command, payload } = envelope;

    // Validate command using type guard
    if (!isWebviewCommand(command)) {
      console.warn('[Neuralis] Received unknown command:', command);
      return;
    }

    // Type-safe cast after validation
    const typedEnvelope = envelope as WebviewIpcEnvelope<typeof command>;

    console.log(`[Neuralis] Handling command: ${command}`);

    try {
      await this.dispatchCommand(command, payload, webview);
    } catch (error) {
      await this.handleError(
        error,
        `Failed to handle command: ${command}`,
        webview
      );
    }
  }

  /**
   * Dispatches a validated command to its handler.
   * Each command is processed by the appropriate service method.
   * 
   * @param command - The validated WebviewCommand
   * @param payload - The command payload (type-safe via type guard)
   * @param webview - The VS Code Webview instance
   */
  private async dispatchCommand(
    command: WebviewCommand,
    payload: any,
    webview: vscode.Webview
  ): Promise<void> {
    switch (command) {
      case WebviewCommand.READY: {
        await this.handleReady(webview);
        break;
      }

      case WebviewCommand.REQUEST_SESSION_LIST: {
        await this.handleRequestSessionList(webview);
        break;
      }

      case WebviewCommand.REQUEST_SESSION_BY_ID: {
        const { sessionId } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.REQUEST_SESSION_BY_ID];
        await this.handleRequestSessionById(sessionId, webview);
        break;
      }

      case WebviewCommand.CREATE_NEW_SESSION: {
        const { initialTitle } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.CREATE_NEW_SESSION];
        await this.handleCreateNewSession(initialTitle, webview);
        break;
      }

      case WebviewCommand.DELETE_SESSION: {
        const { sessionId } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.DELETE_SESSION];
        await this.handleDeleteSession(sessionId, webview);
        break;
      }

      case WebviewCommand.SAVE_SETTINGS: {
        const { settings } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.SAVE_SETTINGS];
        await this.handleSaveSettings(settings);
        break;
      }

      case WebviewCommand.SEND_MESSAGE: {
        const messagePayload = payload as WebviewCommandPayloadMap[typeof WebviewCommand.SEND_MESSAGE];
        await this.handleSendMessage(messagePayload, webview);
        break;
      }

      case WebviewCommand.CANCEL_STREAM: {
        await this.handleCancelStream();
        break;
      }

      case WebviewCommand.REQUEST_WORKSPACE_FILES: {
        await this.handleRequestWorkspaceFiles(webview);
        break;
      }

      case WebviewCommand.READ_FILE_CONTEXT: {
        const { filePath } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.READ_FILE_CONTEXT];
        await this.handleReadFileContext(filePath, webview);
        break;
      }

      default: {
        // Exhaustive check - this should never happen if all enum values are handled
        const exhaustive: never = command;
        console.error('[Neuralis] Unhandled command:', exhaustive);
      }
    }
  }

  // ==========================================================================
  // COMMAND HANDLERS
  // ==========================================================================

  /**
   * Handles the READY command.
   * Loads initial configuration and sends it to the frontend.
   */
  private async handleReady(webview: vscode.Webview): Promise<void> {
    console.log('[Neuralis] Webview ready - loading initial configuration');
    
    const settings = await this.configManager.load();
    const hasApiKey = await this.configManager.hasApiKey();

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SETTINGS, {
        settings,
        hasApiKey,
      })
    );

    // Automatically request session list after initialization
    await this.handleRequestSessionList(webview);
  }

  /**
   * Handles the REQUEST_SESSION_LIST command.
   * Retrieves session metadata and sends it to the frontend.
   */
  private async handleRequestSessionList(webview: vscode.Webview): Promise<void> {
    const sessions = await this.sessionManager.listSessions();

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SESSION_LIST, {
        sessions,
      })
    );
  }

  /**
   * Handles the REQUEST_SESSION_BY_ID command.
   * Loads a specific session detail and sends it to the frontend.
   */
  private async handleRequestSessionById(
    sessionId: string,
    webview: vscode.Webview
  ): Promise<void> {
    const session = await this.sessionManager.loadSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SESSION_DETAIL, {
        session,
      })
    );
  }

  /**
   * Handles the CREATE_NEW_SESSION command.
   * Creates a new session and sends the detail to the frontend.
   */
  private async handleCreateNewSession(
    initialTitle: string | undefined,
    webview: vscode.Webview
  ): Promise<void> {
    const session = await this.sessionManager.createNewSession(initialTitle);

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SESSION_DETAIL, {
        session,
      })
    );

    // Refresh session list to include the new session
    await this.handleRequestSessionList(webview);
  }

  /**
   * Handles the DELETE_SESSION command.
   * Deletes a session and refreshes the session list.
   */
  private async handleDeleteSession(
    sessionId: string,
    webview: vscode.Webview
  ): Promise<void> {
    await this.sessionManager.deleteSession(sessionId);

    // Refresh session list to reflect the deletion
    await this.handleRequestSessionList(webview);
  }

  /**
   * Handles the SAVE_SETTINGS command.
   * Persists the configuration to VS Code workspace settings.
   */
  private async handleSaveSettings(
    settings: Partial<AiSettings>
  ): Promise<void> {
    await this.configManager.save(settings);
    console.log('[Neuralis] Settings saved successfully');
  }

  /**
   * Handles the SEND_MESSAGE command.
   * Initiates streaming response from the AI client.
   */
  private async handleSendMessage(
    payload: WebviewCommandPayloadMap[typeof WebviewCommand.SEND_MESSAGE],
    webview: vscode.Webview
  ): Promise<void> {
    const { prompt, files, settings } = payload;

    // Create or get current session
    const sessions = await this.sessionManager.listSessions();
    let currentSession: SessionDetail | null = null;

    if (sessions.length > 0) {
      currentSession = await this.sessionManager.loadSession(sessions[0].id);
    }

    if (!currentSession) {
      currentSession = await this.sessionManager.createNewSession();
    }

    // Add user message to session
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: prompt,
      attachedFiles: files,
      timestamp: Date.now(),
    };

    currentSession.messages.push(userMessage);
    await this.sessionManager.saveSession(currentSession);

    // Start streaming response
    await this.deepseekClient.startStreaming(
      prompt,
      settings,
      currentSession.id,
      webview,
      files
    );

    // Reload session to get the final state
    const updatedSession = await this.sessionManager.loadSession(currentSession.id);
    if (updatedSession) {
      await this.sessionManager.saveSession(updatedSession);
    }
  }

  /**
   * Handles the CANCEL_STREAM command.
   * Aborts the active streaming request.
   */
  private async handleCancelStream(): Promise<void> {
    if (this.deepseekClient.isStreaming()) {
      await this.deepseekClient.abortActiveStream();
      console.log('[Neuralis] Stream cancelled successfully');
    }
  }

  /**
   * Handles the REQUEST_WORKSPACE_FILES command.
   * Scans workspace and sends file list to the frontend.
   */
  private async handleRequestWorkspaceFiles(webview: vscode.Webview): Promise<void> {
    const files = await this.workspaceUtility.findWorkspaceFiles();

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_WORKSPACE_FILES, {
        files,
      })
    );
  }

  /**
   * Handles the READ_FILE_CONTEXT command.
   * Reads a file from the workspace and sends its content to the frontend.
   */
  private async handleReadFileContext(
    filePath: string,
    webview: vscode.Webview
  ): Promise<void> {
    const file = await this.workspaceUtility.readFileContent(filePath);

    if (!file) {
      webview.postMessage(
        createExtensionEnvelope(ExtensionCommand.SHOW_ERROR, {
          message: `File not found or could not be read: ${filePath}`,
          code: 'FILE_NOT_FOUND',
        })
      );
      return;
    }

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_FILE_CONTEXT, {
        file,
      })
    );
  }

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  /**
   * Handles errors by sending an error message to the frontend.
   * Ensures the UI never hangs due to unhandled exceptions.
   * 
   * @param error - The caught error
   * @param context - Context string for logging
   * @param webview - The VS Code Webview instance
   */
  private async handleError(
    error: unknown,
    context: string,
    webview: vscode.Webview
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[Neuralis] ${context}:`, errorMessage);
    if (errorStack) {
      console.error('[Neuralis] Stack trace:', errorStack);
    }

    // Send user-friendly error message to frontend
    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SHOW_ERROR, {
        message: `⚠️ An error occurred: ${errorMessage}`,
        code: 'INTERNAL_ERROR',
      })
    );

    // Log to VS Code output channel or diagnostics
    const errorLog = `[${new Date().toISOString()}] ${context}: ${errorMessage}`;
    console.error(errorLog);
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default MessageRouter;