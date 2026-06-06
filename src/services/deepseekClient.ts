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
  private isInsideThinkTag: boolean = false;
  private isThinkingEnabled: boolean = false;

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
    sessionMessages: Message[],
    settings: AiSettings,
    sessionId: string,
    webview: vscode.Webview,
    files?: ContextFile[]
  ): Promise<Message> {
    // 🎯 KUNCI SINKRONISASI UTAMA: Update state internal sebelum request payload dirakit!
    // Jika proOption dari frontend adalah 'thinking' maka true, jika 'fast' maka false.
    this.isThinkingEnabled = settings.proOption === 'thinking';
    
    this.isStreamActive = true;
    this.accumulatedContent = '';
    this.accumulatedReasoning = '';
    this.abortController = new AbortController();

    // Notify webview that stream has started
    webview.postMessage(
      createExtensionEnvelope(ExtensionCommand.STREAM_START, {
        sessionId: sessionId,
        model: settings.model,
        mode: settings.mode, // Pastikan tipe data settings.mode sesuai (misal: 'chat', 'coder', dll)
      })
    );

    const apiKey = await this.configManager.getApiKey();
    if (!apiKey) {
      throw new Error('API Key tidak ditemukan. Silakan periksa kembali konfigurasi ekstensi Anda.');
    }

    try {
      // Prepare the request payload
      const requestBody = this.buildRequestBody(sessionMessages, settings, files);
      
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
    sessionMessages: Message[],
    settings: AiSettings,
    files?: ContextFile[]
  ): Record<string, any> {
    const messages: Array<Record<string, any>> = [];

    // 1. AMBIL KONFIGURASI MODE (Instruction & Temperature)
    const modeConfig = this.getModeConfig(settings.mode);

    // 2. SYSTEM PROMPT DINAMIS DI INDEX 0
    messages.push({
      role: 'system',
      content: `You are Neuralis, an advanced context-aware AI.\n\nCURRENT PERSONA INSTRUCTION:\n${modeConfig.instruction}`
    });

    // 3. PETAKAN RIWAYAT PESAN DENGAN MURNI
    (sessionMessages || []).forEach((msg, index) => {
      const isLastMessage = index === sessionMessages.length - 1;

      if (msg.role === 'user') {
        let finalContent = msg.content;

        // Hanya tambahkan konteks file di prompt terakhir (current prompt)
        if (isLastMessage && files && files.length > 0) {
          finalContent = `${this.buildFileContextMessage(files)}\n\n${finalContent}`;
        }

        messages.push({
          role: 'user',
          content: finalContent,
        });
      } else if (msg.role === 'assistant') {
        const assistantPayload: Record<string, any> = {
          role: 'assistant',
          content: msg.content,
        };

        // Memasukkan kembali thinking block (CoT) agar logika AI tidak terputus
        if (msg.thinkContent) {
          if (settings.model.toLowerCase().includes('deepseek')) {
            assistantPayload.reasoning_content = msg.thinkContent;
          } else {
            assistantPayload.content = `<think>\n${msg.thinkContent}\n</think>\n\n${msg.content}`;
          }
        }

        messages.push(assistantPayload);
      }
    });

    // 4. SUSUN PAYLOAD AKHIR DENGAN DYNAMIC TEMPERATURE
    const requestBody: Record<string, any> = {
      model: settings.model,
      messages: messages,
      stream: true,
      temperature: modeConfig.temperature, // 🔥 Disuntikkan secara dinamis berdasarkan mode!
      max_tokens: 4096,
    };

    requestBody.thinking = {
      type: settings.proOption === 'thinking' ? 'enabled' : 'disabled'
    };

    return requestBody;
  }

  /**
   * Builds the system message based on the selected AI mode.
   * Provides persona-specific instructions for the AI.
   * 
   * @param mode - The AI agent persona mode
   * @returns System message string or empty string
   */
  private getModeConfig(mode: AiMode): { instruction: string; temperature: number } {
    switch (mode) {
      case 'chat':
        return {
          instruction: 'You are a highly intelligent, empathetic, and conversational AI assistant. Your goal is to provide helpful, concise, and natural responses. Adapt your tone to the user\'s mood, be engaging, and communicate with clarity.',
          temperature: 0.7 // Kreativitas dan keluwesan tinggi
        };
      
      case 'coder':
        return {
          instruction: 'You are an elite, senior software engineer and technical architect. Provide highly optimized, secure, and well-documented code solutions. Always explain the underlying logic, highlight edge cases, and enforce best practices. Use clean markdown for code blocks. If a request is ambiguous, state your assumptions logically. Do not hallucinate APIs or functions.',
          temperature: 0.1 // Sangat deterministik, presisi absolut, nol halusinasi
        };
      
      case 'planning':
        return {
          instruction: 'You are a strategic project manager and systems architect. Your primary function is to break down complex requests into structured, actionable, and logical steps. Emphasize dependencies, timelines, and risk management. Always format your responses using clear bullet points, numbered lists, or tables for maximum readability.',
          temperature: 0.4 // Keseimbangan antara struktur logis dan sedikit fleksibilitas taktis
        };
      
      case 'agent':
        return {
          instruction: 'You are an autonomous, proactive problem-solving agent. Analyze the user\'s objective deeply, outline a step-by-step execution plan, and simulate the execution of those steps logically. Focus on decisive, efficient, and self-correcting logic. Point out potential flaws in the user\'s original premise if necessary.',
          temperature: 0.3 // Logika deduktif yang tajam
        };
      
      default:
        return {
          instruction: 'You are a helpful AI assistant.',
          temperature: 0.7
        };
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
          // ✅ Bersihkan memori sisa dari attempt yang gagal sebelum mencoba ulang
          this.accumulatedContent = '';
          this.accumulatedReasoning = '';

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

    console.log('==========================================================================');
    console.log('[DEBUG BACKEND ➔ DEEPSEEK API CALL]');
    console.log(`URL Endpoint : ${url}`);
    console.log('Headers      :', JSON.stringify({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.substring(0, 7)}...[REDACTED]`, // Aman dari kebocoran key penuh di log
      'Accept': 'text/event-stream',
    }, null, 2));
    console.log('Payload Body :');
    console.log(JSON.stringify(requestBody, null, 2)); // Memformat struktur JSON riwayat & parameter
    console.log('==========================================================================');
    
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
        if (!this.isStreamActive) {
          await reader.cancel(); // 🚀 Ini cara API untuk berhenti secara elegan
          break;
        }
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
      const chunk = JSON.parse(data) as DeepSeekStreamChunk & { usage?: any };
      //const chunk = JSON.parse(data) as DeepSeekStreamChunk;
      const hasFinishReason = chunk.choices && chunk.choices.length > 0 && chunk.choices[0].finish_reason !== null;
      if (hasFinishReason || chunk.usage) {
        console.log('\n==========================================================================');
        console.log('[DEBUG BACKEND ➔ RAW FINAL STREAM CHUNK]');
        console.log(JSON.stringify(chunk, null, 2));
        console.log('==========================================================================\n');
      }

      if (!chunk.choices || chunk.choices.length === 0) {
        return;
      }

      const delta = chunk.choices[0].delta;
      if (!delta) {
        return;
      }

      // Extract reasoning content (DeepSeek-specific field)
      const reasoningContent = delta.reasoning_content || delta.thinking;
      
      // 🎯 GERBANG PENGAMAN UTAMA: Hanya kumpulkan dan stream jika mode thinking AKTIF!
      if (this.isThinkingEnabled && reasoningContent && reasoningContent.trim() !== '') {
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
    }
  }

  /**
   * Builds the final Message object from accumulated content.
   * * @returns Complete Message object
   */
  private buildFinalMessage(): Message {
    const finalMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: this.accumulatedContent,
      // 🎯 PROTEKSI DATABASE: Jika toggle dimatikan, pastikan properti thinkContent murni bernilai undefined!
      thinkContent: this.isThinkingEnabled && this.accumulatedReasoning ? this.accumulatedReasoning : undefined,
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
        message: userMessage,
        code: errorCode,
      })
    );
  }

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