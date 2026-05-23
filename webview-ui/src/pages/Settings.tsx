import React, { useState, useCallback } from 'react';

interface SettingsProps {
  onBack: () => void;
  onClearHistory?: () => void;
  onSave?: (settings: SettingsState) => void;
}

interface SettingsState {
  apiKey: string;
  selectedModel: string;
  showReasoning: boolean;
  autoSave: boolean;
  themeFollowsSystem: boolean;
  showTimestamps: boolean;
}

const EyeIcon = ({ isVisible }: { isVisible: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {isVisible ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
);

const ToggleSwitch = ({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) => (
  <button
    onClick={onChange}
    className="flex items-center justify-between w-full py-2 px-1 group cursor-pointer"
    aria-label={label}
  >
    <span className="text-sm opacity-80 group-hover:opacity-100 transition-opacity">{label}</span>
    <div className={`
      relative w-10 h-6 rounded-full transition-all duration-300 ease-in-out
      ${enabled ? 'bg-[var(--vscode-button-background)]' : 'bg-[var(--vscode-input-background)]/50'}
      hover:opacity-80
    `}>
      <div className={`
        absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
        transition-transform duration-300 ease-in-out
        ${enabled ? 'translate-x-4' : 'translate-x-0'}
      `} />
    </div>
  </button>
);

const NeuralisBrandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
    <circle cx="10" cy="10" r="5" fill="currentColor" opacity="0.9"/>
    <path d="M10 6L10 14M6 10L14 10" stroke="var(--vscode-editor-background)" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export const Settings: React.FC<SettingsProps> = ({ 
  onBack, 
  onClearHistory, 
  onSave 
}) => {
  const [settings, setSettings] = useState<SettingsState>({
    apiKey: '',
    selectedModel: 'DeepSeek V4 Flash',
    showReasoning: true,
    autoSave: true,
    themeFollowsSystem: true,
    showTimestamps: false,
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleInputChange = useCallback((field: keyof SettingsState, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    // Simulate save delay
    await new Promise(resolve => setTimeout(resolve, 800));
    if (onSave) {
      onSave(settings);
    }
    setIsSaving(false);
  }, [settings, onSave]);

  const handleClearHistory = useCallback(() => {
    if (onClearHistory) {
      onClearHistory();
    }
    setShowClearConfirm(false);
  }, [onClearHistory]);

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)] overflow-hidden">
      {/* ===== Top Navigation Bar ===== */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--vscode-widget-border)]">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-[var(--vscode-list-hoverBackground)] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--vscode-button-background)]/30"
          title="Back to Home"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4L5 9L11 14" />
          </svg>
        </button>
        <h1 className="text-base font-semibold tracking-tight">Settings</h1>
      </div>

      {/* ===== Scrollable Content ===== */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          
          {/* ===== AI Configuration Section ===== */}
          <div className="bg-[var(--vscode-input-background)]/30 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
                <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z"/>
              </svg>
              <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60">AI Configuration</h2>
            </div>
            
            {/* API Key Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium opacity-70">DeepSeek API Key</label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-widget-border)] rounded-lg p-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vscode-button-background)]/30 focus:border-transparent transition-all duration-200 placeholder-[var(--vscode-input-placeholderForeground)]"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
                >
                  <EyeIcon isVisible={showApiKey} />
                </button>
              </div>
              <p className="text-[10px] opacity-40">Your key is stored securely in VS Code's configuration</p>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium opacity-70">Default Model</label>
              <div className="relative">
                <select
                  value={settings.selectedModel}
                  onChange={(e) => handleInputChange('selectedModel', e.target.value)}
                  className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-widget-border)] rounded-lg p-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--vscode-button-background)]/30 focus:border-transparent transition-all duration-200"
                >
                  <option value="DeepSeek V4 Flash">DeepSeek V4 Flash (Fast)</option>
                  <option value="DeepSeek V4 Pro">DeepSeek V4 Pro (Premium)</option>
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none">
                  <path d="M3 5L6 8L9 5"/>
                </svg>
              </div>
            </div>
          </div>

          {/* ===== Interface Section ===== */}
          <div className="bg-[var(--vscode-input-background)]/30 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60">Interface</h2>
            </div>

            <div className="space-y-1">
              <ToggleSwitch
                enabled={settings.showReasoning}
                onChange={() => handleInputChange('showReasoning', !settings.showReasoning)}
                label="Show AI Reasoning"
              />
              <ToggleSwitch
                enabled={settings.autoSave}
                onChange={() => handleInputChange('autoSave', !settings.autoSave)}
                label="Auto-save Chats"
              />
              <ToggleSwitch
                enabled={settings.themeFollowsSystem}
                onChange={() => handleInputChange('themeFollowsSystem', !settings.themeFollowsSystem)}
                label="Follow System Theme"
              />
              <ToggleSwitch
                enabled={settings.showTimestamps}
                onChange={() => handleInputChange('showTimestamps', !settings.showTimestamps)}
                label="Show Message Timestamps"
              />
            </div>
          </div>

          {/* ===== Data Management Section ===== */}
          <div className="bg-[var(--vscode-input-background)]/30 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60">Data Management</h2>
            </div>

            {/* Clear History Section */}
            <div className="border border-red-500/20 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5 text-red-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Clear All History</p>
                  <p className="text-[10px] opacity-50 mt-0.5">This action cannot be undone. All chat sessions will be permanently deleted.</p>
                </div>
              </div>
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full py-2 px-4 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  Clear All History
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2 px-4 rounded-lg border border-[var(--vscode-widget-border)] text-sm font-medium hover:bg-[var(--vscode-list-hoverBackground)] transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="flex-1 py-2 px-4 rounded-lg bg-red-500/80 text-white text-sm font-medium hover:bg-red-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  >
                    Confirm Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ===== Save Button ===== */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`
              w-full py-3 px-6 rounded-xl font-medium text-sm
              bg-[var(--vscode-button-background)]
              text-[var(--vscode-button-foreground)]
              transition-all duration-300 ease-in-out
              hover:opacity-90 hover:scale-[1.02]
              active:scale-[0.98]
              focus:outline-none focus:ring-2 focus:ring-[var(--vscode-button-background)]/50
              disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
              shadow-lg shadow-[var(--vscode-button-background)]/20
            `}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* ===== Brand Footer ===== */}
      <div className="flex items-center justify-center gap-2 py-3 border-t border-[var(--vscode-widget-border)]">
        <span className="opacity-30">
          <NeuralisBrandIcon />
        </span>
        <span className="text-[10px] opacity-30 font-medium tracking-wider">
          Neuralis AI — Version 1.0.0
        </span>
      </div>
    </div>
  );
};

export default Settings;