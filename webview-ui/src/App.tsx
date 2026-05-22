import React, { useState, useEffect, useCallback, useRef } from 'react';
import Home from './pages/Home';
import { Chat } from './pages/Chat';
import Settings from './pages/Settings';
import History from './pages/History';

// VS Code API bridge
// @ts-ignore
const vscode = acquireVsCodeApi();

// ===== Type Definitions =====
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkContent?: string;
  timestamp?: number;
}

interface Session {
  id: string;
  title: string;
  timestamp: string;
  aiMode?: AiMode;
}

type Page = 'home' | 'chat' | 'settings' | 'history';
type AiMode = 'chat' | 'planning' | 'agent' | 'coder';
type ProMode = 'thinking' | 'non-thinking';
type ModelOption = 'DeepSeek V4 Flash' | 'DeepSeek V4 Pro';

// ===== Inline SVG Icons =====
const NeuralisLogo = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
    <circle cx="10" cy="10" r="5" fill="currentColor" opacity="0.9"/>
    <path d="M10 6L10 14M6 10L14 10" stroke="var(--vscode-editor-background)" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const SettingsGear = () => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ===== App Component =====
const App: React.FC = () => {
  // ===== Navigation State =====
  const [currentPage, setCurrentPage] = useState<Page>('home');
  
  // ===== Chat State (Persisted Across Navigation) =====
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  
  // ===== Model Configuration (Persisted Across Navigation) =====
  const [selectedModel, setSelectedModel] = useState<ModelOption>('DeepSeek V4 Flash');
  const [proModeOption, setProModeOption] = useState<ProMode>('thinking');
  const [activeAiMode, setActiveAiMode] = useState<AiMode>('chat');
  
  // ===== Session Management =====
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', title: 'Implementing authentication flow', timestamp: '2 hrs ago', aiMode: 'chat' },
    { id: '2', title: 'Debugging API response issues', timestamp: '5 hrs ago', aiMode: 'coder' },
    { id: '3', title: 'Database schema optimization', timestamp: 'Yesterday', aiMode: 'planning' },
    { id: '4', title: 'React component refactoring', timestamp: 'Yesterday', aiMode: 'agent' },
    { id: '5', title: 'CSS grid layout solution', timestamp: '2 days ago', aiMode: 'chat' },
  ]);
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // ===== Refs =====
  const streamingMessageRef = useRef<string | null>(null);
  const streamingTimerRef = useRef<number | null>(null);

  // ===== VS Code Message Handler =====
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'onStreamChunk':
          setMessages(prev => {
            // Create a shallow copy to avoid direct mutation
            const newMessages = [...prev];
            let lastMsg = newMessages[newMessages.length - 1];
            
            // Check if we need to create a new assistant message
            if (!lastMsg || lastMsg.role === 'user') {
              const newId = `assistant-${Date.now()}`;
              streamingMessageRef.current = newId;
              
              lastMsg = { 
                id: newId, 
                role: 'assistant', 
                content: '', 
                thinkContent: '',
                timestamp: Date.now()
              };
              newMessages.push(lastMsg);
            }
            
            // Clear any pending streaming timer
            if (streamingTimerRef.current !== null) {
              clearTimeout(streamingTimerRef.current);
              streamingTimerRef.current = null;
            }

            // Route content to correct field
            if (message.isReasoning) {
              lastMsg = {
                ...lastMsg,
                thinkContent: (lastMsg.thinkContent || '') + (message.value || '')
              };
            } else {
              lastMsg = {
                ...lastMsg,
                content: (lastMsg.content || '') + (message.value || '')
              };
            }

            // Update the last message
            newMessages[newMessages.length - 1] = lastMsg;

            // Set a timer to prevent rapid re-renders
            streamingTimerRef.current = window.setTimeout(() => {
              streamingTimerRef.current = null;
            }, 100);

            return newMessages;
          });
          break;

        case 'onStreamComplete':
          streamingMessageRef.current = null;
          if (streamingTimerRef.current !== null) {
            clearTimeout(streamingTimerRef.current);
            streamingTimerRef.current = null;
          }
          break;

        case 'clearChat':
          setMessages([]);
          setInput('');
          streamingMessageRef.current = null;
          break;

        case 'setInput':
          setInput(message.text || '');
          break;
          
        case 'setSelectedModel':
          setSelectedModel(message.model || 'DeepSeek V4 Flash');
          break;
          
        case 'setProMode':
          setProModeOption(message.mode || 'thinking');
          break;
          
        case 'setAiMode':
          setActiveAiMode(message.mode || 'chat');
          break;

        case 'loadSession':
          if (message.session && Array.isArray(message.session.messages)) {
            setMessages(message.session.messages);
            setActiveSessionId(message.session.id);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup function to remove listener and clear timers
    return () => {
      window.removeEventListener('message', handleMessage);
      if (streamingTimerRef.current !== null) {
        clearTimeout(streamingTimerRef.current);
      }
    };
  }, []); // Empty dependency array - this effect should only run once

  // ===== Send Handler =====
  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    vscode.postMessage({ 
      command: 'sendPrompt', 
      text: input,
      model: selectedModel,
      proMode: proModeOption,
      aiMode: activeAiMode
    });
    setInput('');
  }, [input, selectedModel, proModeOption, activeAiMode]);

  // ===== Navigation Handlers =====
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput('');
    streamingMessageRef.current = null;
    setActiveSessionId(null);
    setCurrentPage('chat');
    vscode.postMessage({ command: 'newChat' });
  }, []);

  const handleNavigateHome = useCallback(() => {
    setCurrentPage('home');
  }, []);

  const handleNavigateSettings = useCallback(() => {
    setCurrentPage('settings');
  }, []);

  const handleNavigateHistory = useCallback(() => {
    setCurrentPage('history');
  }, []);

  const handleAttachFile = useCallback(() => {
    vscode.postMessage({ command: 'attachFile' });
  }, []);

  // ===== Session Handlers =====
  const handleSessionSelect = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    vscode.postMessage({ command: 'loadSession', sessionId });
    setCurrentPage('chat');
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    vscode.postMessage({ command: 'deleteSession', sessionId });
  }, []);

  const handleHistoryBack = useCallback(() => {
    setCurrentPage('home');
  }, []);

  // ===== Page Renderer =====
  const renderPage = () => {
    const recentSessions = sessions.slice(0, 4);

    switch (currentPage) {
      case 'home':
        return (
          <Home 
            onNewChat={handleNewChat}
            onViewHistory={handleNavigateHistory}
            recentHistory={recentSessions}
          />
        );

      case 'chat':
        return (
          <Chat 
            messages={messages}
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            onBack={handleNavigateHome}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            proModeOption={proModeOption}
            setProModeOption={setProModeOption}
            activeAiMode={activeAiMode}
            setActiveAiMode={setActiveAiMode}
            onAttachFile={handleAttachFile}
          />
        );

      case 'settings':
        return <Settings />;

      case 'history':
        return (
          <History 
            onBack={handleHistoryBack}
            onSessionSelect={handleSessionSelect}
            onDeleteSession={handleDeleteSession}
          />
        );

      default:
        return (
          <Home 
            onNewChat={handleNewChat}
            onViewHistory={handleNavigateHistory}
            recentHistory={recentSessions}
          />
        );
    }
  };

  // ===== Component Return =====
  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      {/* ===== Ultra-Minimalist Top Bar ===== */}
      <nav className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] select-none">
        {/* Left: Neuralis Brand (Clickable Home) */}
        <button
          onClick={handleNavigateHome}
          className="flex items-center gap-2 group transition-opacity duration-200 hover:opacity-80 focus:outline-none"
          title="Go to Home"
        >
          <span className="text-[var(--vscode-button-background)] group-hover:scale-105 transition-transform duration-200">
            <NeuralisLogo />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--vscode-foreground)] opacity-80 group-hover:opacity-100 transition-opacity">
            Neuralis
          </span>
        </button>

        {/* Right: Isolated Settings Icon */}
        <button
          onClick={handleNavigateSettings}
          className={`
            p-1.5 rounded-md transition-all duration-300 ease-in-out
            ${currentPage === 'settings' 
              ? 'text-[var(--vscode-button-background)] bg-[var(--vscode-button-background)]/10 rotate-45' 
              : 'text-[var(--vscode-foreground)] opacity-40 hover:opacity-80 hover:bg-[var(--vscode-list-hoverBackground)] hover:rotate-45'
            }
            focus:outline-none focus:ring-1 focus:ring-[var(--vscode-button-background)]/30
            active:scale-90
          `}
          title="Settings"
        >
          <SettingsGear />
        </button>
      </nav>

      {/* ===== Main Content Area ===== */}
      <main className="flex-1 overflow-hidden relative">
        <div 
          key={currentPage}
          className="absolute inset-0 animate-fadeIn"
        >
          {renderPage()}
        </div>
      </main>
    </div>
  );
};

// ===== Page Transition Animation =====
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fadeIn {
    animation: fadeIn 0.15s ease-out;
  }
`;
document.head.appendChild(style);

export default App;