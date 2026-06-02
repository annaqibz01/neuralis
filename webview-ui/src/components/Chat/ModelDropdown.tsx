import React, { useState } from 'react';
import { AiSettings, WebviewMessageSender } from '../contracts/webview.contracts';

interface ModelDropdownProps {
  aiSettings: AiSettings;
  ipcSender: WebviewMessageSender | null;
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({ aiSettings, ipcSender }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentModel = aiSettings?.model || 'deepseek-v4-flash';

  const models = [
    { id: 'deepseek-v4-pro', name: 'DeepSeek Pro', icon: '🚀', desc: 'Maximum reasoning capability' },
    { id: 'deepseek-v4-fast', name: 'DeepSeek Flash', icon: '⚡', desc: 'High speed and efficiency' }
  ];

  const activeModel = models.find(m => m.id === currentModel) || models[1];

  return (
    <div className="relative">
      {/* Tombol Pemicu Utama (Dipastikan bg-transparent tanpa warna nge-block) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-transparent hover:bg-[var(--vscode-list-hoverBackground)] text-[11px] font-semibold text-[var(--vscode-foreground)] tracking-tight transition-colors outline-none border-none"
      >
        <span className="select-none">{activeModel.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--vscode-descriptionForeground)]">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Panel List Pilihan (Hanya muncul saat di-klik) */}
      {isOpen && (
        <>
          {/* Backdrop Transparan untuk mendeteksi klik di luar dropdown */}
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          
          {/* Kotak Menu Opsi (Ini menggunakan warna solid bertema agar opsi teks terbaca jelas) */}
          <div className="absolute top-full left-0 mt-1.5 w-48 rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] shadow-2xl z-50 p-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  ipcSender?.saveSettings({ model: model.id });
                  setIsOpen(false);
                }}
                className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                  currentModel === model.id 
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' 
                    : 'hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
                }`}
              >
                <span className="text-[14px] mt-0.5 select-none">{model.icon}</span>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[12px] font-bold truncate">{model.name}</span>
                  <span className={`text-[10px] truncate ${currentModel === model.id ? 'opacity-80' : 'text-[var(--vscode-descriptionForeground)]'}`}>
                    {model.desc}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};