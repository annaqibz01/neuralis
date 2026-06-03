// webview-ui/src/pages/Settings.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { WebviewMessageSender, AiSettings, RegisteredModel, WebviewCommand } from '../contracts/webview.contracts';

interface ExtendedAiSettings extends AiSettings {
  apiKey?: string;
}

interface SettingsProps {
  aiSettings: ExtendedAiSettings;
  registeredModels: RegisteredModel[];
  onSaveSettings: (settings: Partial<ExtendedAiSettings>) => void;
  onNavigateToChat: () => void;
  ipcSender: WebviewMessageSender;
}

// Daftar baku model dari berbagai Provider
const PROVIDER_MODELS = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-chat', label: 'DeepSeek V3 (Chat)' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner)' },
  { id: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { id: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' }
];

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

export const Settings: React.FC<SettingsProps> = ({ 
  aiSettings, 
  registeredModels,
  onSaveSettings, 
  onNavigateToChat,
  ipcSender 
}) => {
  const [apiKey, setApiKey] = useState(aiSettings.apiKey || '');
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiSettings.apiKey) {
      setApiKey(aiSettings.apiKey);
    }
  }, [aiSettings]);

  // Handler click-outside untuk menutup dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Saat dropdown dipilih
  const handleModelSelect = (selectedId: string, selectedLabel: string) => {
    setModelId(selectedId); // Hanya ID yang masuk ke state modelId
    setModelName(selectedLabel); // Nama masuk ke state modelName
    setIsDropdownOpen(false);
  };

  const handleSaveConfiguration = useCallback(async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);

    const currentModelId = modelId.trim() || aiSettings.model;
    
    // Daftarkan model jika form ID dan Name diisi
    if (modelId.trim() && modelName.trim()) {
      ipcSender.send(WebviewCommand.ADD_MODEL, {
        model: { id: modelId.trim(), name: modelName.trim() }
      });
    }

    // Simpan API Key & tetapkan model aktif
    onSaveSettings({
      apiKey: apiKey.trim(),
      model: currentModelId
    });

    // Kosongkan form input model
    setModelId('');
    setModelName('');
    
    setTimeout(() => setIsSaving(false), 500);
  }, [apiKey, modelId, modelName, aiSettings.model, onSaveSettings, ipcSender]);

  const handleDeleteModel = (idToDelete: string) => {
    ipcSender.send(WebviewCommand.DELETE_MODEL, { modelId: idToDelete });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)] overflow-hidden">
      
      {/* ===== HEADER ===== */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] relative z-10">
        <button onClick={onNavigateToChat} className="p-1.5 rounded-md hover:bg-[var(--vscode-list-hoverBackground)] transition-colors focus:outline-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h1 className="text-[14px] font-semibold tracking-wide flex-1">Engine Registration</h1>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="max-w-xl mx-auto space-y-6">
          
          {/* INPUT DATA BLOCK */}
          <div className="border border-[var(--vscode-widget-border)] rounded-xl bg-[var(--vscode-editor-background)]/40 p-4 space-y-5 shadow-sm">
            
            {/* Input 1: API Key */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">API Secret Key</label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-widget-border)] rounded-lg p-2.5 pr-10 text-[13px] font-mono focus:outline-none focus:border-[var(--vscode-focusBorder)] transition-colors"
                />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] transition-colors focus:outline-none">
                  <EyeIcon isVisible={showApiKey} />
                </button>
              </div>
            </div>

            {/* Input 2: Custom Dropdown Engine Selector */}
            <div className="space-y-1.5 relative" ref={dropdownRef}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Provider Model ID</label>
              
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full bg-[var(--vscode-input-background)] border rounded-lg p-2.5 text-[13px] text-left font-mono flex items-center justify-between focus:outline-none transition-colors cursor-pointer ${
                  isDropdownOpen 
                    ? 'border-[var(--vscode-focusBorder)] ring-1 ring-[var(--vscode-focusBorder)]/30' 
                    : 'border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)]'
                }`}
              >
                <span className={modelId ? 'text-[var(--vscode-input-foreground)]' : 'text-[var(--vscode-input-placeholderForeground)]'}>
                  {modelId ? modelId : 'Select Provider Model...'}
                </span>
                {/* Ikon Chevron Kecil (Standar Dropdown UX) */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-[var(--vscode-descriptionForeground)] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : 'rotate-0'}`}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Panel Floating Dropdown Premium */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] max-h-64 overflow-y-auto border border-[var(--vscode-widget-border)] rounded-lg bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] z-[100] shadow-xl py-1 custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-widget-border)]/40 mb-1">
                    Available Providers
                  </div>
                  {PROVIDER_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleModelSelect(model.id, model.label)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[var(--vscode-list-activeSelectionBackground)] hover:text-[var(--vscode-list-activeSelectionForeground)] transition-colors focus:outline-none flex flex-col gap-0.5 group"
                    >
                      <span className="text-[13px] font-semibold">{model.label}</span>
                      <span className="text-[11px] font-mono opacity-60 group-hover:opacity-90">{model.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input 3: Model Display Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Model Custom Name</label>
              <input 
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. DeepSeek V4 Flash"
                className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-widget-border)] rounded-lg p-2.5 text-[13px] focus:outline-none focus:border-[var(--vscode-focusBorder)] transition-colors"
              />
              <p className="text-[10px] text-[var(--vscode-descriptionForeground)] opacity-80 pl-0.5">
                Will auto-fill when a Provider Model ID is selected.
              </p>
            </div>

            {/* ACTION SAVE BUTTON */}
            <div className="pt-2">
              <button
                onClick={handleSaveConfiguration}
                disabled={isSaving || !apiKey.trim()}
                className="w-full py-3 px-6 rounded-lg font-semibold text-[13px] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md flex justify-center items-center gap-2"
              >
                {isSaving ? 'Registering...' : 'Save & Register'}
              </button>
            </div>

          </div>

          {/* TABLE MODEL REGISTRY */}
          <div className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] px-1">Registered Infrastructure Logs</h2>
            
            <div className="border border-[var(--vscode-widget-border)] rounded-xl overflow-hidden bg-[var(--vscode-editor-background)]/20 shadow-sm">
              <div className="flex flex-col">
                {registeredModels.length === 0 ? (
                  <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--vscode-descriptionForeground)] opacity-50">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <span className="text-[12px] text-[var(--vscode-descriptionForeground)] italic">No active models mapped inside this workspace grid.</span>
                  </div>
                ) : (
                  registeredModels.map((model) => (
                    <div key={model.id} className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-widget-border)]/40 last:border-0 group hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-[var(--vscode-foreground)] flex items-center gap-2">
                          {model.name}
                          {aiSettings.model === model.id && (
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--vscode-textLink-foreground)]/15 text-[var(--vscode-textLink-foreground)] text-[9px] font-black uppercase tracking-wider">Active</span>
                          )}
                        </span>
                        <span className="text-[11px] text-[var(--vscode-descriptionForeground)] font-mono opacity-70">{model.id}</span>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteModel(model.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-rose-400 hover:bg-rose-500/15 transition-all focus:outline-none focus:opacity-100"
                        title="Remove Node Asset"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;