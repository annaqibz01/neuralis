import React, { useState } from 'react';
import { AiSettings, WebviewMessageSender, AiMode } from '../../contracts/webview.contracts';

interface ModeDropdownProps {
  aiSettings: AiSettings;
  ipcSender: WebviewMessageSender | null;
}

const MODES: { id: AiMode; name: string; icon: string; desc: string }[] = [
  { id: 'chat', name: 'Chat', icon: '💬', desc: 'Standard conversational assistant' },
  { id: 'coder', name: 'Coder', icon: '💻', desc: 'Expert programming assistant' },
  { id: 'planning', name: 'Planning', icon: '🗺️', desc: 'Strategic planning & breakdown' },
  { id: 'agent', name: 'Agent', icon: '🤖', desc: 'Autonomous problem solving' },
];

export const ModeDropdown: React.FC<ModeDropdownProps> = ({ aiSettings, ipcSender }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentModeId = aiSettings?.mode || 'chat';
  
  const activeMode = MODES.find(m => m.id === currentModeId) || MODES[0];

  return (
    <div className="relative">
      {/* Tombol Pemicu Utama */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-transparent hover:bg-[var(--vscode-list-hoverBackground)] text-[11px] font-semibold text-[var(--vscode-foreground)] tracking-tight transition-colors outline-none border-none"
        title="Change AI Persona"
      >
        <span className="select-none text-[12px]">{activeMode.icon}</span>
        <span className="select-none capitalize">{activeMode.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-[var(--vscode-descriptionForeground)] transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Panel List Pilihan */}
      {isOpen && (
        <>
          {/* Backdrop Transparan */}
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          
          {/* Kotak Menu Opsi */}
          <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] shadow-2xl z-50 p-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  ipcSender?.saveSettings({ mode: mode.id });
                  setIsOpen(false);
                }}
                className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors ${
                  currentModeId === mode.id 
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' 
                    : 'hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
                }`}
              >
                <span className="text-[14px] mt-0.5 select-none">{mode.icon}</span>
                <div className="flex flex-col overflow-hidden w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[12px] font-bold truncate">{mode.name}</span>
                    {currentModeId === mode.id && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <span className={`text-[10px] truncate ${currentModeId === mode.id ? 'opacity-80' : 'text-[var(--vscode-descriptionForeground)]'}`}>
                    {mode.desc}
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