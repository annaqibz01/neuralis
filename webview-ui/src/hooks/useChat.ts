// webview-ui/src/hooks/useChat.ts

/**
 * @fileoverview
 * Neuralis - Chat Interaction Custom Hook
 * 
 * This hook manages all chat-specific UI interactions including automatic
 * scrolling, file management, and workspace file integration.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExtensionCommand,
  ContextFile,
  SessionDetail,
  WebviewMessageSender,
} from '../contracts/webview.contracts';

interface UseChatOptions {
  session: SessionDetail | null;
  isStreaming: boolean;
  streamContent: string;
  streamReasoning: string;
  ipcSender: WebviewMessageSender | null;
}

interface UseChatReturn {
  messagesEndRef: React.RefObject<HTMLDivElement>;
  showFileDropdown: boolean;
  setShowFileDropdown: (show: boolean) => void;
  searchFileQuery: string;
  setSearchFileQuery: (query: string) => void;
  workspaceFiles: string[];
  filteredWorkspaceFiles: string[];
  attachedFiles: ContextFile[];
  addFileToAttachment: (filePath: string) => void;
  removeFileFromAttachment: (filePath: string) => void;
  scrollToBottom: () => void;
  handleFileSearch: (query: string) => void;
  handleRequestWorkspaceFiles: () => void;
}

export function useChat({
  session,
  isStreaming,
  streamContent,
  streamReasoning,
  ipcSender,
}: UseChatOptions): UseChatReturn {
  // ==========================================================================
  // REFS
  // ==========================================================================

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevStreamContentRef = useRef<string>('');
  const prevStreamReasoningRef = useRef<string>('');
  const prevMessagesLengthRef = useRef<number>(0);

  // ==========================================================================
  // STATE
  // ==========================================================================

  const [showFileDropdown, setShowFileDropdown] = useState<boolean>(false);
  const [searchFileQuery, setSearchFileQuery] = useState<string>('');
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<ContextFile[]>([]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const filteredWorkspaceFiles = workspaceFiles.filter(file =>
    file.toLowerCase().includes(searchFileQuery.toLowerCase())
  );

  // ==========================================================================
  // AUTOMATIC SCROLL TO BOTTOM
  // ==========================================================================

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Scroll when streaming content updates
  useEffect(() => {
    if (
      streamContent !== prevStreamContentRef.current ||
      streamReasoning !== prevStreamReasoningRef.current
    ) {
      scrollToBottom();
      prevStreamContentRef.current = streamContent;
      prevStreamReasoningRef.current = streamReasoning;
    }
  }, [streamContent, streamReasoning, scrollToBottom]);

  // Scroll when new messages arrive
  useEffect(() => {
    const messagesLength = session?.messages?.length || 0;
    if (messagesLength > prevMessagesLengthRef.current) {
      scrollToBottom();
      prevMessagesLengthRef.current = messagesLength;
    }
  }, [session?.messages?.length, scrollToBottom]);

  // Initial scroll on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // ==========================================================================
  // FILE MANAGEMENT
  // ==========================================================================

  const addFileToAttachment = useCallback((filePath: string) => {
    setAttachedFiles(prev => {
      // Prevent duplicate files
      if (prev.some(f => f.path === filePath)) {
        return prev;
      }
      return [...prev, { path: filePath, name: filePath.split('/').pop() || filePath }];
    });
  }, []);

  const removeFileFromAttachment = useCallback((filePath: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== filePath));
  }, []);

  const handleFileSearch = useCallback((query: string) => {
    setSearchFileQuery(query);
    if (query.length > 0 && ipcSender) {
      ipcSender.requestWorkspaceFiles();
    }
  }, [ipcSender]);

  const handleRequestWorkspaceFiles = useCallback(() => {
    if (ipcSender) {
      ipcSender.requestWorkspaceFiles();
    }
  }, [ipcSender]);

  // ==========================================================================
  // WORKSPACE FILE LISTENER
  // ==========================================================================

  useEffect(() => {
    if (!ipcSender) return;

    // Listen for workspace files response
    const cleanupWorkspaceFiles = (window as any).__VSCODE_API__?.onDidReceiveMessage?.(
      (message: any) => {
        if (message.command === ExtensionCommand.SEND_WORKSPACE_FILES) {
          setWorkspaceFiles(message.payload.files);
        }
        if (message.command === ExtensionCommand.SEND_FILE_CONTEXT) {
          const file = message.payload.file;
          setAttachedFiles(prev => {
            const existing = prev.find(f => f.path === file.path);
            if (existing) {
              return prev.map(f => f.path === file.path ? file : f);
            }
            return [...prev, file];
          });
        }
      }
    );

    return () => {
      if (cleanupWorkspaceFiles) {
        cleanupWorkspaceFiles();
      }
    };
  }, [ipcSender]);

  // ==========================================================================
  // CLEAR ATTACHMENTS ON NEW SESSION
  // ==========================================================================

  useEffect(() => {
    if (session?.id) {
      setAttachedFiles([]);
      setSearchFileQuery('');
      setShowFileDropdown(false);
    }
  }, [session?.id]);

  // ==========================================================================
  // RETURN VALUES
  // ==========================================================================

  return {
    messagesEndRef,
    showFileDropdown,
    setShowFileDropdown,
    searchFileQuery,
    setSearchFileQuery,
    workspaceFiles,
    filteredWorkspaceFiles,
    attachedFiles,
    addFileToAttachment,
    removeFileFromAttachment,
    scrollToBottom,
    handleFileSearch,
    handleRequestWorkspaceFiles,
  };
}

export default useChat;