import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../components/ChatMessage';

// ===== Type Definitions =====
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkContent?: string;
}

type AiMode = 'chat' | 'planning' | 'agent' | 'coder';
type ProMode = 'thinking' | 'non-thinking';

interface ChatProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  handleSend: () => void;
  onBack: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  proModeOption: ProMode;
  setProModeOption: (option: ProMode) => void;
  activeAiMode: AiMode;
  setActiveAiMode: (mode: AiMode) => void;
  onAttachFile?: () => void;
}

// ===== Inline SVG Icons =====
const BackArrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const AttachIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

const DropdownArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z"/>
  </svg>
);

// ===== AI Mode Config =====
const aiModes: AiMode[] = ['chat', 'planning', 'agent', 'coder'];

const AiModeConfig: Record<AiMode, { icon: string; label: string }> = {
  chat: { icon: '💬', label: 'Chat' },
  planning: { icon: '🗺️', label: 'Plan' },
  agent: { icon: '🤖', label: 'Agent' },
  coder: { icon: '💻', label: 'Coder' },
};

// ===== Speaker Icons =====
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const NeuralisAiIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
    <circle cx="12" cy="12" r="10" stroke="var(--vscode-button-background)" strokeWidth="1.5" opacity="0.3"/>
    <circle cx="12" cy="12" r="6" fill="var(--vscode-button-background)" opacity="0.9"/>
    <path d="M12 8L12 16M8 12L16 12" stroke="var(--vscode-editor-background)" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

