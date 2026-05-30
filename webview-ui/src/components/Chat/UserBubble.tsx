// webview-ui/src/components/Chat/UserBubble.tsx

/**
 * @fileoverview
 * Neuralis - User Message Bubble Component
 * 
 * Renders user prompt messages with a premium modern design using
 * VS Code theme variables for consistent styling via Tailwind CSS.
 */

import React from 'react';
import { Message } from '../../contracts/webview.contracts';

interface UserBubbleProps {
  message: Message;
}

const UserBubble: React.FC<UserBubbleProps> = ({ message }) => {
  return (
    <div className="flex flex-col gap-2">
      {/* Jika ada file yang dilampirkan, render pills di atas teks */}
      {message.attachedFiles && message.attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1 max-w-full">
          {message.attachedFiles.map((file, idx) => (
            <div 
              key={idx} 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[rgba(255,255,255,0.15)] text-[var(--vscode-button-foreground)] border border-[rgba(255,255,255,0.1)] truncate max-w-[140px]"
              title={file.path}
            >
              <span>📄</span>
              <span className="truncate">{file.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Isi Teks Prompt */}
      <div className="whitespace-pre-wrap word-wrap break-word text-[13px] leading-relaxed select-text">
        {message.content}
      </div>
    </div>
  );
};

export default UserBubble;