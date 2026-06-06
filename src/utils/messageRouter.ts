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
  RegisteredModel,
} from '../contracts/message.contracts';
import { ConfigManager } from '../services/configManager';
import { SessionManager } from '../services/sessionManager';
import { DeepseekClient } from '../services/deepseekClient';

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

  getModels(): RegisteredModel[];
  addModel(model: RegisteredModel): Promise<void>;
  deleteModel(modelId: string): Promise<void>;
}

/**
 * Interface for DeepSeek AI client operations.
 * Manages streaming communication with the DeepSeek API.
 */
interface IDeepseekClient {
  /** Starts a streaming request to the AI */
  startStreaming(
    sessionMessages: Message[],
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
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
      const fileUri = vscode.Uri.joinPath(workspaceUri, filePath);

      // Cek stat file untuk mengonfirmasi keberadaan dan ukurannya
      const fileStat = await vscode.workspace.fs.stat(fileUri);
      
      // Batasi ukuran file: 2 * 1024 * 1024 byte = 2MB
      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      if (fileStat.size > MAX_FILE_SIZE) {
        console.warn(`[Neuralis] Membatalkan pembacaan file ${filePath} karena terlalu besar (${(fileStat.size / 1024 / 1024).toFixed(2)} MB)`);
        return null; // Blokir pembacaan file OOM
      }

      // Read file content aman
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
    sessionManager: SessionManager,
    configManager: ConfigManager,
    deepseekClient: DeepseekClient
  ) {
    this.sessionManager = sessionManager;
    this.configManager = configManager;
    this.deepseekClient = deepseekClient;
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
        await this.handleSaveSettings(settings, webview);
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

      case WebviewCommand.REQUEST_MODEL_LIST: {
        const models = this.configManager.getModels();
        webview.postMessage(createExtensionEnvelope(
          ExtensionCommand.SEND_MODEL_LIST, 
          { models }
        ));
        break;
      }

      case WebviewCommand.ADD_MODEL: {
        const { model } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.ADD_MODEL];
        await this.configManager.addModel(model);
        
        const models = this.configManager.getModels();
        webview.postMessage(createExtensionEnvelope(
          ExtensionCommand.SEND_MODEL_LIST, 
          { models }
        ));
        break;
      }

      case WebviewCommand.DELETE_MODEL: {
        const { modelId } = payload as WebviewCommandPayloadMap[typeof WebviewCommand.DELETE_MODEL];
        await this.configManager.deleteModel(modelId);
        
        const models = this.configManager.getModels();
        webview.postMessage(createExtensionEnvelope(
          ExtensionCommand.SEND_MODEL_LIST, 
          { models }
        ));
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

    // ✨ POTONGAN KODE PERBAIKAN: Paksa buat sesi baru yang bersih setiap kali startup / refresh
    const newSession = await this.sessionManager.createNewSession();
    
    // Kirim detail sesi kosong ini ke Frontend React agar langsung memicu Empty State
    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SESSION_DETAIL, {
        session: newSession,
      })
    );

    // Automatically request session list setelah initialization agar sidebar riwayat sinkron
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
    settings: Partial<AiSettings>,
    webview: vscode.Webview
  ): Promise<void> {
    await this.configManager.save(settings);
    console.log('[Neuralis] Settings saved successfully');

    const updatedSettings = await this.configManager.load();
    const hasApiKey = await this.configManager.hasApiKey();

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SETTINGS, {
        settings: updatedSettings,
        hasApiKey,
      })
    );
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

    console.log('[DEBUG SETTINGS FRONTEND]', JSON.stringify(settings, null, 2));

    const availableModels = this.configManager.getModels();
    const isModelValid = availableModels.some(m => m.id === settings?.model);

    if (!settings || !settings.model || settings.model.trim() === '' || !isModelValid) {
      const error = new Error("Engine terputus. Silakan registrasi ulang AI Model di menu Settings.");
      await this.handleError(error, 'Invalid Model Configuration', webview);
      return; 
    }

    // Create or get current session
    const sessions = await this.sessionManager.listSessions();
    let currentSession = sessions.length > 0 ? await this.sessionManager.loadSession(sessions[0].id) : null;
    if (!currentSession) currentSession = await this.sessionManager.createNewSession();
    
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: prompt,
      attachedFiles: files,
      timestamp: Date.now(),
    };

    // 📄 A. Masukkan pesan user ke database sesi dan simpan ke disk
    currentSession.messages.push(userMessage);
    await this.sessionManager.saveSession(currentSession);

    // 🚀 B. KIRIM SEGERA ke frontend agar balon chat user muncul instan & empty state MATI PERMANEN
    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SEND_SESSION_DETAIL, {
        session: currentSession,
      })
    );

    try {
      // 🔄 C. Jalankan proses streaming tokens dari DeepSeek API
      const finalAiMessage = await this.deepseekClient.startStreaming(currentSession.messages, settings, currentSession.id, webview, files);

      // 💾 D. Ambil state berkas paling mutakhir dari disk setelah streaming selesai
      const updatedSession = await this.sessionManager.loadSession(currentSession.id);
      if (updatedSession) {
        // Gabungkan pesan AI ke dalam riwayat berkas, lalu kunci/simpan ke disk
        updatedSession.messages.push(finalAiMessage);
        await this.sessionManager.saveSession(updatedSession);
      }

      // 🏁 E. SINYAL FINAL: Beritahu frontend untuk matikan isStreaming HANYA SETELAH file sukses aman di disk!
      webview.postMessage(
        createExtensionEnvelope(ExtensionCommand.STREAM_END, {
          finalMessage: finalAiMessage,
        })
      );
    } catch (streamError) {
      console.error('[MessageRouter] Error during AI stream execution:', streamError);
    }
  }
  /**
   * Handles the CANCEL_STREAM command.
   * Aborts the active streaming request.
   */
  private async handleCancelStream(): Promise<void> {
    
    await this.deepseekClient.abortActiveStream();
    console.log('[Neuralis] Stream cancelled successfully');
    
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