import React, { useState } from 'react';
import { AiSettings, WebviewMessageSender, RegisteredModel } from '../contracts/webview.contracts';

interface ModelDropdownProps {
  aiSettings: AiSettings;
  registeredModels: RegisteredModel[]; // 👈 Menerima data dinamis dari App.tsx
  ipcSender: WebviewMessageSender | null;
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({ aiSettings, registeredModels, ipcSender }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentModelId = aiSettings?.model;

  // Mencari model aktif secara dinamis. Jika belum ada/kosong, gunakan fallback.
  const activeModel = registeredModels.find(m => m.id === currentModelId) 
                      || registeredModels[0] 
                      || { id: '', name: 'No Engine Selected' };

  return (
    <div className="relative">
      {/* Tombol Pemicu Utama */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-transparent hover:bg-[var(--vscode-list-hoverBackground)] text-[11px] font-semibold text-[var(--vscode-foreground)] tracking-tight transition-colors outline-none border-none"
      >
        <span className="select-none">{activeModel.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-[var(--vscode-descriptionForeground)] transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Panel List Pilihan */}
      {isOpen && (
        <>
          {/* Backdrop Transparan */}
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          
          {/* Kotak Menu Opsi (Premium Dynamic Layout) */}
          <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] shadow-2xl z-50 p-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 max-h-64 overflow-y-auto custom-scrollbar">
            
            {registeredModels.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-[var(--vscode-descriptionForeground)] italic">
                No models registered. Please add them in Settings.
              </div>
            ) : (
              registeredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    ipcSender?.saveSettings({ model: model.id });
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                    currentModelId === model.id 
                      ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' 
                      : 'hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
                  }`}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[12px] font-bold truncate">{model.name}</span>
                    <span className={`text-[10px] font-mono truncate mt-0.5 ${currentModelId === model.id ? 'opacity-80' : 'text-[var(--vscode-descriptionForeground)]'}`}>
                      {model.id}
                    </span>
                  </div>
                  
                  {/* Ikon Checkmark jika model ini sedang aktif */}
                  {currentModelId === model.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </button>
              ))
            )}

          </div>
        </>
      )}
    </div>
  );
};