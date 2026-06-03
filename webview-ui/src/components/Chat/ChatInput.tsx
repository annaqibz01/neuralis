// webview-ui/src/components/Chat/ChatInput.tsx

import React, { useRef, useEffect, useState } from 'react';
import { ContextFile } from '../../contracts/webview.contracts';

interface ChatInputProps {
  initialValue: string;
  onSendMessage: (content: string, files: ContextFile[], isReasoning: boolean) => void;
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
  const [isReasoning, setIsReasoning] = useState<boolean>(false);

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
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = textareaRef.current?.value || '';
      if (!content.trim() && props.attachedFiles.length === 0) return;
      
      props.onSendMessage(content, props.attachedFiles, isReasoning);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        adjustHeight();
      }
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      
      {/* 🛠️ CSS MAGIC: Scrollbar Mengambang ala macOS 🛠️ */}
      <style>{`
        .island-textarea {
          scrollbar-width: thin;
          scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
        }
        .island-textarea::-webkit-scrollbar {
          width: 14px !important; /* Area klik lebih lebar agar mudah ditarik */
        }
        .island-textarea::-webkit-scrollbar-track {
          background: transparent !important; /* Paksa hapus background hitam jelek */
        }
        .island-textarea::-webkit-scrollbar-thumb {
          background-color: var(--vscode-scrollbarSlider-background) !important;
          border-radius: 20px !important;
          /* Trik padding-box membuat scrollbar tampak langsing dan mengambang di tengah */
          border: 4px solid transparent !important; 
          background-clip: padding-box !important;
        }
        .island-textarea::-webkit-scrollbar-thumb:hover {
          background-color: var(--vscode-scrollbarSlider-hoverBackground) !important;
        }
      `}</style>

      {/* ✨ EFEK AURA REASONING ✨ */}
      <div className={`absolute -inset-[1px] z-0 pointer-events-none rounded-[32px] transition-opacity duration-700 ease-out overflow-hidden ${isReasoning ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 border-[2px] border-[var(--vscode-textLink-foreground)] rounded-[32px] opacity-70"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--vscode-textLink-foreground)] to-transparent opacity-20"></div>
        <div className="absolute inset-0 bg-[var(--vscode-textLink-foreground)] animate-pulse opacity-10"></div>
      </div>

      {/* File Attachment Area */}
      {props.attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3 pb-0 relative z-10">
          {props.attachedFiles.map((file) => (
            <div key={file.path} className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-[var(--vscode-editor-inactiveSelectionBackground)] border border-[var(--vscode-panel-border)] text-[11px] font-mono shadow-sm">
              <span className="opacity-70">📄</span>
              <span className="text-[var(--vscode-editor-foreground)] truncate max-w-[150px]">{file.name}</span>
              <button onClick={() => props.removeFileFromAttachment(file.path)} className="w-5 h-5 rounded-full hover:bg-[var(--vscode-list-hoverBackground)] flex items-center justify-center text-[10px] opacity-60 hover:opacity-100 transition-colors">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 
        🛠️ LAYOUT BARU: flex items-end
        Memaksa tombol selalu berada di dasar sejajar dengan teks, dan memisahkan area teks dengan area tombol.
      */}
      <div className="flex items-end w-full relative px-2 py-2 z-10 gap-1.5">
        
        {/* Textarea Area (Scrollbar muncul di sisi kanan kotak ini, sebelum tombol) */}
        <textarea
          ref={textareaRef}
          onKeyDown={handleKeyDown}
          onChange={(e) => { adjustHeight(); props.handleFileSearch(e); }}
          placeholder="Ask Neuralis or attach context..."
          className="island-textarea flex-1 outline-none bg-transparent resize-none py-2.5 pl-3 pr-1 text-[14px] leading-relaxed text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-descriptionForeground)] placeholder:opacity-80 min-h-[44px] max-h-[200px] overflow-y-auto"
          rows={1}
        />
        
        {/* Tombol Area (Terkunci di kanan bawah, tidak terpengaruh scroll) */}
        <div className="flex items-center gap-1.5 shrink-0 mb-[5px] pr-1">
          
          {/* Tombol Toggle Reasoning */}
          <button
            onClick={() => setIsReasoning(!isReasoning)}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 border overflow-hidden shrink-0 ${
              isReasoning 
                ? 'border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)] shadow-[0_0_10px_var(--vscode-textLink-foreground)]' 
                : 'border-transparent text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]'
            }`}
            title="Toggle Reasoning"
          >
            {isReasoning && <div className="absolute inset-0 bg-[var(--vscode-textLink-foreground)] opacity-20"></div>}
            <svg width="15" height="15" viewBox="0 0 24 24" fill={isReasoning ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isReasoning ? "0" : "2"} strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
              <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
            </svg>
          </button>

          {/* Tombol Send / Stop */}
          {props.isStreaming ? (
            <button onClick={props.onCancelStream} className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--vscode-editor-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] shrink-0 transition-colors" title="Stop">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
          ) : (
            <button 
              onClick={() => {
                const content = textareaRef.current?.value || '';
                if (content.trim() || props.attachedFiles.length > 0) {
                  props.onSendMessage(content, props.attachedFiles, isReasoning);
                  if (textareaRef.current) { textareaRef.current.value = ''; adjustHeight(); }
                }
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] shrink-0 transition-colors shadow-sm"
              title="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-[1px]"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown File Context */}
      {props.showFileDropdown && props.filteredWorkspaceFiles.length > 0 && (
        <div className="absolute bottom-[100%] left-4 right-4 mb-4 max-h-[180px] overflow-y-auto z-50 rounded-2xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)] shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in slide-in-from-bottom-2 duration-200">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] mb-1">Workspace Files Context</div>
          {props.filteredWorkspaceFiles.slice(0, 20).map((filePath) => (
            <button key={filePath} onClick={() => { props.addFileToAttachment(filePath); props.setShowFileDropdown(false); if (textareaRef.current) { textareaRef.current.value = textareaRef.current.value.replace(/@\S*$/, ''); textareaRef.current.focus(); } }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--vscode-list-hoverBackground)] flex flex-col gap-0.5 group transition-colors">
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