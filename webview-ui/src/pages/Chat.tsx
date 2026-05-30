/**
 * @fileoverview
 * Neuralis - Chat Controller
 * * Adaptive interface resolving to either an empty state dashboard 
 * or an asymmetric conversational timeline. Features an autogrowing 
 * input footer and expandable DeepSeek reasoning blocks.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { SessionDetail, AiSettings, WebviewMessageSender } from '../contracts/webview.contracts';
import { useChat } from '../hooks/useChat';
import UserBubble from '../components/Chat/UserBubble';
import AiBubble from '../components/Chat/AiBubble';
import ChatInput from '../components/Chat/ChatInput';

interface ChatProps {
  session: SessionDetail | null;
  aiSettings: AiSettings;
  isStreaming: boolean;
  streamContent: string;
  streamReasoning: string;
  onSendMessage: (prompt: string, files?: any[]) => void;
  onCancelStream: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
  ipcSender: WebviewMessageSender | null;
}

const QUICK_PROMPTS = [
  { icon: '🔄', label: 'Refactor Code Block', description: 'Restructure and optimize selection', prompt: 'Refactor the following code to improve structural integrity:' },
  { icon: '🧪', label: 'Generate Unit Tests', description: 'Create comprehensive assertions', prompt: 'Generate comprehensive unit tests for the following code:' },
  { icon: '🗺️', label: 'Explain System Ecosystem', description: 'Analyze architecture context', prompt: 'Explain the surrounding system ecosystem and logic of this code:' },
  { icon: '🐛', label: 'Debug Implementation', description: 'Trace logic and patch faults', prompt: 'Trace the logic execution here and identify potential faults:' },
];

const ReasoningBlock: React.FC<{ content: string; defaultExpanded?: boolean }> = ({ content, defaultExpanded = true }) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  if (!content) return null;

  return (
    <div className="mb-2 mt-1 border-l-2 border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-inactiveSelectionBackground)] rounded-r-md overflow-hidden transition-all">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] font-medium text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
      >
        <span className={`transform transition-transform duration-200 ${expanded ? 'rotate-90' : 'rotate-0'}`}>
          ▶
        </span>
        DeepSeek Reasoning Process
      </button>
      {expanded && (
        <div className="px-3 pb-2 pt-1 text-[12px] italic text-[var(--vscode-editor-foreground)] opacity-80 whitespace-pre-wrap font-mono leading-relaxed">
          {content}
        </div>
      )}
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
    <div className="flex flex-col gap-4 px-4 py-6">
      {displayMessages.map((message, index) => (
        <div key={message.id || index} className="w-full flex flex-col">
          {message.role === 'user' ? (
            <div className="self-end max-w-[85%] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] px-4 py-2.5 rounded-2xl rounded-br-sm shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-transparent hover:border-[var(--vscode-focusBorder)] transition-colors">
              <UserBubble message={message} />
            </div>
          ) : (
            <div className="self-start max-w-[90%] w-full">
              {message.thinkContent && <ReasoningBlock content={message.thinkContent} defaultExpanded={false} />}
              <AiBubble message={message} isStreaming={false} />
            </div>
          )}
        </div>
      ))}

      {isStreaming && (
        <div className="self-start max-w-[90%] w-full animate-pulse">
          {(streamReasoning || !streamContent) && <ReasoningBlock content={streamReasoning || 'Analyzing system logic...'} defaultExpanded={true} />}
          {streamContent ? (
            <AiBubble streamContent={streamContent} isStreaming={true} />
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-3 text-[var(--vscode-descriptionForeground)]">
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-[bounce_1s_infinite_-0.3s]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-[bounce_1s_infinite_-0.15s]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-[bounce_1s_infinite]"></div>
            </div>
          )}
        </div>
      )}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};

const EmptyState: React.FC<{ onQuickPrompt: (prompt: string) => void }> = ({ onQuickPrompt }) => {
  const logoUri = (window as any).__NEURALIS_LOGO__;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-20 fade-in">
      <div className="mb-8 flex items-center justify-center">
        <div 
          style={{
            WebkitMaskImage: `url(${logoUri})`,
            maskImage: `url(${logoUri})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            backgroundColor: 'var(--vscode-editor-foreground)',
            width: '80px',
            height: '80px',
            opacity: 0.9
          }}
          className="transition-all duration-300 hover:opacity-100 select-none"
        />
      </div>
      <h2 className="text-xl font-medium tracking-tight mb-2 text-[var(--vscode-editor-foreground)]">
        How can I help you code today?
      </h2>
      <p className="text-[13px] mb-8 text-[var(--vscode-descriptionForeground)] text-center max-w-md">
        Engage the context engine by asking a direct question or selecting an architecture routine below.
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-[500px]">
        {QUICK_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onQuickPrompt(item.prompt + '\n\n')}
            className="flex flex-col items-start gap-1 p-3.5 rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-inactiveSelectionBackground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:border-[var(--vscode-focusBorder)] transition-all text-left group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px]">{item.icon}</span>
              <span className="text-[12px] font-semibold text-[var(--vscode-editor-foreground)]">{item.label}</span>
            </div>
            <span className="text-[11px] text-[var(--vscode-descriptionForeground)] line-clamp-1">{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const Chat: React.FC<ChatProps> = ({ session, aiSettings, isStreaming, streamContent, streamReasoning, onSendMessage, onCancelStream, onNavigateToHistory, onNavigateToSettings, ipcSender }) => {
  const logoUri = (window as any).__NEURALIS_LOGO__;
  const chat = useChat({ session, isStreaming, streamContent, streamReasoning, ipcSender });
  const [internalInput, setInternalInput] = useState('');
  
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

  const hasMessages = session?.messages && session.messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
      {/* INTEGRATED HEADER */}
      <header className={`flex items-center justify-between px-4 h-12 flex-shrink-0 transition-colors duration-300 ${hasMessages ? 'border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]' : 'bg-transparent'}`}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--vscode-descriptionForeground)]">Model:</span>
          <div className="relative w-36 h-7 flex items-center">
            <select
              value={aiSettings?.model || 'deepseek-v4-flash'}
              onChange={(e) => {
                const selectedModel = e.target.value as any;
                ipcSender?.saveSettings({ model: selectedModel });
              }}
              className="w-full appearance-none pr-8 bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] border border-[var(--vscode-dropdown-border)] rounded pl-2 py-1 text-[11px] font-mono font-semibold cursor-pointer outline-none focus:border-[var(--vscode-focusBorder)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
            >
              <option 
                value="deepseek-v4-pro"
                className="bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] font-mono py-1"
              >
                DEEPSEEK PRO
              </option>
              <option 
                value="deepseek-v4-fast"
                className="bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] font-mono py-1"
              >
                DEEPSEEK FLASH
              </option>
            </select>
            <div className="absolute right-2 pointer-events-none flex items-center justify-center text-[var(--vscode-dropdown-foreground)] opacity-70">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => ipcSender?.createNewSession()} className="p-1.5 rounded-md text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)] transition-colors" title="New Chat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button onClick={onNavigateToHistory} className="p-1.5 rounded-md text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)] transition-colors" title="Session History">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button onClick={onNavigateToSettings} className="p-1.5 rounded-md text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)] transition-colors" title="Engine Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      {/* CONTINGENT CONTENT CANVAS */}
      <div className="flex-1 overflow-y-auto relative scrollbar-hide">
        {hasMessages || isStreaming ? (
          <ConversationFeed 
            messages={session?.messages || []} 
            isStreaming={isStreaming} 
            streamContent={streamContent} 
            streamReasoning={streamReasoning} 
            messagesEndRef={chat.messagesEndRef} 
          />
        ) : (
          <EmptyState onQuickPrompt={handleQuickPrompt} />
        )}
      </div>

      {/* FLOATING COMPACT FOOTER */}
      <div className="relative px-4 pb-4 pt-2 shrink-0">
        <div className="absolute top-[-30px] left-0 right-0 h-[30px] bg-gradient-to-t from-[var(--vscode-editor-background)] to-transparent pointer-events-none" />
        <div className="w-full max-w-3xl mx-auto rounded-2xl shadow-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] focus-within:border-[var(--vscode-focusBorder)] transition-colors duration-200">
          <ChatInput
            initialValue={internalInput}
            onSendMessage={(msg, files) => { setInternalInput(''); onSendMessage(msg, files); }}
            onCancelStream={onCancelStream}
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
            textareaClass="min-h-[44px] max-h-[140px] resize-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;