// webview-ui/src/contracts/webview.contracts.ts

/**
 * @fileoverview
 * Neuralis - Mirrored Data Contracts for Frontend Webview UI
 * 
 * This module re-exports all core data contracts from the backend contracts file.
 * It serves as the single source of truth for the React Webview UI, ensuring
 * complete type consistency between frontend and backend boundaries.
 * 
 * All types, enums, and interfaces are re-exported to maintain a clean import
 * path for the frontend application without direct dependency on backend structure.
 */

// ============================================================================
// RE-EXPORT CORE DOMAIN MODELS
// ============================================================================

/**
 * Re-export all core domain models from the backend contracts.
 * These interfaces define the shape of all data flowing through the application.
 */
export type {
  Role,
  ContextFile,
  Message,
  AiModel,
  ProOption,
  AiMode,
  AiSettings,
  SessionMetadata,
  SessionDetail,
} from '../../../src/contracts/message.contracts';

// ============================================================================
// RE-EXPORT IPC ENVELOPE
// ============================================================================

/**
 * Re-export the universal IPC envelope for type-safe message passing.
 * This ensures the frontend sends and receives messages in the same format
 * expected by the backend.
 */
export type {
  IpcEnvelope,
} from '../../../src/contracts/message.contracts';

// ============================================================================
// RE-EXPORT COMMAND ENUMS AND PAYLOAD MAPS
// ============================================================================

/**
 * Re-export command enums and their associated type maps.
 * These provide the complete set of allowed commands and their payload structures
 * for both directions of communication.
 */
export enum WebviewCommand {
  READY = 'READY',
  REQUEST_SESSION_LIST = 'REQUEST_SESSION_LIST',
  REQUEST_SESSION_BY_ID = 'REQUEST_SESSION_BY_ID',
  CREATE_NEW_SESSION = 'CREATE_NEW_SESSION',
  DELETE_SESSION = 'DELETE_SESSION',
  SEND_MESSAGE = 'SEND_MESSAGE',
  CANCEL_STREAM = 'CANCEL_STREAM',
  SAVE_SETTINGS = 'SAVE_SETTINGS',
  REQUEST_WORKSPACE_FILES = 'REQUEST_WORKSPACE_FILES',
  READ_FILE_CONTEXT = 'READ_FILE_CONTEXT',
  REQUEST_MODEL_LIST = 'REQUEST_MODEL_LIST',
  ADD_MODEL = 'ADD_MODEL',
  DELETE_MODEL = 'DELETE_MODEL',
}

export enum ExtensionCommand {
  SEND_SESSION_LIST = 'SEND_SESSION_LIST',
  SEND_SESSION_DETAIL = 'SEND_SESSION_DETAIL',
  SEND_SETTINGS = 'SEND_SETTINGS',
  SEND_WORKSPACE_FILES = 'SEND_WORKSPACE_FILES',
  SEND_FILE_CONTEXT = 'SEND_FILE_CONTEXT',
  STREAM_START = 'STREAM_START',
  STREAM_CHUNK = 'STREAM_CHUNK',
  STREAM_END = 'STREAM_END',
  SHOW_ERROR = 'SHOW_ERROR',
  SEND_MODEL_LIST = 'SEND_MODEL_LIST',
}

export type {
  WebviewCommandPayloadMap,
  ExtensionCommandPayloadMap,
  WebviewIpcEnvelope,
  ExtensionIpcEnvelope,
  IpcEnvelopePayload,
  IpcMessage,
} from '../../../src/contracts/message.contracts';
export function isWebviewCommand(command: string): command is WebviewCommand {
  return Object.values(WebviewCommand).includes(command as WebviewCommand);
}

export function isExtensionCommand(command: string): command is ExtensionCommand {
  return Object.values(ExtensionCommand).includes(command as ExtensionCommand);
}

export function createWebviewEnvelope<T extends WebviewCommand>(
  command: T,
  payload: WebviewCommandPayloadMap[T]
): any {
  return { command, payload };
}

export function createExtensionEnvelope<T extends ExtensionCommand>(
  command: T,
  payload: ExtensionCommandPayloadMap[T]
): any {
  return { command, payload };
}

