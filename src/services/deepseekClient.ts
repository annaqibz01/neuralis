// src/services/deepseekClient.ts

/**
 * @fileoverview
 * Neuralis - Production-Ready DeepSeek API Client Service
 * 
 * This module implements streaming communication with the official DeepSeek API
 * using Server-Sent Events (SSE). It handles token isolation, separating
 * reasoning tokens from regular response content, and manages the complete
 * lifecycle of streaming requests with proper abort handling.
 * 
 * Features:
 * - OpenAI-compatible API streaming via Server-Sent Events
 * - Isolated reasoning token extraction for DeepSeek Pro models
 * - AbortController-based cancellation support
 * - Comprehensive error handling with user-friendly error messages
 * - Automatic session message accumulation
 */

import * as vscode from 'vscode';
import {
  IConfigManager,
} from './configManager';
import {
  AiSettings,
  AiModel,
  AiMode,
  ContextFile,
  Message,
  ExtensionCommand,
  createExtensionEnvelope,
} from '../contracts/message.contracts';

// ============================================================================
// CONSTANTS
// ============================================================================

/** DeepSeek API base URL for OpenAI-compatible endpoints */
const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com/v1';

/** API endpoint for chat completions */
const CHAT_COMPLETIONS_ENDPOINT = '/chat/completions';

/** Default request timeout in milliseconds (5 minutes) */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Maximum retry attempts for network failures */
const MAX_RETRIES = 3;

/** Retry delay in milliseconds */
const RETRY_DELAY_MS = 1000;

/** SSE data prefix */
const SSE_DATA_PREFIX = 'data: ';

/** SSE stream termination marker */
const SSE_DONE_MARKER = '[DONE]';

/** Reference to the AbortController class for type safety */
type AbortControllerType = AbortController;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Interface for the DeepSeek API streaming client.
 * Defines the contract for initiating, managing, and aborting streaming requests.
 */
export interface IDeepseekClient {
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
// API RESPONSE TYPES
// ============================================================================

/**
 * Represents a single SSE data chunk from the DeepSeek API.
 */
interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      thinking?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Represents the complete API response for non-streaming mode.
 */
interface DeepSeekApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
      thinking?: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// DEEPSEEK CLIENT IMPLEMENTATION
// ============================================================================

/**
 * Production-ready DeepSeek API client with streaming support.
 * Handles SSE parsing, token isolation, and lifecycle management.
 */
export class DeepseekClient implements IDeepseekClient {
  private readonly configManager: IConfigManager;
  private abortController: AbortControllerType | null = null;
  private isStreamActive: boolean = false;
  private accumulatedContent: string = '';
  private accumulatedReasoning: string = '';

  /**
   * Creates a new DeepseekClient instance.
   * 
   * @param configManager - Configuration manager for retrieving API key and settings
   */
  constructor(configManager: IConfigManager) {
    this.configManager = configManager;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Starts a streaming request to the DeepSeek API.
   * Processes SSE data chunks in real-time, isolating reasoning tokens
   * from regular content, and streams them to the webview.
   * 
   * @param prompt - The user's input prompt
   * @param settings - AI settings configuration
   * @param sessionId - Current session identifier
   * @param webview - VS Code Webview instance for sending responses
   * @param files - Optional attached context files
   * @returns The final Message object after stream completion
   */
  public async startStreaming(
    prompt: string,
    settings: AiSettings,
    sessionId: string,
    webview: vscode.Webview,
    files?: ContextFile[]
  ): Promise<Message> {
    // Reset accumulated content
    this.accumulatedContent = '';
    this.accumulatedReasoning = '';

    // Validate API key
    const apiKey = await this.configManager.getApiKey();
    if (!apiKey) {
      const error = new Error('DeepSeek API key is not configured. Please set your API key in extension settings.');
      await this.sendErrorToWebview(error, webview);
      throw error;
    }

    // Create abort controller for this request
    this.abortController = new AbortController();
    this.isStreamActive = true;

    // Send stream start signal
    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.STREAM_START, {
        sessionId,
        model: settings.model,
        mode: settings.mode,
      })
    );

    try {
      // Prepare the request payload
      const requestBody = this.buildRequestBody(prompt, settings, files);
      
      // Execute the streaming request with retry logic
      const finalMessage = await this.executeStreamingRequest(
        requestBody,
        apiKey,
        settings,
        webview
      );

      return finalMessage;
    } catch (error) {
      await this.handleStreamError(error, webview);
      throw error;
    } finally {
      this.isStreamActive = false;
      this.abortController = null;
    }
  }

  /**
   * Aborts the currently active streaming request.
   * Safely terminates the network connection and cleans up resources.
   */
  public async abortActiveStream(): Promise<void> {
    if (this.abortController) {
      console.log('[DeepseekClient] Aborting active stream');
      this.abortController.abort();
      this.abortController = null;
      this.isStreamActive = false;
      
      // Create a partial message for the aborted state
      const partialMessage: Message = {
        id: `msg_${Date.now()}_aborted`,
        role: 'assistant',
        content: this.accumulatedContent || '[Response interrupted]',
        thinkContent: this.accumulatedReasoning || undefined,
        timestamp: Date.now(),
      };

      // Reset accumulators
      this.accumulatedContent = '';
      this.accumulatedReasoning = '';
    }
  }

