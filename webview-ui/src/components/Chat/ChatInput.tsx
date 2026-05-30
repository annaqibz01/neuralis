// webview-ui/src/components/Chat/ChatInput.tsx

/**
 * @fileoverview
 * Neuralis - Chat Input Component
 * 
 * Features auto-adjusting textarea, file attachment management,
 * workspace file search, and keyboard shortcuts for message submission.
 * Fully styled with Tailwind CSS using VS Code theme variables.
 */

import React, { useRef, useEffect } from 'react';
import { ContextFile } from '../../contracts/webview.contracts';

interface ChatInputProps {
  initialValue: string;
  onSendMessage: (content: string, files: ContextFile[]) => void;
  onCancelStream: () => void;
  isStreaming: boolean;
  attachedFiles: ContextFile[];
  addFileToAttachment: (file: string) => void;
  removeFileFromAttachment: (path: string) => void;
  showFileDropdown: boolean;
  setShowFileDropdown: (show: boolean) => void;
  searchFileQuery: string;
  setSearchFileQuery: (query: string) => void;
  filteredWorkspaceFiles: string[];
  handleFileSearch: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleRequestWorkspaceFiles: () => void;
  ipcSender: any;
  textareaClass?: string;
}

const ChatInput: React.FC<ChatInputProps> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto sync text dari Quick Prompts ke dalam Textarea internal
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = props.initialValue;
      adjustHeight();
    }
  }, [props.initialValue]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = textareaRef.current?.value || '';
      if (!content.trim() && props.attachedFiles.length === 0) return;
      
      props.onSendMessage(content, props.attachedFiles);
      if (textareaRef.current) textareaRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col w-full p-2 relative">
      {/* File Attachment Pills Row */}
      {props.attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-2 pb-2 border-b border-[var(--vscode-panel-border)] mb-2">
          {props.attachedFiles.map((file) => (
            <div key={file.path} className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] border border-[var(--vscode-panel-border)] text-[11px] font-mono">
              <span className="opacity-70">📄</span>
              <span className="text-[var(--vscode-editor-foreground)] truncate max-w-[120px]">{file.name}</span>
              <button 
                onClick={() => props.removeFileFromAttachment(file.path)}
                className="w-4 h-4 rounded hover:bg-[var(--vscode-list-hoverBackground)] flex items-center justify-center text-[10px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Form Box */}
      <div className="flex items-end w-full relative">
        <textarea
          ref={textareaRef}
          onKeyDown={handleKeyDown}
          onChange={(e) => { adjustHeight(); props.handleFileSearch(e); }}
          placeholder="Ask Neuralis or type @ to attach context..."
          className="w-full outline-none bg-transparent resize-none py-2.5 pl-3 pr-10 text-[13px] leading-relaxed text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] min-h-[40px]"
          rows={1}
        />
        
        {/* Action Button Right */}
        <div className="absolute right-2 bottom-1.5 flex items-center">
          {props.isStreaming ? (
            <button onClick={props.onCancelStream} className="p-1.5 rounded-lg bg-[var(--vscode-testing-iconFailed)] text-white hover:opacity-90 transition-opacity" title="Stop Generation">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            </button>
          ) : (
            <button 
              onClick={() => {
                const content = textareaRef.current?.value || '';
                if (content.trim() || props.attachedFiles.length > 0) {
                  props.onSendMessage(content, props.attachedFiles);
                  if (textareaRef.current) textareaRef.current.value = '';
                }
              }}
              className="p-1.5 rounded-lg text-[var(--vscode-textLink-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Context File Dropdown Portal */}
      {props.showFileDropdown && props.filteredWorkspaceFiles.length > 0 && (
        <div className="absolute bottom-[100%] left-2 right-2 max-h-[180px] overflow-y-auto z-50 rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)] shadow-2xl p-1 flex flex-col gap-0.5">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)] mb-1">
            Workspace Files Context
          </div>
          {props.filteredWorkspaceFiles.slice(0, 20).map((filePath) => (
            <button
              key={filePath}
              onClick={() => {
                props.addFileToAttachment(filePath);
                props.setShowFileDropdown(false);
                if (textareaRef.current) {
                  // Bersihkan karakter '@' terakhir dari textarea
                  textareaRef.current.value = textareaRef.current.value.replace(/@\S*$/, '');
                  textareaRef.current.focus();
                }
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--vscode-list-hoverBackground)] flex flex-col gap-0.5 group"
            >
              <span className="text-[12px] text-[var(--vscode-editor-foreground)] truncate font-medium">{filePath.split('/').pop()}</span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)] truncate font-mono">{filePath}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatInput;