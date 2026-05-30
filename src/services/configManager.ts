// src/services/configManager.ts

/**
 * @fileoverview
 * Neuralis - Production-Ready Configuration Manager Service
 * 
 * This module handles the secure storage and retrieval of extension configuration.
 * Non-sensitive AI settings (model, proOption, mode) are stored using VS Code's
 * Workspace Configuration API, while sensitive data like the DeepSeek API key
 * is managed through the secure SecretStorage API.
 * 
 * Features:
 * - VS Code Configuration API integration for non-sensitive settings
 * - SecretStorage API for secure API key management
 * - Strict fallback defaults matching contract types
 * - Comprehensive error handling and logging
 * - Type-safe operations with full IConfigManager interface compliance
 */

import * as vscode from 'vscode';
import {
  AiSettings,
  AiModel,
  ProOption,
  AiMode,
} from '../contracts/message.contracts';

// ============================================================================
// CONSTANTS
// ============================================================================

/** VS Code configuration section for Neuralis */
const CONFIG_SECTION = 'neuralis';

/** Secret storage key for DeepSeek API key */
const API_KEY_SECRET_ID = 'neuralis.deepseek.apiKey';

/** Default values for AI settings matching contract specifications */
const DEFAULT_SETTINGS: AiSettings = {
  model: 'deepseek-v4-flash' as AiModel,
  proOption: 'fast' as ProOption,
  mode: 'chat' as AiMode,
};

/** Mapping of settings keys to their configuration paths */
const SETTINGS_KEY_MAP: Record<string, string> = {
  model: 'model',
  proOption: 'proOption',
  mode: 'mode',
};

// ============================================================================
// CONFIG MANAGER INTERFACE
// ============================================================================

/**
 * Interface for configuration management operations.
 * Handles reading and writing VS Code workspace configurations.
 */
export interface IConfigManager {
  /** Loads the current AI settings from workspace configuration */
  load(): Promise<AiSettings>;
  
  /** Saves partial AI settings to workspace configuration */
  save(settings: Partial<AiSettings>): Promise<void>;
  
  /** Checks if an API key is configured in secret storage */
  hasApiKey(): Promise<boolean>;
  
  /** Gets the API key from secret storage if configured */
  getApiKey(): Promise<string | undefined>;
}

// ============================================================================
// CONFIG MANAGER IMPLEMENTATION
// ============================================================================

/**
 * Production-ready configuration manager for Neuralis extension.
 * Manages both non-sensitive settings via VS Code Configuration API
 * and sensitive API keys via SecretStorage API.
 */
export class ConfigManager implements IConfigManager {
  private readonly context: vscode.ExtensionContext;

