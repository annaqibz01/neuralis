// src/contracts/message.contracts.ts

/**
 * @fileoverview
 * Neuralis - Core Data Contracts for Backend Extension Host
 * 
 * This module defines the complete type system and IPC envelope contracts
 * governing communication between the VS Code Extension Host and the Webview UI.
 * All message passing must adhere to these interfaces for type-safe communication.
 */

// ============================================================================
// CORE DOMAIN MODELS
// ============================================================================

/**
 * Represents the role of a participant in a conversation.
 * Used to distinguish between user inputs, AI responses, and system messages.
 */
export type Role = 'user' | 'assistant' | 'system';

/**
 * Represents a file attached to a conversation context.
 * Supports optional content loading for workspace file references.
 */
export interface ContextFile {
  /** Relative or absolute path to the file */
  path: string;
  /** Display name of the file */
  name: string;
  /** Optional content buffer when file has been read */
  content?: string;
}

/**
 * Comprehensive message structure for turn-based conversations.
 * Supports DeepSeek reasoning tokens isolation and multi-file attachments.
 */
export interface Message {
  /** Unique identifier (UUID or secure timestamp-based) */
  id: string;
  /** Participant role in the conversation */
  role: Role;
  /** Primary markdown/text content */
  content: string;
  /** DeepSeek Pro reasoning/thinking tokens (isolated from main content) */
  thinkContent?: string;
  /** Array of attached workspace files for context scaling */
  attachedFiles?: ContextFile[];
  /** Unix epoch millisecond timestamp */
  timestamp: number;
}

/**
 * Supported AI model identifiers.
 * 'deepseek-v4-flash' for fast responses, 'deepseek-v4-pro' for advanced reasoning.
 */
export type AiModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';

/**
 * Pro model internal routing options.
 * 'fast' for quick responses, 'thinking' for deep reasoning mode.
 */
export type ProOption = 'fast' | 'thinking';

/**
 * Specialized LLM agent personas.
 * Determines the behavior and response style of the AI assistant.
 */
export type AiMode = 'chat' | 'planning' | 'agent' | 'coder';

/**
 * Composite AI settings configuration.
 * Controls model selection, routing options, agent persona, and API key.
 */
export interface AiSettings {
  /** AI model to use for responses */
  model: AiModel;
  /** Pro model routing option */
  proOption: ProOption;
  /** Agent persona mode */
  mode: AiMode;
  /** Optional API key for authentication */
  apiKey?: string;
}

/**
 * Lightweight session metadata for sidebar history indexing.
 * Contains only essential information for list displays.
 */
export interface SessionMetadata {
  /** Unique session identifier */
  id: string;
  /** Human-readable session title */
  title: string;
  /** Unix timestamp of session creation */
  createdAt: number;
  /** Unix timestamp of last modification */
  lastModifiedAt: number;
}

/**
 * Deep session entity containing complete conversation history.
 * Includes all messages and configuration settings for full session restoration.
 */
export interface SessionDetail {
  /** Unique session identifier */
  id: string;
  /** Human-readable session title */
  title: string;
  /** Complete conversation message history */
  messages: Message[];
  /** Unix timestamp of session creation */
  createdAt: number;
  /** AI settings configuration for this session */
  settings: AiSettings;
}

// ============================================================================
// UNIVERSAL IPC ENVELOPE
// ============================================================================

/**
 * Generic IPC envelope wrapping all postMessage communications.
 * Provides type-safe command routing with optional payload.
 * 
 * @template TCommand - The command type (enum value)
 * @template TPayload - The payload type (defaults to undefined for commands without payload)
 */
export interface IpcEnvelope<TCommand extends string, TPayload = undefined> {
  /** Command identifier for routing */
  command: TCommand;
  /** Optional payload data associated with the command */
  payload: TPayload;
}

// ============================================================================
// FRONTEND-TO-BACKEND GATEWAY (WebviewToExtension)
// ============================================================================

/**
 * Commands initiated by the Webview UI to the Extension Host.
 * Each enum value corresponds to a specific action the frontend can request.
 */
export enum WebviewCommand {
  /** Triggered when React DOM completes mounting - payload: undefined */
  READY = 'READY',
  /** Request index of all saved session files - payload: undefined */
  REQUEST_SESSION_LIST = 'REQUEST_SESSION_LIST',
  /** Request deep loading of a specific session - payload: { sessionId: string } */
  REQUEST_SESSION_BY_ID = 'REQUEST_SESSION_BY_ID',
  /** Create a new session file - payload: { initialTitle?: string } */
  CREATE_NEW_SESSION = 'CREATE_NEW_SESSION',
  /** Delete a session file - payload: { sessionId: string } */
  DELETE_SESSION = 'DELETE_SESSION',
  /** Submit a prompt to the AI - payload: { prompt: string, files?: ContextFile[], settings: AiSettings } */
  SEND_MESSAGE = 'SEND_MESSAGE',
  /** Cancel active stream - payload: undefined */
  CANCEL_STREAM = 'CANCEL_STREAM',
  /** Save AI settings - payload: { settings: Partial<AiSettings> } */
  SAVE_SETTINGS = 'SAVE_SETTINGS',
  /** Request workspace file tree - payload: undefined */
  REQUEST_WORKSPACE_FILES = 'REQUEST_WORKSPACE_FILES',
  /** Request file content by path - payload: { filePath: string } */
  READ_FILE_CONTEXT = 'READ_FILE_CONTEXT',
}

/**
 * Type-safe payload mappings for WebviewCommand.
 * Maps each command to its associated payload type for strict type checking.
 */