  /**
   * Checks if there is an active streaming request.
   * 
   * @returns True if a stream is currently active
   */
  public isStreaming(): boolean {
    return this.isStreamActive;
  }

  // ==========================================================================
  // PRIVATE METHODS - REQUEST BUILDING
  // ==========================================================================

  /**
   * Builds the request body for the DeepSeek API call.
   * Constructs messages array including system prompt and context files.
   * 
   * @param prompt - The user's input prompt
   * @param settings - AI settings configuration
   * @param files - Optional attached context files
   * @returns The complete request body object
   */
  private buildRequestBody(
    prompt: string,
    settings: AiSettings,
    files?: ContextFile[]
  ): Record<string, any> {
    const messages: Array<Record<string, any>> = [];

    // Add system message based on mode
    const systemMessage = this.buildSystemMessage(settings.mode);
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
      });
    }

    // Add file context if provided
    if (files && files.length > 0) {
      const fileContext = this.buildFileContextMessage(files);
      messages.push({
        role: 'user',
        content: fileContext,
      });
    }

    // Add the actual user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    // Build the complete request
    const requestBody: Record<string, any> = {
      model: settings.model,
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    };

    // Add pro-specific parameters if using deepseek-v4-pro
    if (settings.model === 'deepseek-v4-pro') {
      requestBody.reasoning_mode = settings.proOption === 'thinking' ? 'deep' : 'fast';
    }

    return requestBody;
  }

  /**
   * Builds the system message based on the selected AI mode.
   * Provides persona-specific instructions for the AI.
   * 
   * @param mode - The AI agent persona mode
   * @returns System message string or empty string
   */
  private buildSystemMessage(mode: AiMode): string {
    switch (mode) {
      case 'chat':
        return 'You are a helpful AI assistant. Respond conversationally and naturally.';
      
      case 'planning':
        return 'You are a strategic planning assistant. Break down complex tasks into actionable steps. Provide clear timelines, dependencies, and risk assessments.';
      
      case 'agent':
        return 'You are an autonomous AI agent. Take initiative to solve problems, suggest actions, and provide detailed execution plans. Use tools and APIs when appropriate.';
      
      case 'coder':
        return 'You are an expert programming assistant. Provide well-documented, efficient code solutions. Explain your reasoning and best practices. Always include code examples in markdown code blocks.';
      
      default:
        return '';
    }
  }

  /**
   * Builds a context message from attached files.
   * Formats file contents for inclusion in the API request.
   * 
   * @param files - Array of attached context files
   * @returns Formatted context string
   */
  private buildFileContextMessage(files: ContextFile[]): string {
    const contextParts: string[] = ['I have attached the following files for context:\n'];

    for (const file of files) {
      if (file.content) {
        contextParts.push(`=== File: ${file.path} ===`);
        contextParts.push('```');
        contextParts.push(file.content);
        contextParts.push('```\n');
      } else {
        contextParts.push(`- ${file.path} (content not loaded)`);
      }
    }

    contextParts.push('\nPlease consider these files when responding to my question.');
    return contextParts.join('\n');
  }

  // ==========================================================================
  // PRIVATE METHODS - STREAM EXECUTION
  // ==========================================================================

  /**
   * Executes the streaming request with retry logic.
   * Handles network failures and reconnection attempts.
   * 
   * @param requestBody - The API request body
   * @param apiKey - The DeepSeek API key
   * @param settings - AI settings configuration
   * @param webview - VS Code Webview instance
   * @returns The final Message object
   */
  private async executeStreamingRequest(
    requestBody: Record<string, any>,
    apiKey: string,
    settings: AiSettings,
    webview: vscode.Webview
  ): Promise<Message> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.sendStreamingRequest(requestBody, apiKey, webview);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry if aborted
        if (this.abortController?.signal.aborted) {
          throw lastError;
        }

        // Don't retry on authentication errors
        if (lastError.message.includes('401') || lastError.message.includes('Unauthorized')) {
          throw lastError;
        }

        console.warn(`[DeepseekClient] Stream attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < MAX_RETRIES) {
          // Notify webview about retry
          webview.postMessage(
            createExtensionEnvelope(ExtensionCommand.STREAM_CHUNK, {
              content: `\n\n_[Retrying connection... (attempt ${attempt + 1}/${MAX_RETRIES})]_\n\n`,
            })
          );
          
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Sends the actual streaming request to the DeepSeek API.
   * Processes SSE data chunks in real-time.
   * 
   * @param requestBody - The API request body
   * @param apiKey - The DeepSeek API key
   * @param webview - VS Code Webview instance
   * @returns The final Message object
   */
  private async sendStreamingRequest(
    requestBody: Record<string, any>,
    apiKey: string,
    webview: vscode.Webview
  ): Promise<Message> {
    const url = `${DEEPSEEK_API_BASE_URL}${CHAT_COMPLETIONS_ENDPOINT}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requestBody),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    // Process the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith(SSE_DATA_PREFIX)) {
            const data = line.slice(SSE_DATA_PREFIX.length).trim();
            
            if (data === SSE_DONE_MARKER) {
              // Stream complete
              break;
            }

            if (data) {
              this.processStreamChunk(data, webview);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Build and return the final message
    return this.buildFinalMessage();
  }

  /**
   * Processes a single SSE data chunk.
   * Extracts content and reasoning tokens and dispatches them to the webview.
   * 
   * @param data - The JSON data string from SSE
   * @param webview - VS Code Webview instance
   */
  private processStreamChunk(data: string, webview: vscode.Webview): void {
    try {
      const chunk = JSON.parse(data) as DeepSeekStreamChunk;
      
      if (!chunk.choices || chunk.choices.length === 0) {
        return;
      }

      const delta = chunk.choices[0].delta;
      if (!delta) {
        return;
      }

      // Extract reasoning content (DeepSeek-specific field)
      const reasoningContent = delta.reasoning_content || delta.thinking;
      if (reasoningContent) {
        this.accumulatedReasoning += reasoningContent;
        webview.postMessage(
          createExtensionEnvelope(ExtensionCommand.STREAM_CHUNK, {
            reasoningContent: reasoningContent,
          })
        );
      }

      // Extract regular content
      const content = delta.content;
      if (content) {
        this.accumulatedContent += content;
        webview.postMessage(
          createExtensionEnvelope(ExtensionCommand.STREAM_CHUNK, {
            content: content,
          })
        );
      }
    } catch (error) {
      console.error('[DeepseekClient] Failed to parse SSE chunk:', error);
      // Continue processing despite parse errors
    }
  }

  /**
   * Builds the final Message object from accumulated content.
   * 
   * @returns Complete Message object
   */
  private buildFinalMessage(): Message {
    const finalMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: this.accumulatedContent,
      thinkContent: this.accumulatedReasoning || undefined,
      timestamp: Date.now(),
    };

    return finalMessage;
  }

  // ==========================================================================
  // PRIVATE METHODS - ERROR HANDLING
  // ==========================================================================

  /**
   * Handles stream errors by sending appropriate messages to the webview.
   * 
   * @param error - The caught error
   * @param webview - VS Code Webview instance
   */
  private async handleStreamError(
    error: unknown,
    webview: vscode.Webview
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[DeepseekClient] Stream error:', errorMessage);
    if (errorStack) {
      console.error('[DeepseekClient] Stack trace:', errorStack);
    }

    // Check if the error was due to abort
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[DeepseekClient] Stream was aborted by user');
      return;
    }

    // Build a partial message from accumulated content
    const partialContent = this.accumulatedContent || '';
    const partialReasoning = this.accumulatedReasoning || '';

    // Send error to webview
    await this.sendErrorToWebview(error instanceof Error ? error : new Error(errorMessage), webview);

    // If we have partial content, send it as a stream end
    if (partialContent) {
      const partialMessage: Message = {
        id: `msg_${Date.now()}_partial`,
        role: 'assistant',
        content: partialContent + `\n\n_[Error: ${errorMessage}]_`,
        thinkContent: partialReasoning || undefined,
        timestamp: Date.now(),
      };

      webview.postMessage(
        createExtensionEnvelope(ExtensionCommand.STREAM_END, {
          finalMessage: partialMessage,
        })
      );
    }
  }

  /**
   * Sends an error message to the webview for display.
   * 
   * @param error - The error object
   * @param webview - VS Code Webview instance
   */
  private async sendErrorToWebview(
    error: Error,
    webview: vscode.Webview
  ): Promise<void> {
    let userMessage: string;
    let errorCode: string | undefined;

    // Map common errors to user-friendly messages
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      userMessage = 'Invalid API key. Please check your DeepSeek API key in extension settings.';
      errorCode = 'INVALID_API_KEY';
    } else if (error.message.includes('429') || error.message.includes('Rate limit')) {
      userMessage = 'API rate limit exceeded. Please wait a moment before trying again.';
      errorCode = 'RATE_LIMIT';
    } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
      userMessage = 'Request timed out. Please try again with a shorter prompt.';
      errorCode = 'TIMEOUT';
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      userMessage = 'Network error. Please check your internet connection and try again.';
      errorCode = 'NETWORK_ERROR';
    } else if (error.message.includes('abort') || error.message.includes('AbortError')) {
      // Don't send errors for user-cancelled operations
      return;
    } else {
      userMessage = `An error occurred while communicating with DeepSeek API: ${error.message}`;
      errorCode = 'API_ERROR';
    }

    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.SHOW_ERROR, {
        message: `⚠️ ${userMessage}`,
        code: errorCode,
      })
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Creates a delay for retry logic.
   * 
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default DeepseekClient;