// ===== Named Export Chat Component =====
export const Chat: React.FC<ChatProps> = ({
  messages,
  input,
  setInput,
  handleSend,
  onBack,
  selectedModel,
  setSelectedModel,
  proModeOption,
  setProModeOption,
  activeAiMode,
  setActiveAiMode,
  onAttachFile,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setIsModelDropdownOpen(false);
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      
      {/* ===== Gemini-Style Minimal Header ===== */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--vscode-widget-border)]/50">
        {/* Left: Back Button + Model Selector */}
        <div className="flex items-center gap-2">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[var(--vscode-list-hoverBackground)] transition-colors opacity-50 hover:opacity-90"
            title="Back to Home"
          >
            <BackArrow />
          </button>

          {/* Gemini-Style Model Pill Selector */}
          <div className="relative dropdown-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsModelDropdownOpen(!isModelDropdownOpen);
                setIsModeDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                bg-[var(--vscode-dropdown-background)]/50
                hover:bg-[var(--vscode-dropdown-background)]
                border border-[var(--vscode-widget-border)]/30
                hover:border-[var(--vscode-widget-border)]
                transition-all duration-200"
            >
              <SparkleIcon />
              <span>{selectedModel === 'DeepSeek V4 Flash' ? 'Flash' : 'Pro'}</span>
              <DropdownArrow />
            </button>

            {/* Model Dropdown */}
            {isModelDropdownOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl shadow-2xl z-50 overflow-hidden
                bg-[var(--vscode-dropdown-background)]
                border border-[var(--vscode-widget-border)]/50
                backdrop-blur-xl">
                
                <button
                  onClick={() => {
                    setSelectedModel('DeepSeek V4 Flash');
                    setIsModelDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-[var(--vscode-list-hoverBackground)]
                    ${selectedModel === 'DeepSeek V4 Flash' ? 'bg-[var(--vscode-button-background)]/5' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⚡</span>
                    <div>
                      <div className="text-sm font-medium">DeepSeek V4 Flash</div>
                      <div className="text-[11px] opacity-50 mt-0.5">Fast responses for quick tasks</div>
                    </div>
                    {selectedModel === 'DeepSeek V4 Flash' && (
                      <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-button-background)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>

                <div className="border-t border-[var(--vscode-widget-border)]/30" />

                <button
                  onClick={() => {
                    setSelectedModel('DeepSeek V4 Pro');
                    setIsModelDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-[var(--vscode-list-hoverBackground)]
                    ${selectedModel === 'DeepSeek V4 Pro' ? 'bg-[var(--vscode-button-background)]/5' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🧠</span>
                    <div>
                      <div className="text-sm font-medium">DeepSeek V4 Pro</div>
                      <div className="text-[11px] opacity-50 mt-0.5">Advanced reasoning capabilities</div>
                    </div>
                    {selectedModel === 'DeepSeek V4 Pro' && (
                      <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-button-background)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>

                {/* Pro Mode Toggle (only visible when Pro is selected) */}
                {selectedModel === 'DeepSeek V4 Pro' && (
                  <>
                    <div className="border-t border-[var(--vscode-widget-border)]/30" />
                    <div className="px-4 py-3 space-y-2">
                      <div className="text-[11px] font-medium opacity-50 uppercase tracking-wider">Mode</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setProModeOption('thinking')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                            ${proModeOption === 'thinking'
                              ? 'bg-[var(--vscode-button-background)]/15 text-[var(--vscode-button-background)]'
                              : 'opacity-50 hover:opacity-80 hover:bg-[var(--vscode-list-hoverBackground)]'}`}
                        >
                          🧠 Thinking
                        </button>
                        <button
                          onClick={() => setProModeOption('non-thinking')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                            ${proModeOption === 'non-thinking'
                              ? 'bg-[var(--vscode-button-background)]/15 text-[var(--vscode-button-background)]'
                              : 'opacity-50 hover:opacity-80 hover:bg-[var(--vscode-list-hoverBackground)]'}`}
                        >
                          ⚡ Fast
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] opacity-40">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--vscode-button-background)] animate-pulse" />
          <span>Ready</span>
        </div>
      </div>

      {/* ===== Gemini-Style Chat Feed ===== */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              {/* Neuralis Logo */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-20 bg-[var(--vscode-button-background)]" />
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="30" stroke="var(--vscode-button-background)" strokeWidth="2" opacity="0.2"/>
                  <circle cx="32" cy="32" r="22" stroke="var(--vscode-button-background)" strokeWidth="2" opacity="0.4"/>
                  <circle cx="32" cy="32" r="14" fill="var(--vscode-button-background)" opacity="0.9"/>
                  <g stroke="var(--vscode-sideBar-background)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
                    <line x1="32" y1="22" x2="32" y2="42"/>
                    <line x1="22" y1="32" x2="42" y2="32"/>
                  </g>
                </svg>
              </div>

              <h2 className="text-xl font-semibold mb-2">What can I help you with?</h2>
              <p className="text-sm opacity-50 mb-8 max-w-md">
                I'm Neuralis, your AI coding companion. Ask me anything about code, debugging, or development.
              </p>

              {/* Quick Suggestions */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  { icon: '🔍', text: 'Explain this code' },
                  { icon: '🐛', text: 'Find bugs in my code' },
                  { icon: '⚡', text: 'Optimize performance' },
                  { icon: '📝', text: 'Write unit tests' },
                ].map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => setInput(suggestion.text)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm
                      border border-[var(--vscode-widget-border)]/30
                      hover:border-[var(--vscode-button-background)]/20
                      hover:bg-[var(--vscode-list-hoverBackground)]
                      transition-all duration-200 text-left"
                  >
                    <span>{suggestion.icon}</span>
                    <span>{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Feed */}
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3 group">
              {/* Speaker Icon */}
              <div className="flex-shrink-0 mt-1">
                {msg.role === 'user' ? (
                  <div className="w-8 h-8 rounded-full bg-[var(--vscode-button-background)]/10 flex items-center justify-center">
                    <UserIcon />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--vscode-button-background)]/10 flex items-center justify-center">
                    <NeuralisAiIcon />
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium mb-1.5 opacity-40">
                  {msg.role === 'user' ? 'You' : 'Neuralis'}
                </div>
                <ChatMessage
                  role={msg.role}
                  content={msg.content}
                  thinkContent={msg.thinkContent}
                />
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ===== Gemini-Style Input Area ===== */}
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          {/* Premium Input Container */}
          <div className="relative flex items-end gap-2 bg-[var(--vscode-input-background)]/80 
            backdrop-blur-sm border border-[var(--vscode-widget-border)]/50
            rounded-2xl px-3 py-2
            focus-within:border-[var(--vscode-button-background)]/30
            focus-within:shadow-[0_0_0_1px_var(--vscode-button-background)]/10
            transition-all duration-300">

            {/* Left: AI Mode Selector */}
            <div className="relative dropdown-container">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModeDropdownOpen(!isModeDropdownOpen);
                  setIsModelDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                  hover:bg-[var(--vscode-list-hoverBackground)]
                  transition-colors opacity-60 hover:opacity-90"
              >
                <span>{AiModeConfig[activeAiMode].icon}</span>
                <span className="hidden sm:inline">{AiModeConfig[activeAiMode].label}</span>
                <DropdownArrow />
              </button>

              {/* Mode Dropdown */}
              {isModeDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl shadow-2xl z-50 overflow-hidden
                  bg-[var(--vscode-dropdown-background)]
                  border border-[var(--vscode-widget-border)]/50
                  backdrop-blur-xl">
                  {aiModes.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setActiveAiMode(mode);
                        setIsModeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--vscode-list-hoverBackground)]
                        ${activeAiMode === mode ? 'bg-[var(--vscode-button-background)]/5 text-[var(--vscode-button-background)]' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{AiModeConfig[mode].icon}</span>
                        <span>{AiModeConfig[mode].label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-[var(--vscode-widget-border)]/30" />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Neuralis..."
              className="flex-1 bg-transparent resize-none min-h-[24px] max-h-[150px] py-1.5 px-1
                focus:outline-none focus:ring-0 text-sm leading-relaxed
                placeholder:text-[var(--vscode-input-placeholderForeground)]/50"
              rows={1}
            />

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Attach File */}
              <button
                onClick={onAttachFile}
                className="p-2 rounded-lg opacity-40 hover:opacity-70 hover:bg-[var(--vscode-list-hoverBackground)] transition-all"
                title="Attach file"
              >
                <AttachIcon />
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-lg transition-all duration-200
                  text-[var(--vscode-button-background)]
                  disabled:opacity-20 disabled:cursor-not-allowed
                  enabled:hover:bg-[var(--vscode-button-background)]/10
                  enabled:hover:scale-105 active:scale-95"
                title="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>

          {/* Bottom Status */}
          <div className="flex items-center justify-center gap-2 mt-2 text-[10px] opacity-30">
            <span>{selectedModel}</span>
            <span>·</span>
            <span>{AiModeConfig[activeAiMode].icon} {AiModeConfig[activeAiMode].label}</span>
            {selectedModel === 'DeepSeek V4 Pro' && (
              <>
                <span>·</span>
                <span>{proModeOption === 'thinking' ? '🧠 Thinking' : '⚡ Fast'}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Custom Scrollbar Styles =====
const style = document.createElement('style');
style.textContent = `
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: var(--vscode-scrollbarSlider-background);
    border-radius: 2px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: var(--vscode-scrollbarSlider-hoverBackground);
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;
document.head.appendChild(style);