export interface WebviewCommandPayloadMap {
  [WebviewCommand.READY]: undefined;
  [WebviewCommand.REQUEST_SESSION_LIST]: undefined;
  [WebviewCommand.REQUEST_SESSION_BY_ID]: { sessionId: string };
  [WebviewCommand.CREATE_NEW_SESSION]: { initialTitle?: string };
  [WebviewCommand.DELETE_SESSION]: { sessionId: string };
  [WebviewCommand.SEND_MESSAGE]: { prompt: string; files?: ContextFile[]; settings: AiSettings };
  [WebviewCommand.CANCEL_STREAM]: undefined;
  [WebviewCommand.SAVE_SETTINGS]: { settings: Partial<AiSettings> };
  [WebviewCommand.REQUEST_WORKSPACE_FILES]: undefined;
  [WebviewCommand.READ_FILE_CONTEXT]: { filePath: string };
}

/**
 * Concrete IPC envelope type for Webview-to-Extension messages.
 * Provides type-safe command routing with the correct payload for each command.
 */
export type WebviewIpcEnvelope<T extends WebviewCommand = WebviewCommand> = 
  T extends keyof WebviewCommandPayloadMap
    ? IpcEnvelope<T, WebviewCommandPayloadMap[T]>
    : IpcEnvelope<T>;

// ============================================================================
// BACKEND-TO-FRONTEND GATEWAY (ExtensionToWebview)
// ============================================================================

/**
 * Commands initiated by the Extension Host to the Webview UI.
 * Each enum value corresponds to a specific action the backend can send.
 */
export enum ExtensionCommand {
  /** Send session list for sidebar - payload: { sessions: SessionMetadata[] } */
  SEND_SESSION_LIST = 'SEND_SESSION_LIST',
  /** Send session detail for conversation view - payload: { session: SessionDetail } */
  SEND_SESSION_DETAIL = 'SEND_SESSION_DETAIL',
  /** Send parsed settings to frontend - payload: { settings: AiSettings, hasApiKey: boolean } */
  SEND_SETTINGS = 'SEND_SETTINGS',
  /** Send workspace file list - payload: { files: string[] } */
  SEND_WORKSPACE_FILES = 'SEND_WORKSPACE_FILES',
  /** Send requested file content - payload: { file: ContextFile } */
  SEND_FILE_CONTEXT = 'SEND_FILE_CONTEXT',
  /** Signal stream start - payload: { sessionId: string, model: AiModel, mode: AiMode } */
  STREAM_START = 'STREAM_START',
  /** Push stream chunk - payload: { content?: string, reasoningContent?: string } */
  STREAM_CHUNK = 'STREAM_CHUNK',
  /** Finalize stream - payload: { finalMessage: Message } */
  STREAM_END = 'STREAM_END',
  /** Show error to user - payload: { message: string, code?: string } */
  SHOW_ERROR = 'SHOW_ERROR',
}

/**
 * Type-safe payload mappings for ExtensionCommand.
 * Maps each command to its associated payload type for strict type checking.
 */
export interface ExtensionCommandPayloadMap {
  [ExtensionCommand.SEND_SESSION_LIST]: { sessions: SessionMetadata[] };
  [ExtensionCommand.SEND_SESSION_DETAIL]: { session: SessionDetail };
  [ExtensionCommand.SEND_SETTINGS]: { settings: AiSettings; hasApiKey: boolean };
  [ExtensionCommand.SEND_WORKSPACE_FILES]: { files: string[] };
  [ExtensionCommand.SEND_FILE_CONTEXT]: { file: ContextFile };
  [ExtensionCommand.STREAM_START]: { sessionId: string; model: AiModel; mode: AiMode };
  [ExtensionCommand.STREAM_CHUNK]: { content?: string; reasoningContent?: string };
  [ExtensionCommand.STREAM_END]: { finalMessage: Message };
  [ExtensionCommand.SHOW_ERROR]: { message: string; code?: string };
}

/**
 * Concrete IPC envelope type for Extension-to-Webview messages.
 * Provides type-safe command routing with the correct payload for each command.
 */
export type ExtensionIpcEnvelope<T extends ExtensionCommand = ExtensionCommand> = 
  T extends keyof ExtensionCommandPayloadMap
    ? IpcEnvelope<T, ExtensionCommandPayloadMap[T]>
    : IpcEnvelope<T>;

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Helper type to extract the payload type from an IPC envelope.
 */
export type IpcEnvelopePayload<T> = T extends IpcEnvelope<any, infer P> ? P : never;

/**
 * Discriminated union type for all possible IPC messages.
 * Useful for creating message routers or dispatchers.
 */
export type IpcMessage = 
  | WebviewIpcEnvelope
  | ExtensionIpcEnvelope;

/**
 * Type guard to check if an IPC message is a Webview command.
 */
export function isWebviewCommand(command: string): command is WebviewCommand {
  return Object.values(WebviewCommand).includes(command as WebviewCommand);
}

/**
 * Type guard to check if an IPC message is an Extension command.
 */
export function isExtensionCommand(command: string): command is ExtensionCommand {
  return Object.values(ExtensionCommand).includes(command as ExtensionCommand);
}

/**
 * Creates a typed IPC envelope for Webview commands.
 * Provides compile-time type safety for command-payload matching.
 */
export function createWebviewEnvelope<T extends WebviewCommand>(
  command: T,
  payload: WebviewCommandPayloadMap[T]
): WebviewIpcEnvelope<T> {
  return { command, payload } as any;
}

/**
 * Creates a typed IPC envelope for Extension commands.
 * Provides compile-time type safety for command-payload matching.
 */
export function createExtensionEnvelope<T extends ExtensionCommand>(
  command: T,
  payload: ExtensionCommandPayloadMap[T]
): ExtensionIpcEnvelope<T> {
  return { command, payload } as any;
}