// ============================================================================
// FRONTEND-SPECIFIC UTILITIES
// ============================================================================

/**
 * Type-safe message sender for the Webview UI.
 * Provides an abstraction over the VS Code API's postMessage method,
 * ensuring all outbound messages conform to the WebviewIpcEnvelope type.
 */
export class WebviewMessageSender {
  private readonly vscodeApi: { postMessage: (message: any) => void };

  constructor(vscodeApi: { postMessage: (message: any) => void }) {
    this.vscodeApi = vscodeApi;
  }

  /**
   * Sends a typed IPC envelope to the extension host.
   * Provides compile-time type safety by mapping commands to their payloads.
   * 
   * @template T - The WebviewCommand enum value
   * @param command - The command to send
   * @param payload - The payload associated with the command
   */
  public send<T extends WebviewCommand>(
    command: T,
    payload: WebviewCommandPayloadMap[T]
  ): void {
    const envelope = createWebviewEnvelope(command, payload);
    this.vscodeApi.postMessage(envelope);
  }

  /**
   * Convenience method for commands without payloads.
   * Sends a command with undefined payload.
   * 
   * @param command - The command to send (must have undefined payload)
   */
  public sendSimple<T extends WebviewCommand>(
    command: T
  ): T extends keyof WebviewCommandPayloadMap
    ? WebviewCommandPayloadMap[T] extends undefined
      ? void
      : never
    : never {
    const payload = undefined as any;
    this.send(command, payload as any);
    return undefined as any;
  }

  /**
   * Notifies the extension that the webview is ready.
   * Should be called immediately after React DOM mounts.
   */
  public notifyReady(): void {
    this.send(WebviewCommand.READY, undefined);
  }

  /**
   * Requests the list of all saved sessions.
   * Response will come via SEND_SESSION_LIST command.
   */
  public requestSessionList(): void {
    this.send(WebviewCommand.REQUEST_SESSION_LIST, undefined);
  }

  /**
   * Requests a specific session's detail.
   * Response will come via SEND_SESSION_DETAIL command.
   * 
   * @param sessionId - The ID of the session to load
   */
  public requestSessionById(sessionId: string): void {
    this.send(WebviewCommand.REQUEST_SESSION_BY_ID, { sessionId });
  }

  /**
   * Creates a new chat session.
   * 
   * @param initialTitle - Optional initial title for the session
   */
  public createNewSession(initialTitle?: string): void {
    this.send(WebviewCommand.CREATE_NEW_SESSION, { initialTitle });
  }

  /**
   * Deletes a specific session.
   * 
   * @param sessionId - The ID of the session to delete
   */
  public deleteSession(sessionId: string): void {
    this.send(WebviewCommand.DELETE_SESSION, { sessionId });
  }

  /**
   * Sends a message to the AI for processing.
   * 
   * @param prompt - The user's prompt text
   * @param settings - The AI settings to use for this message
   * @param files - Optional array of attached context files
   */
  public sendMessage(
    prompt: string,
    settings: AiSettings,
    files?: ContextFile[]
  ): void {
    this.send(WebviewCommand.SEND_MESSAGE, { prompt, settings, files });
  }

  /**
   * Requests cancellation of the active stream.
   */
  public cancelStream = (): void => {
    console.log('[IPC Sender] Dispatching CANCEL_STREAM to host...');
    this.send(WebviewCommand.CANCEL_STREAM, undefined);
  };

  /**
   * Persists partial AI settings to the backend configuration.
   * 
   * @param settings - Partial settings object to save
   */
  public saveSettings(settings: Partial<AiSettings>): void {
    this.send(WebviewCommand.SAVE_SETTINGS, { settings });
  }

  /**
   * Requests the list of workspace files.
   * Response will come via SEND_WORKSPACE_FILES command.
   */
  public requestWorkspaceFiles(): void {
    this.send(WebviewCommand.REQUEST_WORKSPACE_FILES, undefined);
  }

