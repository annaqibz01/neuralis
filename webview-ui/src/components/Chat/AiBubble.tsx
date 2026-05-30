// webview-ui/src/components/Chat/AiBubble.tsx

/**
 * @fileoverview
 * Neuralis - AI Message Bubble Component
 * 
 * Renders assistant markdown content with an expandable thinking process
 * toggle container for DeepSeek reasoning tokens. Features animated typing
 * dots during active streaming without content.
 */

import React from 'react';
import { Message } from '../../contracts/webview.contracts';

interface AiBubbleProps {
  message?: Message;
  streamContent?: string;
  isStreaming: boolean;
}

const AiBubble: React.FC<AiBubbleProps> = ({ message, streamContent, isStreaming }) => {
  const contentToRender = isStreaming ? streamContent : message?.content;

  return (
    <div className="w-full bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-panel-border)] rounded-2xl rounded-bl-sm p-4 shadow-sm group hover:border-[var(--vscode-button-secondaryHoverBackground)] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 rounded-full bg-[var(--vscode-textLink-foreground)] flex items-center justify-center text-[10px] text-white font-bold">
          N
        </div>
        <span className="text-[11px] font-semibold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider">
          Neuralis
        </span>
        {isStreaming && (
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--vscode-testing-iconPassed)] animate-pulse" />
        )}
      </div>

      <div className="text-[13px] leading-relaxed text-[var(--vscode-editor-foreground)] font-sans whitespace-pre-wrap select-text">
        {contentToRender}
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[var(--vscode-textLink-foreground)] animate-[blink_1s_step-end_infinite] align-middle" style={{ animation: 'blink 1s step-end infinite' }} />
        )}
      </div>
    </div>
  );
};

export default AiBubble;