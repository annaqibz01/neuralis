import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

// ===== Markdown Renderer Components =====
const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeString = (value || '').trim();

  if (!language && codeString.split('\n').length === 1 && codeString.length < 50) {
    return (
      <code className="px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-mono border bg-[var(--vscode-textBlockCode-background)] text-[var(--vscode-textBlockCode-foreground)] border-[var(--vscode-widget-border)]/20">
        {codeString}
      </code>
    );
  }

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-[var(--vscode-widget-border)]/20">
      {/* Code block header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--vscode-editor-background)]/80 border-b border-[var(--vscode-widget-border)]/10">
        <span className="text-xs font-mono opacity-60">{language || 'code'}</span>
        <button
  onClick={handleCopy}
  className="text-xs font-medium px-3 py-1 rounded-md transition-all font-sans
 bg-neutral-900 hover:bg-neutral-800 
 text-neutral-100 border border-neutral-700/50 
 shadow-sm active:scale-95 cursor-pointer opacity-0 group-hover:opacity-100"
>
  {copied ? '✓ Copied!' : 'Copy Code'}
</button>
      </div>

      {/* Syntax highlighted code */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1.25rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          background: 'var(--vscode-editor-background)',
        }}
        showLineNumbers={true}
        wrapLines={false}
        wrapLongLines={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded-md text-sm font-mono
    bg-[var(--vscode-textBlockQuote-background)]/50
    text-[var(--vscode-textPreformat-foreground)]
    border border-[var(--vscode-widget-border)]/20">
    {children}
  </code>
);

// ===== FIXED: Table Components with Proper Styling =====
const TableWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto my-4 max-w-full rounded-xl border border-zinc-700 overflow-hidden">
    <table className="min-w-full divide-y divide-zinc-700 text-left table-auto border-collapse whitespace-normal">
      {children}
    </table>
  </div>
);

const TableHead = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-zinc-800/80 font-semibold text-zinc-200">
    {children}
  </thead>
);

const TableHeadCell = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 border-b border-zinc-700 text-sm font-semibold whitespace-normal">
    {children}
  </th>
);

const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="divide-y divide-zinc-800 bg-zinc-900/30">
    {children}
  </tbody>
);

const TableRow = ({ children }: { children: React.ReactNode }) => (
  <tr className="even:bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
    {children}
  </tr>
);

const TableCell = ({ children }: { children: React.ReactNode }) => (
  <td className="px-4 py-3 text-sm text-zinc-300 font-normal whitespace-normal">
    {children}
  </td>
);

const MarkdownList = ({ ordered, children }: { ordered: boolean; children: React.ReactNode }) => (
  ordered ? 
    <ol className="list-decimal list-inside my-3 space-y-1.5 ml-4 marker:text-[var(--vscode-button-background)]/60">
      {children}
    </ol>
  :
    <ul className="list-disc list-inside my-3 space-y-1.5 ml-4 marker:text-[var(--vscode-button-background)]/60">
      {children}
    </ul>
);

const MarkdownListItem = ({ children }: { children: React.ReactNode }) => (
  <li className="text-sm leading-relaxed opacity-90">
    {children}
  </li>
);

const MarkdownParagraph = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm leading-relaxed mb-4 last:mb-0">
    {children}
  </p>
);

const MarkdownHeading = ({ level, children }: { level: number; children: React.ReactNode }) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const sizes = {
    1: 'text-xl font-bold mt-6 mb-4',
    2: 'text-lg font-semibold mt-5 mb-3',
    3: 'text-base font-semibold mt-4 mb-2',
    4: 'text-sm font-medium mt-3 mb-2',
    5: 'text-sm font-medium mt-2 mb-1',
    6: 'text-xs font-medium mt-2 mb-1',
  };
  
  return (
    <Tag className={`${sizes[level as keyof typeof sizes] || sizes[3]} text-[var(--vscode-foreground)]`}>
      {children}
    </Tag>
  );
};

const MarkdownLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a 
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[var(--vscode-button-background)] underline decoration-[var(--vscode-button-background)]/30 
      hover:decoration-[var(--vscode-button-background)]/70 transition-all"
  >
    {children}
  </a>
);

