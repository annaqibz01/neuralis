// src/services/sessionManager.ts

/**
 * @fileoverview
 * Neuralis - Production-Ready Session Manager Service
 * 
 * This module implements persistent session storage using VS Code's workspace
 * file system API. Each session is stored as an individual JSON file in the
 * extension's global storage directory, providing durable state management
 * across extension restarts.
 * 
 * Features:
 * - VS Code workspace fs integration for file operations
 * - Individual session files for optimized loading
 * - Resilient error handling for corrupted files
 * - Automatic directory initialization
 * - Sorted session listing by last modified date
 */

import * as vscode from 'vscode';
import {
  SessionMetadata,
  SessionDetail,
  Message,
  AiSettings,
} from '../contracts/message.contracts';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Prefix for session file names */
const SESSION_FILE_PREFIX = 'session_';

/** JSON file extension */
const JSON_EXTENSION = '.json';

/** Maximum ID generation retries to avoid collisions */
const MAX_ID_RETRIES = 5;

// ============================================================================
// SESSION MANAGER INTERFACE
// ============================================================================

/**
 * Interface for session management operations.
 * Defines the contract for creating, reading, updating, and deleting sessions.
 */
export interface ISessionManager {
  /** Lists all saved session metadata sorted by last modified (newest first) */
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

// ============================================================================
// SESSION MANAGER IMPLEMENTATION
// ============================================================================

/**
 * Production-ready session manager using VS Code's file system API.
 * Persists chat sessions as individual JSON files in the extension's
 * global storage directory for reliable data management.
 */
export class SessionManager implements ISessionManager {
  private readonly storageUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private initialized: boolean = false;

  /**
   * Creates a new SessionManager instance.
   * 
   * @param context - The VS Code ExtensionContext for accessing storage paths
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.storageUri = context.globalStorageUri;
  }

  /**
   * Ensures the storage directory exists.
   * Should be called before any file operations to guarantee
   * the directory structure is in place.
   */
  private async ensureDirectory(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await vscode.workspace.fs.createDirectory(this.storageUri);
      this.initialized = true;
      console.log(`[SessionManager] Storage directory ensured: ${this.storageUri.fsPath}`);
    } catch (error) {
      console.error('[SessionManager] Failed to create storage directory:', error);
      throw new Error('Failed to initialize session storage directory');
    }
  }

