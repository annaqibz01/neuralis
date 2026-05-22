import React from 'react';
import { ThinkBlock } from './ThinkBlock';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  thinkContent?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, thinkContent }) => {
  const isUser = role === 'user';

  return (
    <div className={`w-full ${isUser ? '' : ''}`}>
      {/* Render reasoning block for DeepSeek Pro if tokens exist */}
      {!isUser && thinkContent && thinkContent.trim().length > 0 && (
        <div className="mb-3">
          <ThinkBlock content={thinkContent} />
        </div>
      )}
      
      {/* Main message content - Clean typography feed */}
      <div 
        className={`
          text-sm leading-relaxed whitespace-pre-wrap
          ${isUser 
            ? 'text-[var(--vscode-foreground)] font-medium' 
            : 'text-[var(--vscode-foreground)]'
          }
        `}
      >
        {content || (isUser ? '' : (
          <span className="inline-flex items-center gap-1.5 opacity-50">
            <span className="w-2 h-2 rounded-full bg-[var(--vscode-button-background)] animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-[var(--vscode-button-background)] animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-2 h-2 rounded-full bg-[var(--vscode-button-background)] animate-pulse" style={{ animationDelay: '0.4s' }} />
          </span>
        ))}
      </div>
    </div>
  );
};