  /**
   * Creates a new ConfigManager instance.
   * 
   * @param context - The VS Code ExtensionContext for accessing secrets and configuration
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Loads the current AI settings from VS Code workspace configuration.
   * Falls back to strict defaults if any values are undefined.
   * 
   * @returns Complete AiSettings object with validated values
   */
  public async load(): Promise<AiSettings> {
    try {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      
      // Read each setting with type-safe fallback defaults
      const model = this.readModelSetting(config);
      const proOption = this.readProOptionSetting(config);
      const mode = this.readModeSetting(config);
      
      const settings: AiSettings = {
        model,
        proOption,
        mode,
      };

      console.log('[ConfigManager] Settings loaded successfully:', {
        model: settings.model,
        proOption: settings.proOption,
        mode: settings.mode,
      });

      return settings;
    } catch (error) {
      console.error('[ConfigManager] Failed to load settings:', error);
      // Return safe defaults on error to prevent runtime crashes
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Saves partial AI settings to VS Code configuration.
   * Intercepts and securely stores API key if present.
   * 
   * @param settings - Partial settings object to save
   */
  public async save(settings: Partial<AiSettings>): Promise<void> {
    if (!settings || Object.keys(settings).length === 0) {
      console.warn('[ConfigManager] No settings provided to save');
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

      // Process each provided setting
      for (const [key, value] of Object.entries(settings)) {
        // Handle API key separately using secure storage
        if (key === 'apiKey') {
          await this.saveApiKey(value as string | undefined);
          continue;
        }

        // Save non-sensitive settings to VS Code configuration
        await this.saveConfigurationSetting(config, key, value);
      }

      console.log('[ConfigManager] Settings saved successfully');
    } catch (error) {
      console.error('[ConfigManager] Failed to save settings:', error);
      throw new Error('Failed to save configuration settings');
    }
  }

  /**
   * Checks if an API key is configured in VS Code secret storage.
   * 
   * @returns True if a non-empty API key exists
   */
  public async hasApiKey(): Promise<boolean> {
    try {
      const apiKey = await this.context.secrets.get(API_KEY_SECRET_ID);
      return typeof apiKey === 'string' && apiKey.trim().length > 0;
    } catch (error) {
      console.error('[ConfigManager] Failed to check API key existence:', error);
      return false;
    }
  }

  /**
   * Retrieves the DeepSeek API key from VS Code secret storage.
   * 
   * @returns The API key string or undefined if not set
   */
  public async getApiKey(): Promise<string | undefined> {
    try {
      const apiKey = await this.context.secrets.get(API_KEY_SECRET_ID);
      return apiKey || undefined;
    } catch (error) {
      console.error('[ConfigManager] Failed to retrieve API key:', error);
      return undefined;
    }
  }

  /**
   * Stores or removes the API key in VS Code secret storage.
   * 
   * @param apiKey - The API key to store, or undefined/empty to remove
   */
  public async setApiKey(apiKey: string | undefined): Promise<void> {
    try {
      if (apiKey && apiKey.trim().length > 0) {
        await this.context.secrets.store(API_KEY_SECRET_ID, apiKey.trim());
        console.log('[ConfigManager] API key stored successfully');
      } else {
        await this.context.secrets.delete(API_KEY_SECRET_ID);
        console.log('[ConfigManager] API key removed from storage');
      }
    } catch (error) {
      console.error('[ConfigManager] Failed to manage API key:', error);
      throw new Error('Failed to update API key in secure storage');
    }
  }

  /**
   * Clears all stored configuration and secrets.
   * Useful for resetting the extension state.
   */
  public async clearAll(): Promise<void> {
    try {
      // Clear API key from secret storage
      try {
        await this.context.secrets.delete(API_KEY_SECRET_ID);
      } catch {
        // Ignore if key doesn't exist
      }

      // Reset configuration settings to defaults
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      
      for (const key of Object.keys(SETTINGS_KEY_MAP)) {
        try {
          await config.update(key, undefined, vscode.ConfigurationTarget.Global);
        } catch {
          // Ignore if setting doesn't exist
        }
      }

      console.log('[ConfigManager] All settings cleared successfully');
    } catch (error) {
      console.error('[ConfigManager] Failed to clear settings:', error);
      throw new Error('Failed to clear all configuration');
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS - SETTINGS READING
  // ==========================================================================

  /**
   * Reads and validates the model setting.
   * 
   * @param config - VS Code workspace configuration
   * @returns Validated AiModel value
   */
  private readModelSetting(config: vscode.WorkspaceConfiguration): AiModel {
    const value = config.get<string>('model');
    const validModels: AiModel[] = ['deepseek-v4-flash', 'deepseek-v4-pro'];
    
    if (value && validModels.includes(value as AiModel)) {
      return value as AiModel;
    }
    
    return DEFAULT_SETTINGS.model;
  }

  /**
   * Reads and validates the proOption setting.
   * 
   * @param config - VS Code workspace configuration
   * @returns Validated ProOption value
   */
  private readProOptionSetting(config: vscode.WorkspaceConfiguration): ProOption {
    const value = config.get<string>('proOption');
    const validOptions: ProOption[] = ['fast', 'thinking'];
    
    if (value && validOptions.includes(value as ProOption)) {
      return value as ProOption;
    }
    
    return DEFAULT_SETTINGS.proOption;
  }

  /**
   * Reads and validates the mode setting.
   * 
   * @param config - VS Code workspace configuration
   * @returns Validated AiMode value
   */
  private readModeSetting(config: vscode.WorkspaceConfiguration): AiMode {
    const value = config.get<string>('mode');
    const validModes: AiMode[] = ['chat', 'planning', 'agent', 'coder'];
    
    if (value && validModes.includes(value as AiMode)) {
      return value as AiMode;
    }
    
    return DEFAULT_SETTINGS.mode;
  }

  // ==========================================================================
  // PRIVATE HELPERS - SETTINGS SAVING
  // ==========================================================================

  /**
   * Saves a single configuration setting to VS Code.
   * Validates the setting type and applies appropriate constraints.
   * 
   * @param config - VS Code workspace configuration
   * @param key - The setting key
   * @param value - The setting value to save
   */
  private async saveConfigurationSetting(
    config: vscode.WorkspaceConfiguration,
    key: string,
    value: any
  ): Promise<void> {
    // Skip if value is undefined (handled by delete if needed)
    if (value === undefined) {
      return;
    }

    const configKey = SETTINGS_KEY_MAP[key];
    if (!configKey) {
      console.warn(`[ConfigManager] Unknown setting key: ${key}`);
      return;
    }

    // Validate the value based on the setting type
    const validatedValue = this.validateSettingValue(key, value);
    if (validatedValue === undefined) {
      console.warn(`[ConfigManager] Invalid value for setting ${key}:`, value);
      return;
    }

    try {
      await config.update(configKey, validatedValue, vscode.ConfigurationTarget.Global);
      console.log(`[ConfigManager] Setting ${key} updated to:`, validatedValue);
    } catch (error) {
      console.error(`[ConfigManager] Failed to update setting ${key}:`, error);
      throw new Error(`Failed to save configuration setting: ${key}`);
    }
  }

  /**
   * Validates and sanitizes a setting value based on its type.
   * Ensures only valid enum values are persisted.
   * 
   * @param key - The setting key
   * @param value - The value to validate
   * @returns Validated value or undefined if invalid
   */
  private validateSettingValue(key: string, value: any): any {
    switch (key) {
      case 'model': {
        const validModels: AiModel[] = ['deepseek-v4-flash', 'deepseek-v4-pro'];
        return validModels.includes(value as AiModel) ? value : undefined;
      }
      
      case 'proOption': {
        const validOptions: ProOption[] = ['fast', 'thinking'];
        return validOptions.includes(value as ProOption) ? value : undefined;
      }
      
      case 'mode': {
        const validModes: AiMode[] = ['chat', 'planning', 'agent', 'coder'];
        return validModes.includes(value as AiMode) ? value : undefined;
      }
      
      default:
        return value;
    }
  }

  /**
   * Saves the API key to VS Code secret storage.
   * Handles both setting and clearing the key.
   * 
   * @param apiKey - The API key value to save (or undefined to clear)
   */
  private async saveApiKey(apiKey: string | undefined): Promise<void> {
    try {
      if (apiKey && apiKey.trim().length > 0) {
        await this.context.secrets.store(API_KEY_SECRET_ID, apiKey.trim());
        console.log('[ConfigManager] API key saved to secure storage');
      } else {
        // If apiKey is explicitly set to empty, remove it from storage
        try {
          await this.context.secrets.delete(API_KEY_SECRET_ID);
          console.log('[ConfigManager] API key removed from secure storage');
        } catch {
          // Key might not exist, which is fine
        }
      }
    } catch (error) {
      console.error('[ConfigManager] Failed to save API key to secret storage:', error);
      throw new Error('Failed to securely store API key');
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Gets all configuration keys currently set in VS Code settings.
   * Useful for debugging and verification.
   * 
   * @returns Array of configuration keys with their current values
   */
  public async getConfigurationSummary(): Promise<Record<string, any>> {
    try {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      const hasApiKey = await this.hasApiKey();
      
      return {
        model: config.get<string>('model'),
        proOption: config.get<string>('proOption'),
        mode: config.get<string>('mode'),
        hasApiKeyConfigured: hasApiKey,
        apiKeyConfigured: hasApiKey ? 'Yes (secure storage)' : 'No',
      };
    } catch (error) {
      console.error('[ConfigManager] Failed to get configuration summary:', error);
      return {
        error: 'Failed to read configuration',
      };
    }
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ConfigManager;