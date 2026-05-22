import React, { useState } from 'react';

interface ThinkBlockProps {
    content: string;
}

export const ThinkBlock: React.FC<ThinkBlockProps> = ({ content }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="my-2 border-l-2 border-blue-500 bg-blue-500/10 rounded-r-md overflow-hidden">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 focus:outline-none flex gap-2 items-center transition-colors"
            >
                <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                <span>Reasoning Process</span>
            </button>
            
            {isExpanded && (
                <div className="px-3 py-2 text-sm italic text-gray-400/90 whitespace-pre-wrap border-t border-blue-500/20">
                    {content}
                </div>
            )}
        </div>
    );
};