const MarkdownBlockquote = ({ children }: { children: React.ReactNode }) => (
  <blockquote className="my-4 pl-4 border-l-4 border-[var(--vscode-button-background)]/30 
    bg-[var(--vscode-textBlockQuote-background)]/30 rounded-r-lg py-2 pr-4">
    <div className="text-sm italic opacity-80">
      {children}
    </div>
  </blockquote>
);

const MarkdownThematicBreak = () => (
  <hr className="my-6 border-t border-[var(--vscode-widget-border)]/20" />
);

// ===== Think Content Component =====
const ThinkContentBlock = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="mt-3 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium opacity-50 hover:opacity-80 transition-opacity mb-2"
      >
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span>Thinking process {isExpanded ? '(hidden)' : '(expand)'}</span>
      </button>
      
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-[var(--vscode-editor-background)]/50 rounded-xl p-4 border border-[var(--vscode-widget-border)]/10">
          <div className="text-xs font-mono leading-relaxed opacity-70 whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== FIXED: Main Content Renderer with Table Components =====
const MarkdownContent = ({ content, thinkContent }: { content: string; thinkContent?: string }) => {
  return (
    <div className="markdown-content text-sm leading-relaxed">
      {/* Thinking/reasoning block */}
      {thinkContent && <ThinkContentBlock content={thinkContent} />}

      {/* Main markdown content with proper table rendering */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks remain unchanged
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');

            if (!inline && value) {
              return <CodeBlock language={language} value={value} />;
            }

            return <InlineCode>{children}</InlineCode>;
          },
          // FIXED: Table components with proper structure
          table({ children }) {
            return <TableWrapper>{children}</TableWrapper>;
          },
          thead({ children }) {
            return <TableHead>{children}</TableHead>;
          },
          tbody({ children }) {
            return <TableBody>{children}</TableBody>;
          },
          tr({ children }) {
            return <TableRow>{children}</TableRow>;
          },
          th({ children }) {
            return <TableHeadCell>{children}</TableHeadCell>;
          },
          td({ children }) {
            return <TableCell>{children}</TableCell>;
          },
          // Lists
          ul({ children }) {
            return <MarkdownList ordered={false}>{children}</MarkdownList>;
          },
          ol({ children }) {
            return <MarkdownList ordered={true}>{children}</MarkdownList>;
          },
          li({ children }) {
            return <MarkdownListItem>{children}</MarkdownListItem>;
          },
          // Text elements
          p({ children }) {
            return <MarkdownParagraph>{children}</MarkdownParagraph>;
          },
          h1({ children }) {
            return <MarkdownHeading level={1}>{children}</MarkdownHeading>;
          },
          h2({ children }) {
            return <MarkdownHeading level={2}>{children}</MarkdownHeading>;
          },
          h3({ children }) {
            return <MarkdownHeading level={3}>{children}</MarkdownHeading>;
          },
          h4({ children }) {
            return <MarkdownHeading level={4}>{children}</MarkdownHeading>;
          },
          h5({ children }) {
            return <MarkdownHeading level={5}>{children}</MarkdownHeading>;
          },
          h6({ children }) {
            return <MarkdownHeading level={6}>{children}</MarkdownHeading>;
          },
          a({ href, children }) {
            return <MarkdownLink href={href || '#'}>{children}</MarkdownLink>;
          },
          blockquote({ children }) {
            return <MarkdownBlockquote>{children}</MarkdownBlockquote>;
          },
          hr() {
            return <MarkdownThematicBreak />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// ===== Named Export Chat Component =====
export const Chat: React.FC<ChatProps> = ({
  messages = [],
  input = '',
  setInput,
  handleSend,
  onBack,
  selectedModel = 'DeepSeek V4 Flash',
  setSelectedModel,
  proModeOption = 'thinking',
  setProModeOption,
  activeAiMode = 'chat',
  setActiveAiMode,
  onAttachFile,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState('');

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<any[]>(messages);

  useEffect(() => {
    const savedSessions = localStorage.getItem('neuralis_sessions');
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) {
        setActiveSessionId(parsed[0].id);
        setLocalMessages(parsed[0].messages);
      }
    }
  }, []);
  
  const handleSessionSendMessage = (text: string) => {
    if (!text.trim()) return;

    let currentSessionId = activeSessionId;
    let updatedSessions = [...sessions];

    if (!currentSessionId) {
      currentSessionId = 'session_' + Date.now();
      const autoTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
      const newSession = {
        id: currentSessionId,
        title: autoTitle,
        messages: [],
        createdAt: Date.now()
      };

      updatedSessions = [newSession, ...updatedSessions];
      setActiveSessionId(currentSessionId);
    }

    setSessions(updatedSessions);
    localStorage.setItem('neuralis_sessions', JSON.stringify(updatedSessions));

    handleSend?.();
  };

  useEffect(() => {
    if (messages && messages.length > 0) {
      setLocalMessages(messages);
      if (activeSessionId) {
        setSessions(prev => {
          const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: messages } : s);
          localStorage.setItem('neuralis_sessions', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [messages, activeSessionId]);
  // Auto-scroll to bottom on new messages
  useEffect(() => {
  if (messagesEndRef.current) {
    // Kita gunakan setTimeout 0 agar browser selesai merender DOM baru 
    // sebelum animasi scroll dijalankan, ini rahasia biar enggak patah-patah!
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' // Memaksa posisi berhenti tepat di batas paling bawah elemen jangkar
      });
    }, 50); 
  }
}, [messages, currentStreamContent]);

  useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    switch (message.type) {
      case 'onStreamStart':
        setIsGenerating(true);
        setCurrentStreamContent('');
        break;
      case 'onStreamChunk':
        setIsGenerating(true);
        setCurrentStreamContent(prev => prev + (message.value || ''));
        break;
      case 'onStreamEnd': 
        setIsGenerating(false);
        setCurrentStreamContent('');
        break;
      case 'clearChat':
        setIsGenerating(false);
        setCurrentStreamContent('');
        break;
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);

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

  // Key handler with explicit call
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend?.();
    }
  };

  // Send click handler
  const onSendClick = () => {
    handleSend?.();
  };

  // Log the props on mount
  useEffect(() => {
    console.log('[Chat.tsx] Mounted with props:', { 
      handleSendType: typeof handleSend, 
      setInputType: typeof setInput,
      inputLength: input?.length,
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      
      {/* ===== Gemini-Style Minimal Header ===== */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--vscode-widget-border)]/50">
        {/* Left: Back Button + Model Selector */}
        <div className="flex items-center gap-2">
          {/* Back Button */}
          <button
            onClick={() => onBack?.()}
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
                    setSelectedModel?.('DeepSeek V4 Flash');
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
                    setSelectedModel?.('DeepSeek V4 Pro');
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
                          onClick={() => setProModeOption?.('thinking')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                            ${proModeOption === 'thinking'
                              ? 'bg-[var(--vscode-button-background)]/15 text-[var(--vscode-button-background)]'
                              : 'opacity-50 hover:opacity-80 hover:bg-[var(--vscode-list-hoverBackground)]'}`}
                        >
                          🧠 Thinking
                        </button>
                        <button
                          onClick={() => setProModeOption?.('non-thinking')}
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
      <div className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
          {(!messages || messages.length === 0) && (
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
                    onClick={() => setInput?.(suggestion.text)}
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
          {messages && messages.map((msg) => (
  <div 
    key={msg.id} 
    className={`flex gap-3 group w-full my-4 ${
      msg.role === 'user' ? 'justify-end flex-row-reverse text-right' : 'justify-start'
    }`}
  >
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
    <div className={`flex-1 min-w-0 max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
      {/* Sender Name */}
      <div className="text-xs font-medium mb-1.5 opacity-40">
        {msg.role === 'user' ? 'You' : 'Neuralis'}
      </div>
      
      {msg.role === 'user' ? (
        /* Premium User Chat Bubble on the Right */
        <div className="inline-block text-sm leading-relaxed opacity-90 whitespace-pre-wrap bg-[var(--vscode-button-background)]/10 border border-[var(--vscode-widget-border)]/20 px-4 py-2.5 rounded-2xl text-left">
          {msg.content}
        </div>
      ) : (
        /* Premium Assistant Chat Bubble on the Left */
        <div className="inline-block text-sm leading-relaxed opacity-90 border border-[var(--vscode-widget-border)]/20 px-4 py-2.5 rounded-2xl bg-[var(--vscode-editor-background)]/30 w-full text-left">
          <MarkdownContent content={msg.content} thinkContent={msg.thinkContent} />
        </div>
      )}

      {/* Global Copy Message Button */}
      <div className={`flex items-center mt-1.5 opacity-0 group-hover:opacity-60 transition-opacity gap-2 ${
        msg.role === 'user' ? 'justify-end' : 'justify-start'
      }`}>
        <button
  onClick={() => handleCopyMessage(msg.content)}
  className="text-[10px] flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all duration-200
    bg-transparent hover:bg-zinc-700/30
    text-zinc-400/60 hover:text-zinc-200
    border border-transparent hover:border-zinc-700/40
    active:scale-95 cursor-pointer"
  title="Copy entire message"
>
  <svg className="w-3 h-3 text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
  </svg>
  <span className="font-medium transition-colors duration-200">Copy</span>
</button>
      </div>
    </div>
  </div>
))}

{/* Pulsing Loading Indicator ("Neuralis is thinking...") */}
{isGenerating && !currentStreamContent && (
  <div className="flex gap-3 justify-start my-4 w-full">
    {/* AI Icon */}
    <div className="flex-shrink-0 mt-1">
      <div className="w-8 h-8 rounded-full bg-[var(--vscode-button-background)]/10 flex items-center justify-center">
        <NeuralisAiIcon />
      </div>
    </div>
    
    {/* Loading Bubble */}
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium mb-1.5 opacity-40">
        Neuralis
      </div>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--vscode-editor-background)]/50 border border-[var(--vscode-widget-border)]/10 max-w-xs">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--vscode-button-background)]/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-[var(--vscode-button-background)]/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-[var(--vscode-button-background)]/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs opacity-40 ml-1">Neuralis is thinking...</span>
      </div>
    </div>
  </div>
)}          
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
                <span>{AiModeConfig[activeAiMode]?.icon}</span>
                <span className="hidden sm:inline">{AiModeConfig[activeAiMode]?.label}</span>
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
                        setActiveAiMode?.(mode);
                        setIsModeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--vscode-list-hoverBackground)]
                        ${activeAiMode === mode ? 'bg-[var(--vscode-button-background)]/5 text-[var(--vscode-button-background)]' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{AiModeConfig[mode]?.icon}</span>
                        <span>{AiModeConfig[mode]?.label}</span>
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
              onChange={(e) => setInput?.(e.target.value)}
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
                onClick={() => onAttachFile?.()}
                className="p-2 rounded-lg opacity-40 hover:opacity-70 hover:bg-[var(--vscode-list-hoverBackground)] transition-all"
                title="Attach file"
              >
                <AttachIcon />
              </button>

              {/* Send Button */}
              <button
                onClick={onSendClick}
                disabled={!input?.trim()}
                className="p-2 rounded-lg transition-all duration-200
                  text-[var(--vscode-button-background)]
                  disabled:opacity-20 disabled:cursor-not-allowed
                  enabled:hover:bg-[var(--vscode-button-background)]/10
                  enabled:hover:scale-105 active:scale-95"
                title="Send message"
                id="send-button"
              >
                <SendIcon />
              </button>
            </div>
          </div>

          {/* Bottom Status */}
          <div className="flex items-center justify-center gap-2 mt-2 text-[10px] opacity-30">
            <span>{selectedModel}</span>
            <span>·</span>
            <span>{AiModeConfig[activeAiMode]?.icon} {AiModeConfig[activeAiMode]?.label}</span>
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