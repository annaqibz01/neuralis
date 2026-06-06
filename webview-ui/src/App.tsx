/**
 * @fileoverview
 * Neuralis - Frontend Application Shell
 * * Enforces an absolute viewport lock with contextual overlay routing.
 * Maintains stable reactive boundaries for the IPC state loop.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IpcManager,
  ExtensionCommand,
  WebviewCommand,
  AiSettings,
  SessionMetadata,
  SessionDetail,
  RegisteredModel
} from './contracts/webview.contracts';
import Chat from './pages/Chat';
import History from './pages/History';
import Settings from './pages/Settings';

type PageType = 'chat' | 'history' | 'settings';

interface AppState {
  currentPage: PageType;
  sessions: SessionMetadata[];
  currentSession: SessionDetail | null;
  aiSettings: AiSettings;
  models: RegisteredModel[];
  isStreaming: boolean;
  streamContent: string;
  streamReasoning: string;
  error: string | null;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  model: 'deepseek-v4-flash',
  proOption: 'fast',
  mode: 'chat',
};

const MOCK_VSCODE_API = {
  postMessage: (message: any) => {
    console.log('[Mock VSCODE API] Post message:', message);
  },
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentPage: 'chat',
    sessions: [],
    currentSession: null,
    aiSettings: DEFAULT_AI_SETTINGS,
    models: [],
    isStreaming: false,
    streamContent: '',
    streamReasoning: '',
    error: null,
  });

  const ipcManagerRef = useRef<IpcManager | null>(null);
  const stateRef = useRef<AppState>(state);
  const isStreamingRef = useRef<boolean>(false);

  useEffect(() => {
    stateRef.current = state;
    isStreamingRef.current = state.isStreaming;
  }, [state]);

  const updateState = useCallback((partial: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const clearStreamState = useCallback(() => {
    updateState({
      streamContent: '',
      streamReasoning: '',
    });
  }, [updateState]);

  useEffect(() => {
    let isMounted = true;

    const initializeIpc = async () => {
      try {
        const vscodeApi = (window as any).__VSCODE_API__ || MOCK_VSCODE_API;
        const ipcManager = new IpcManager(vscodeApi);
        ipcManagerRef.current = ipcManager;

        ipcManager.receiver.on(
          ExtensionCommand.SEND_SESSION_DETAIL,
          (payload: { session: SessionDetail }) => {
            if (!isMounted) return;
            
            // ✅ KONSOLIDASI: Gabungkan semua mutasi menjadi satu objek tunggal agar render berjalan Atomic
            setState(prev => ({
              ...prev,
              streamContent: '',
              streamReasoning: '',
              currentSession: payload.session,
              currentPage: 'chat',
              error: null,
            }));
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.SEND_SESSION_LIST,
          (payload: { sessions: SessionMetadata[] }) => {
            if (!isMounted) return;
            updateState({ sessions: payload.sessions });
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.SEND_SETTINGS,
          (payload: { settings: AiSettings; hasApiKey: boolean }) => {
            if (!isMounted) return;
            updateState({ aiSettings: payload.settings });
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.SEND_SESSION_DETAIL,
          (payload: { session: SessionDetail }) => {
            if (!isMounted) return;
            clearStreamState();
            updateState({
              currentSession: payload.session,
              currentPage: 'chat',
              error: null,
            });
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.STREAM_START,
          () => {
            if (!isMounted) return;
            clearStreamState();
            updateState({
              isStreaming: true,
              error: null,
            });
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.STREAM_CHUNK,
          (payload: { content?: string; reasoningContent?: string }) => {
            if (!isMounted) return;
            const updates: Partial<AppState> = {};
            if (payload.content) {
              updates.streamContent = stateRef.current.streamContent + payload.content;
            }
            if (payload.reasoningContent) {
              updates.streamReasoning = stateRef.current.streamReasoning + payload.reasoningContent;
            }
            if (Object.keys(updates).length > 0) {
              updateState(updates);
            }
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.STREAM_END,
          () => {
            if (!isMounted) return;
            clearStreamState();
            updateState({ isStreaming: false });
            const currentSession = stateRef.current.currentSession;
            if (currentSession) {
              ipcManager.sender.requestSessionById(currentSession.id);
            }
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.SHOW_ERROR,
          (payload: { message: string; code?: string }) => {
            if (!isMounted) return;
            updateState({
              error: payload.message,
              isStreaming: false,
            });
          }
        );

        ipcManager.receiver.on(
          ExtensionCommand.SEND_MODEL_LIST,
          (payload: { models: RegisteredModel[] }) => {
            if (!isMounted) return;
            updateState({ models: payload.models });
          }
        );

        ipcManager.initialize();
        ipcManager.sender.notifyReady();
        ipcManager.sender.send(WebviewCommand.REQUEST_MODEL_LIST, undefined as any);
      } catch (error) {
        console.error('[App] Failed to initialize IPC:', error);
        if (isMounted) {
          updateState({
            error: `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    };

    initializeIpc();

    return () => {
      isMounted = false;
      if (ipcManagerRef.current) {
        ipcManagerRef.current.dispose();
        ipcManagerRef.current = null;
      }
    };
  }, [updateState, clearStreamState]);

  const navigateTo = useCallback((page: PageType) => {
    updateState({ currentPage: page, error: null });
  }, [updateState]);

  const handleCancelStream = useCallback(() => {
    const currentIpc = ipcManagerRef.current; 
    if (currentIpc && currentIpc.sender) {
      currentIpc.sender.cancelStream();
    } else {
      // Fallback darurat jika object sender kehilangan binding
      console.warn('[App] Sender stale, firing direct postMessage fallback');
      const vscodeApi = (window as any).__VSCODE_API__ || MOCK_VSCODE_API;
      vscodeApi.postMessage({ command: 'CANCEL_STREAM', payload: undefined });
    }
  }, []);

  const dismissError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const renderActivePage = () => {
    const sender = ipcManagerRef.current?.sender;
    
    if (!sender) {
      return (
        <div className="flex items-center justify-center h-full bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
          <div className="w-6 h-6 border-2 border-[var(--vscode-textLink-foreground)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    switch (state.currentPage) {
      case 'chat':
        return (
          <Chat
            key={state.currentSession?.id || 'new-chat'}
            session={state.currentSession}
            aiSettings={state.aiSettings}
            registeredModels={state.models}
            isStreaming={state.isStreaming}
            streamContent={state.streamContent}
            streamReasoning={state.streamReasoning}
            globalError={state.error}
            clearGlobalError={dismissError}
            onSendMessage={(prompt, files, isReasoningActive) => {const updatedSettings = {...state.aiSettings,proOption: (isReasoningActive ? 'thinking' : 'fast') as 'fast' | 'thinking'};sender.sendMessage(prompt, updatedSettings, files);}}
            onCancelStream={handleCancelStream}
            onNavigateToHistory={() => navigateTo('history')}
            onNavigateToSettings={() => navigateTo('settings')}
            ipcSender={sender}
          />
        );
      case 'history':
        return (
          <History
            sessions={state.sessions}
            currentSessionId={state.currentSession?.id}
            onSelectSession={(sessionId) => sender.requestSessionById(sessionId)}
            onCreateNewSession={() => sender.createNewSession()}
            onDeleteSession={(sessionId) => sender.deleteSession(sessionId)}
            onNavigateToChat={() => navigateTo('chat')}
            onNavigateToSettings={() => navigateTo('settings')}
            ipcSender={sender}
          />
        );
      case 'settings':
        return (
          <Settings
            aiSettings={state.aiSettings}
            registeredModels={state.models} // <-- Oper data dari backend ke UI
            onSaveSettings={(settings) => sender.saveSettings(settings)}
            onNavigateToChat={() => navigateTo('chat')}
            onNavigateToHistory={() => navigateTo('history')}
            ipcSender={sender}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
      <main className="flex-1 w-full h-full relative overflow-hidden">
        {renderActivePage()}
      </main>
    </div>
  );
};

export default App;