  /**
   * Requests content of a specific file by path.
   * Response will come via SEND_FILE_CONTEXT command.
   * 
   * @param filePath - Relative path to the file
   */
  public readFileContext(filePath: string): void {
    this.send(WebviewCommand.READ_FILE_CONTEXT, { filePath });
  }

  public requestModelList(): void {
    this.send(WebviewCommand.REQUEST_MODEL_LIST, undefined);
  }
  public deleteModel(modelId: string): void {
    this.send(WebviewCommand.DELETE_MODEL, { modelId });
  }
}

/**
 * Type-safe message receiver for the Webview UI.
 * Provides a clean abstraction for handling incoming messages from the extension host,
 * with proper type narrowing based on the command value.
 */
export class WebviewMessageReceiver {
  private readonly handlers: Map<ExtensionCommand, Set<(payload: any) => void>> = new Map();

  /**
   * Registers a listener for a specific extension command.
   * The handler will receive the typed payload for that command.
   * 
   * @template T - The ExtensionCommand enum value
   * @param command - The command to listen for
   * @param handler - Callback function to handle the payload
   * @returns A cleanup function to remove the listener
   */
  public on<T extends ExtensionCommand>(
    command: T,
    handler: (payload: ExtensionCommandPayloadMap[T]) => void
  ): () => void {
    if (!this.handlers.has(command)) {
      this.handlers.set(command, new Set());
    }
    this.handlers.get(command)!.add(handler);

    // Return cleanup function
    return () => {
      const handlers = this.handlers.get(command);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(command);
        }
      }
    };
  }

  /**
   * Processes an incoming message from the extension host.
   * Routes the message to all registered handlers for its command.
   * Should be called from the window message event listener.
   * 
   * @param envelope - The raw IPC envelope from the backend
   */
  public handleMessage(envelope: ExtensionIpcEnvelope): void {
    const { command, payload } = envelope;
    const handlers = this.handlers.get(command);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[Neuralis] Error handling command ${command}:`, error);
        }
      });
    }
  }

  /**
   * Removes all registered handlers for all commands.
   * Useful for cleanup when the component unmounts.
   */
  public clear(): void {
    this.handlers.clear();
  }
}

/**
 * Creates a type-safe event listener for the window message event.
 * Automatically filters and parses extension IPC messages.
 * 
 * @param receiver - The WebviewMessageReceiver instance
 * @returns A function suitable for window.addEventListener('message', ...)
 */
export function createMessageListener(
  receiver: WebviewMessageReceiver
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    const data = event.data;
    
    // Validate that the message is a proper IPC envelope
    if (
      data &&
      typeof data === 'object' &&
      'command' in data &&
      'payload' in data
    ) {
      // Type assertion is safe here since we validate the structure
      const envelope = data as ExtensionIpcEnvelope;
      
      // Only process Extension commands (ignore Webview commands echo)
      if (isExtensionCommand(envelope.command)) {
        receiver.handleMessage(envelope);
      }
    }
  };
}

/**
 * React hook-compatible utility for managing IPC communication lifecycle.
 * Provides methods to safely set up and tear down message listeners.
 */
export class IpcManager {
  public readonly sender: WebviewMessageSender;
  public readonly receiver: WebviewMessageReceiver;
  private readonly listener: ((event: MessageEvent) => void) | null = null;
  private isInitialized: boolean = false;

  constructor(vscodeApi: { postMessage: (message: any) => void }) {
    this.sender = new WebviewMessageSender(vscodeApi);
    this.receiver = new WebviewMessageReceiver();
    this.listener = createMessageListener(this.receiver);
  }

  /**
   * Initializes the IPC manager by attaching the message event listener.
   * Should be called once when the webview mounts.
   */
  public initialize(): void {
    if (!this.isInitialized && this.listener) {
      window.addEventListener('message', this.listener);
      this.isInitialized = true;
    }
  }

  /**
   * Cleanup method to remove event listeners and clear handlers.
   * Should be called when the webview unmounts.
   */
  public dispose(): void {
    if (this.isInitialized && this.listener) {
      window.removeEventListener('message', this.listener);
      this.isInitialized = false;
    }
    this.receiver.clear();
  }
}

export default IpcManager;