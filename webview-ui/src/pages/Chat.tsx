/**
 * @fileoverview
 * Neuralis - Chat Controller (Modular, Anti-Layout Shift, with Gemini-like Ambient UI)
 * Features an interactive animated background for empty state,
 * absolute positioning layers, and integrated custom ModelDropdown.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { SessionDetail, AiSettings, WebviewMessageSender, RegisteredModel } from '../contracts/webview.contracts';
import { useChat } from '../hooks/useChat';
import UserBubble from '../components/Chat/UserBubble';
import AiBubble from '../components/Chat/AiBubble';
import ChatInput from '../components/Chat/ChatInput';
import { ModelDropdown } from '../components/Chat/ModelDropdown';
import { ErrorToast } from '../components/Chat/ErrorToast';
import { ModeDropdown } from '../components/Chat/ModeDropdown';

interface ChatProps {
  session: SessionDetail | null;
  aiSettings: AiSettings;
  registeredModels: RegisteredModel[];
  isStreaming: boolean;
  streamContent: string;
  streamReasoning: string;
  onSendMessage: (prompt: string, files?: any[], isReasoningActive?: boolean) => void;
  onCancelStream: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
  ipcSender: WebviewMessageSender | null;
  globalError?: string | null;
  clearGlobalError?: () => void;
}

const QUICK_PROMPTS = [
  { icon: '🔄', label: 'Refactor Code Block', description: 'Restructure and optimize selection', prompt: 'Refactor the following code to improve structural integrity:' },
  { icon: '🧪', label: 'Generate Unit Tests', description: 'Create comprehensive assertions', prompt: 'Generate comprehensive unit tests for the following code:' },
  { icon: '🗺️', label: 'Explain Ecosystem', description: 'Analyze architecture context', prompt: 'Explain the surrounding system ecosystem and logic of this code:' },
  { icon: '🐛', label: 'Debug Implementation', description: 'Trace logic and patch faults', prompt: 'Trace the logic execution here and identify potential faults:' },
];

const ReasoningBlock: React.FC<{ content: string; defaultExpanded?: boolean }> = ({ content, defaultExpanded = true }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  if (!content) return null;

  return (
    <div className="mb-3 mt-1 flex flex-col rounded-lg overflow-hidden border border-[var(--vscode-panel-border)] shadow-sm bg-[var(--vscode-editor-inactiveSelectionBackground)]/50 backdrop-blur-sm transition-all duration-300">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] opacity-70 group-hover:opacity-100 transition-opacity">🧠</span>
          <span className="text-[11px] font-semibold tracking-wide text-[var(--vscode-descriptionForeground)] group-hover:text-[var(--vscode-foreground)] transition-colors uppercase">
            DeepSeek Reasoning
          </span>
        </div>
        <span className={`text-[10px] text-[var(--vscode-descriptionForeground)] transform transition-transform duration-300 ${expanded ? 'rotate-180' : 'rotate-0'}`}>
          ▼
        </span>
      </button>
      
      <div className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-3 pt-1 text-[11px] text-[var(--vscode-textPreformat-foreground)] whitespace-pre-wrap font-mono leading-relaxed border-t border-[var(--vscode-panel-border)]/50 bg-[var(--vscode-editor-background)]/30 overflow-y-auto max-h-[350px] custom-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};

const ConversationFeed: React.FC<{
  messages: any[];
  isStreaming: boolean;
  streamContent: string;
  streamReasoning: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}> = ({ messages, isStreaming, streamContent, streamReasoning, messagesEndRef }) => {
  const displayMessages = useMemo(() => messages.filter(msg => msg.role !== 'system').sort((a, b) => a.timestamp - b.timestamp), [messages]);

  return (
    <div className="flex flex-col gap-4 px-3 py-4 max-w-4xl mx-auto w-full relative z-10">
      {displayMessages.map((message, index) => (
        <div key={message.id || index} className={`w-full flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          {message.role === 'user' ? (
            <div className="relative max-w-[90%] bg-gradient-to-br from-[var(--vscode-button-background)] to-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] px-4 py-2.5 rounded-xl rounded-tr-sm shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
              <UserBubble message={message} />
            </div>
          ) : (
            <div className="max-w-[98%] w-full">
              {message.thinkContent && <ReasoningBlock content={message.thinkContent} defaultExpanded={false} />}
              <div className="px-1">
                <AiBubble message={message} isStreaming={false} />
              </div>
            </div>
          )}
        </div>
      ))}

      {isStreaming && (
        <div className="self-start max-w-[98%] w-full animate-in fade-in duration-300">
          {streamReasoning && (
            <ReasoningBlock content={streamReasoning} defaultExpanded={true} />
          )}
          {streamContent ? (
            <div className="px-1 mt-2">
              <AiBubble streamContent={streamContent} isStreaming={true} />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 mt-2 w-fit bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded-full border border-[var(--vscode-panel-border)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-foreground)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-foreground)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-foreground)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>
      )}
      <div ref={messagesEndRef} className="h-40" />
    </div>
  );
};

const EmptyState: React.FC<{ onQuickPrompt: (prompt: string) => void }> = ({ onQuickPrompt }) => {
  const logoUri = (window as any).__NEURALIS_LOGO__;

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full px-4 pb-20 select-none">
      <div className="relative z-10 flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-6 flex items-center justify-center group cursor-default">
          <div className="absolute inset-0 bg-[var(--vscode-focusBorder)] blur-2xl opacity-20 group-hover:opacity-35 transition-opacity duration-700 rounded-full"></div>
          <div 
            style={{
              WebkitMaskImage: `url(${logoUri})`,
              maskImage: `url(${logoUri})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              backgroundColor: 'var(--vscode-editor-foreground)',
              width: '70px',
              height: '70px',
            }}
            className="transition-all duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100 relative z-10"
          />
        </div>
        
        <h2 className="text-xl font-semibold tracking-tight mb-2 text-[var(--vscode-editor-foreground)] text-center">
          Neuralis Workspace
        </h2>
        <p className="text-[12px] mb-8 text-[var(--vscode-descriptionForeground)] text-center max-w-[280px] leading-relaxed font-medium">
          Initialize the context engine by typing a query or selecting a predefined routine.
        </p>
        
        <div className="flex flex-col gap-2.5 w-full max-w-[320px] pointer-events-auto">
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onQuickPrompt(item.prompt + '\n\n')}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--vscode-panel-border)]/50 bg-[var(--vscode-editor-background)]/60 backdrop-blur-md hover:bg-[var(--vscode-editor-inactiveSelectionBackground)] hover:border-[var(--vscode-focusBorder)] hover:shadow-md transition-all duration-200 text-left group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--vscode-focusBorder)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="text-[16px] bg-[var(--vscode-editor-inactiveSelectionBackground)] p-1.5 rounded-md group-hover:scale-110 transition-transform shadow-sm relative z-10">{item.icon}</span>
              <div className="flex flex-col relative z-10 overflow-hidden">
                <span className="text-[12px] font-bold text-[var(--vscode-editor-foreground)] truncate">{item.label}</span>
                <span className="text-[11px] text-[var(--vscode-descriptionForeground)] truncate">{item.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Chat: React.FC<ChatProps> = ({ session, aiSettings, registeredModels, isStreaming, streamContent, streamReasoning, onSendMessage, onCancelStream, onNavigateToHistory, onNavigateToSettings, ipcSender, globalError, clearGlobalError }) => {
  const chat = useChat({ session, isStreaming, streamContent, streamReasoning, ipcSender });
  const [internalInput, setInternalInput] = useState('');

  useEffect(() => {
    if (session?.id) {
      setInternalInput(''); // 📄 KOSONGKAN teks input utama di UI seketika
      
      // Sinkronisasikan ulang ke textarea jika sudah terlanjur dirender di layar
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = '';
        textarea.style.height = 'auto'; // Reset tinggi textarea agar tidak melar
      }
    }
  }, [session?.id]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasMessages = session?.messages && session.messages.length > 0;
  const showAmbientBackground = !hasMessages && !isStreaming;

  
  const handleQuickPrompt = useCallback((prompt: string) => {
    setInternalInput(prompt);
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = prompt;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 50);
  }, []);

  return (
    <div className="relative w-full h-full bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] overflow-hidden">
      {/* 🛑 OVERLAY LAYAR SEMPIT (Hanya muncul jika lebar < 340px) 🛑 */}
      <div className="hidden max-[340px]:flex fixed inset-0 z-[9999] bg-[var(--vscode-editor-background)]/95 backdrop-blur-xl flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        
        {/* Ikon Resize (Panah Melebar) */}
        <div className="w-16 h-16 mb-4 rounded-full bg-[var(--vscode-editor-inactiveSelectionBackground)] flex items-center justify-center text-[var(--vscode-descriptionForeground)] border border-[var(--vscode-panel-border)] shadow-lg animate-pulse">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </div>

        <h2 className="text-[16px] font-bold text-[var(--vscode-editor-foreground)] mb-2 tracking-wide">
          Window Too Narrow
        </h2>
        
        <p className="text-[13px] leading-relaxed text-[var(--vscode-descriptionForeground)] max-w-[200px]">
          Please widen this panel to use the Neuralis Workspace comfortably.
        </p>
        
      </div>
      {/* ================= BACKGROUND FLUID (SEKARANG MENUTUPI SELURUH LAYAR) ================= */}
      {showAmbientBackground && (
        <>
          <style>{`
            @keyframes liquid-travel-1 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(40%, 30%) scale(1.3); }
              66% { transform: translate(-20%, 50%) scale(0.8); }
            }
            @keyframes liquid-travel-2 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(-40%, -40%) scale(1.4); }
              66% { transform: translate(-60%, 20%) scale(0.9); }
            }
            @keyframes liquid-travel-3 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50% { transform: translate(60%, -50%) scale(1.5); }
            }
            @keyframes liquid-travel-4 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50% { transform: translate(-50%, 40%) scale(0.7); }
            }
            .fluid-shape { position: absolute; border-radius: 50%; mix-blend-mode: screen; opacity: 0.45; }
            .fluid-1 { animation: liquid-travel-1 18s infinite ease-in-out; background: #007acc; width: 60vw; height: 60vw; top: -10%; left: -10%; }
            .fluid-2 { animation: liquid-travel-2 22s infinite ease-in-out; background: #8a2be2; width: 55vw; height: 55vw; bottom: -10%; right: -10%; }
            .fluid-3 { animation: liquid-travel-3 26s infinite ease-in-out; background: #00e5ff; width: 50vw; height: 50vw; top: 40%; left: 30%; }
            .fluid-4 { animation: liquid-travel-4 20s infinite ease-in-out; background: #ff00ff; width: 65vw; height: 65vw; bottom: 10%; left: -20%; }
          `}</style>
          
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
            <div className="absolute inset-0" style={{ filter: 'blur(80px) saturate(140%)' }}>
              <div className="fluid-shape fluid-1" />
              <div className="fluid-shape fluid-2" />
              <div className="fluid-shape fluid-3" />
              <div className="fluid-shape fluid-4" />
            </div>
          </div>
        </>
      )}
      {/* ==================================================================================== */}

      {/* HEADER FLOATING (Z-30) */}
      <header className="absolute top-3 left-0 right-0 z-30 px-3 pointer-events-none flex justify-center">
        <div className="pointer-events-auto flex items-center justify-between w-full max-w-4xl px-2.5 py-1.5 rounded-lg border border-[var(--vscode-panel-border)]/30 bg-[var(--vscode-foreground)]/[0.04] backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center w-5 h-5 rounded-md bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] text-[9px] font-bold ml-1 shadow-sm select-none">
              AI
            </div>
            <ModelDropdown 
            aiSettings={aiSettings} 
            registeredModels={registeredModels}
            ipcSender={ipcSender} 
            />
            <div className="w-[1px] h-3.5 bg-[var(--vscode-panel-border)] mx-0.5 opacity-50" />
            <ModeDropdown 
                 aiSettings={aiSettings} 
                 ipcSender={ipcSender} 
               />
          </div>

          <div className="flex items-center gap-0.5">
            {/* Tombol navigasi Anda */}
            {[
              { icon: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>, onClick: () => ipcSender?.createNewSession(), title: "New Session" },
              { icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, onClick: onNavigateToHistory, title: "History" },
              { icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>, onClick: onNavigateToSettings, title: "Settings" }
            ].map((btn, i) => (
              <button key={i} onClick={btn.onClick} className="p-1.5 rounded-md bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] transition-all duration-200" title={btn.title}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{btn.icon}</svg>
              </button>
            ))}
          </div>
        </div>
      </header>

      {globalError && (
        <ErrorToast 
          message={globalError} 
          onClose={() => {
            if(clearGlobalError) clearGlobalError();
          }}
          actionLabel="Buka Settings"
          onActionClick={onNavigateToSettings}
        />
      )}

      {/* KANVAS KONTEN (Z-10) */}
      <div className="absolute inset-0 z-10 overflow-y-auto scrollbar-hide pt-16">
        {hasMessages || isStreaming ? (
          <ConversationFeed messages={session?.messages || []} isStreaming={isStreaming} streamContent={streamContent} streamReasoning={streamReasoning} messagesEndRef={chat.messagesEndRef} />
        ) : (
          <EmptyState onQuickPrompt={handleQuickPrompt} />
        )}
      </div>

      {/* FOOTER INPUT MELAYANG (Z-30) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-4 pt-1 pointer-events-none">
        {hasMessages && (
          <div className="absolute top-[-40px] left-0 right-0 h-[40px] bg-gradient-to-t from-[var(--vscode-editor-background)] to-transparent pointer-events-none" />
        )}
        <div className="w-full max-w-2xl mx-auto rounded-[32px] shadow-[0_16px_50px_rgb(0,0,0,0.3)] border border-[var(--vscode-panel-border)]/80 bg-[var(--vscode-editor-background)]/95 backdrop-blur-3xl focus-within:border-[var(--vscode-focusBorder)] focus-within:ring-1 focus-within:ring-[var(--vscode-focusBorder)]/30 transition-all duration-300 pointer-events-auto">
          <ChatInput
            initialValue={internalInput}
            onSendMessage={(prompt, files, isReasoningActive) => {onSendMessage(prompt, files, isReasoningActive);}}
            isStreaming={isStreaming}
            attachedFiles={chat.attachedFiles}
            addFileToAttachment={chat.addFileToAttachment}
            removeFileFromAttachment={chat.removeFileFromAttachment}
            showFileDropdown={chat.showFileDropdown}
            setShowFileDropdown={chat.setShowFileDropdown}
            searchFileQuery={chat.searchFileQuery}
            setSearchFileQuery={chat.setSearchFileQuery}
            filteredWorkspaceFiles={chat.filteredWorkspaceFiles}
            handleFileSearch={chat.handleFileSearch}
            handleRequestWorkspaceFiles={chat.handleRequestWorkspaceFiles}
            ipcSender={ipcSender}
            textareaClass="min-h-[44px] max-h-[160px] resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;