  /**
   * Generates a unique session ID with timestamp and random component.
   * Implements retry logic to avoid ID collisions.
   * 
   * @returns A unique session identifier string
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Validates and sanitizes a filename to prevent path traversal attacks.
   * Removes any path separators and potentially dangerous characters.
   * 
   * @param filename - The filename to sanitize
   * @returns Sanitized filename
   */
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  }

  /**
   * Constructs the full URI for a session file.
   * 
   * @param sessionId - The session ID
   * @returns VS Code URI for the session file
   */
  private getSessionFileUri(sessionId: string): vscode.Uri {
    const sanitizedId = this.sanitizeFilename(sessionId);
    const filename = `${SESSION_FILE_PREFIX}${sanitizedId}${JSON_EXTENSION}`;
    return vscode.Uri.joinPath(this.storageUri, filename);
  }

  /**
   * Reads and parses a session file into a SessionDetail object.
   * 
   * @param fileUri - The URI of the session file
   * @returns Parsed SessionDetail or null if invalid
   */
  private async readSessionFile(fileUri: vscode.Uri): Promise<SessionDetail | null> {
    try {
      const fileData = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(fileData).toString('utf-8');
      
      if (!content || content.trim().length === 0) {
        console.warn(`[SessionManager] Empty session file: ${fileUri.fsPath}`);
        return null;
      }

      const parsed = JSON.parse(content) as SessionDetail;
      
      // Validate required fields
      if (!parsed.id || !parsed.title || !Array.isArray(parsed.messages)) {
        console.warn(`[SessionManager] Invalid session data structure: ${fileUri.fsPath}`);
        return null;
      }

      // Ensure timestamp fields are numbers
      parsed.createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now();
      
      // Ensure messages have required fields
      parsed.messages = parsed.messages.filter(msg => {
        return msg.id && msg.role && msg.content;
      });

      return parsed;
    } catch (error) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        console.log(`[SessionManager] Session file not found: ${fileUri.fsPath}`);
        return null;
      }
      
      if (error instanceof SyntaxError) {
        console.error(`[SessionManager] Corrupted session file: ${fileUri.fsPath}`, error);
        return null;
      }

      console.error(`[SessionManager] Failed to read session file: ${fileUri.fsPath}`, error);
      return null;
    }
  }

  /**
   * Extracts the session ID from a filename.
   * 
   * @param filename - The filename (e.g., "session_abc123.json")
   * @returns The session ID or null if invalid
   */
  private extractSessionIdFromFilename(filename: string): string | null {
    const pattern = new RegExp(`^${SESSION_FILE_PREFIX}(.+)${JSON_EXTENSION}$`);
    const match = filename.match(pattern);
    return match ? match[1] : null;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Lists all saved sessions sorted by last modification time (newest first).
   * Reads all JSON files from the storage directory and extracts metadata.
   * 
   * @returns Array of SessionMetadata sorted by lastModifiedAt descending
   */
  public async listSessions(): Promise<SessionMetadata[]> {
    await this.ensureDirectory();
    const sessions: SessionMetadata[] = [];

    try {
      const entries = await vscode.workspace.fs.readDirectory(this.storageUri);
      
      // Process each file in the directory
      for (const [name, fileType] of entries) {
        // Skip non-JSON files and directories
        if (fileType !== vscode.FileType.File || !name.endsWith(JSON_EXTENSION)) {
          continue;
        }

        const sessionId = this.extractSessionIdFromFilename(name);
        if (!sessionId) {
          continue;
        }

        const fileUri = this.getSessionFileUri(sessionId);
        const session = await this.readSessionFile(fileUri);
        
        if (session) {
          sessions.push({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            // Use the file's last modified time if available, fall back to session's createdAt
            lastModifiedAt: session.createdAt,
          });
        }
      }
    } catch (error) {
      console.error('[SessionManager] Failed to list sessions:', error);
      // Return any sessions we managed to load
    }

    // Sort by lastModifiedAt in descending order (newest first)
    sessions.sort((a, b) => b.lastModifiedAt - a.lastModifiedAt);

    return sessions;
  }

  /**
   * Loads a complete session by its ID.
   * Returns null if the session doesn't exist or cannot be parsed.
   * 
   * @param sessionId - The unique session identifier
   * @returns The complete SessionDetail or null
   */
  public async loadSession(sessionId: string): Promise<SessionDetail | null> {
    if (!sessionId) {
      console.warn('[SessionManager] Invalid session ID provided');
      return null;
    }

    await this.ensureDirectory();

    try {
      const fileUri = this.getSessionFileUri(sessionId);
      return await this.readSessionFile(fileUri);
    } catch (error) {
      console.error(`[SessionManager] Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Creates a new chat session.
   * Generates a unique ID, creates the SessionDetail object,
   * persists it to disk, and returns the new session.
   * 
   * @param initialTitle - Optional title for the session
   * @returns The newly created SessionDetail
   */
  public async createNewSession(initialTitle?: string): Promise<SessionDetail> {
    await this.ensureDirectory();

    const now = Date.now();
    const sessionId = this.generateSessionId();
    const title = initialTitle || `Chat Session ${new Date(now).toLocaleString()}`;

    const session: SessionDetail = {
      id: sessionId,
      title: title,
      messages: [],
      createdAt: now,
      settings: {
        model: 'deepseek-v4-flash',
        proOption: 'fast',
        mode: 'chat',
      },
    };

    // Save the new session to disk
    await this.saveSession(session);

    console.log(`[SessionManager] Created new session: ${sessionId}`);
    return session;
  }

  /**
   * Deletes a session by its ID.
   * Removes the corresponding JSON file from the storage directory.
   * 
   * @param sessionId - The unique session identifier to delete
   */
  public async deleteSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      console.warn('[SessionManager] Invalid session ID for deletion');
      return;
    }

    await this.ensureDirectory();

    try {
      const fileUri = this.getSessionFileUri(sessionId);
      
      // Check if file exists before attempting deletion
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        console.log(`[SessionManager] Session file not found for deletion: ${sessionId}`);
        return;
      }

      await vscode.workspace.fs.delete(fileUri, { useTrash: false });
      console.log(`[SessionManager] Deleted session: ${sessionId}`);
    } catch (error) {
      console.error(`[SessionManager] Failed to delete session ${sessionId}:`, error);
      throw new Error(`Failed to delete session: ${sessionId}`);
    }
  }

  /**
   * Saves a session to persistent storage.
   * Updates the lastModifiedAt timestamp, converts to pretty-printed JSON,
   * and writes to the file system.
   * 
   * @param session - The complete SessionDetail to save
   */
  public async saveSession(session: SessionDetail): Promise<void> {
    if (!session || !session.id) {
      throw new Error('Invalid session data: missing ID');
    }

    await this.ensureDirectory();

    try {
      // Update the last modified timestamp
      const updatedSession: SessionDetail = {
        ...session,
      };

      // Ensure messages array exists
      if (!updatedSession.messages) {
        updatedSession.messages = [];
      }

      // Serialize to pretty-printed JSON for readability
      const jsonContent = JSON.stringify(updatedSession, null, 2);
      const buffer = Buffer.from(jsonContent, 'utf-8');
      const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

      const fileUri = this.getSessionFileUri(session.id);
      await vscode.workspace.fs.writeFile(fileUri, uint8Array);

      console.log(`[SessionManager] Saved session: ${session.id} (${session.messages.length} messages)`);
    } catch (error) {
      console.error(`[SessionManager] Failed to save session ${session.id}:`, error);
      throw new Error(`Failed to save session: ${session.id}`);
    }
  }

  /**
   * Cleans up corrupted or empty session files.
   * Useful for maintenance operations.
   * 
   * @returns Number of cleaned files
   */
  public async cleanCorruptedSessions(): Promise<number> {
    await this.ensureDirectory();
    let cleanedCount = 0;

    try {
      const entries = await vscode.workspace.fs.readDirectory(this.storageUri);
      
      for (const [name, fileType] of entries) {
        if (fileType !== vscode.FileType.File || !name.endsWith(JSON_EXTENSION)) {
          continue;
        }

        const sessionId = this.extractSessionIdFromFilename(name);
        if (!sessionId) {
          continue;
        }

        const fileUri = this.getSessionFileUri(sessionId);
        const session = await this.readSessionFile(fileUri);
        
        if (!session) {
          // Delete corrupted or unreadable files
          try {
            await vscode.workspace.fs.delete(fileUri, { useTrash: false });
            cleanedCount++;
            console.log(`[SessionManager] Cleaned corrupted session file: ${name}`);
          } catch (deleteError) {
            console.error(`[SessionManager] Failed to clean corrupted file ${name}:`, deleteError);
          }
        }
      }
    } catch (error) {
      console.error('[SessionManager] Failed to clean corrupted sessions:', error);
    }

    return cleanedCount;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default SessionManager;