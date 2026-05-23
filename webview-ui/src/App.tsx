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

// API-compatible message format (without local-only fields)
interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
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

// ===== Helper Function to Convert Messages to API Format =====
const messagesToApiFormat = (messages: Message[]): ApiMessage[] => {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
};

// ===== App Component =====
const App: React.FC = () => {
  // ===== Navigation State =====
  const [currentPage, setCurrentPage] = useState<Page>('home');
  
  // ===== Chat State (Persisted Across Navigation) =====
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  
  // ===== Model Configuration =====
  const [selectedModel, setSelectedModel] = useState<string>('DeepSeek V4 Flash');
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

  // ===== CRITICAL FIX: Use refs to avoid stale closures =====
  const inputRef = useRef(input);
  const messagesRef = useRef(messages);
  const selectedModelRef = useRef(selectedModel);
  const proModeOptionRef = useRef(proModeOption);
  const activeAiModeRef = useRef(activeAiMode);

  // Keep refs in sync with state
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    proModeOptionRef.current = proModeOption;
  }, [proModeOption]);

  useEffect(() => {
    activeAiModeRef.current = activeAiMode;
  }, [activeAiMode]);

  // ===== VS Code Message Handler =====
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'onStreamChunk':
          setMessages(prev => {
            const newMessages = [...prev];
            let lastMsg = newMessages[newMessages.length - 1];
            
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
            
            if (streamingTimerRef.current !== null) {
              clearTimeout(streamingTimerRef.current);
              streamingTimerRef.current = null;
            }

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

            newMessages[newMessages.length - 1] = lastMsg;

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
          
        case 'setProModeOption':
          setProModeOption(message.proModeOption || 'thinking');
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
    
    return () => {
      window.removeEventListener('message', handleMessage);
      if (streamingTimerRef.current !== null) {
        clearTimeout(streamingTimerRef.current);
      }
    };
  }, []);

  // ===== FIXED: Send Handler using refs to avoid stale closures =====
  const handleSend = useCallback(() => {
    const currentInput = inputRef.current;
    const currentMessages = messagesRef.current;
    
    console.log('[App.tsx] handleSend called');
    console.log('[App.tsx] Current input:', currentInput);
    
    if (!currentInput.trim()) {
      console.log('[App.tsx] Input is empty, returning');
      return;
    }
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentInput,
      timestamp: Date.now(),
    };

    const updatedMessages = [...currentMessages, userMessage];
    
    // Update state
    setMessages(updatedMessages);
    setInput(''); // Clear input immediately
    
    const apiHistory = messagesToApiFormat(updatedMessages);
    
    console.log('[App.tsx] Sending to VS Code:', {
      messageCount: apiHistory.length,
      model: selectedModelRef.current,
      proMode: proModeOptionRef.current,
      mode: activeAiModeRef.current
    });
    
    // Send full conversation history with all configuration parameters
    vscode.postMessage({ 
      command: 'sendPrompt', 
      messages: apiHistory,
      model: selectedModelRef.current,
      proModeOption: proModeOptionRef.current,
      mode: activeAiModeRef.current
    });
    
  }, []); // Empty dependency array - uses refs for all dynamic values

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

  // Log on mount
  useEffect(() => {
    console.log('[App.tsx] Mounted');
    console.log('[App.tsx] handleSend type:', typeof handleSend);
  }, [handleSend]);

  // ===== Component Return =====
  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      {/* ===== Minimal Top Bar ===== */}
      <nav className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] select-none">
        {/* Left: Neuralis Brand */}
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

        {/* Right: Settings Icon */}
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
        {/* Home Page */}
        {currentPage === 'home' && (
          <div className="absolute inset-0 animate-fadeIn">
            <Home 
              onNewChat={handleNewChat}
              onViewHistory={handleNavigateHistory}
              recentHistory={sessions.slice(0, 4)}
            />
          </div>
        )}

        {/* Chat Page - Explicitly passing all props */}
        {currentPage === 'chat' && (
          <div className="absolute inset-0 animate-fadeIn">
            <Chat 
              messages={messages}
              input={input}
              setInput={setInput}
              handleSend={handleSend} // FIXED: Now this is a stable reference that always works
              onBack={() => setCurrentPage('home')}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              proModeOption={proModeOption}
              setProModeOption={setProModeOption}
              activeAiMode={activeAiMode}
              setActiveAiMode={setActiveAiMode}
              onAttachFile={handleAttachFile}
            />
          </div>
        )}

        {/* Settings Page */}
        {currentPage === 'settings' && (
          <div className="absolute inset-0 animate-fadeIn">
            <Settings onBack={handleNavigateHome} />
          </div>
        )}

        {/* History Page */}
        {currentPage === 'history' && (
          <div className="absolute inset-0 animate-fadeIn">
            <History 
              onBack={handleHistoryBack}
              onSessionSelect={handleSessionSelect}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        )}
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