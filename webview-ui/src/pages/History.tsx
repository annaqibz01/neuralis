import React, { useState, useEffect, useRef } from 'react';

interface Session {
  id: string;
  title: string;
  timestamp: string;
  relativeTime: string;
  aiMode: string;
  dateGroup: string;
}

interface HistoryProps {
  onBack: () => void;
  onSessionSelect: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const History: React.FC<HistoryProps> = ({ onBack, onSessionSelect, onDeleteSession }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sample data - replace with actual session store
  useEffect(() => {
    const savedData = localStorage.getItem('neuralis_sessions');
    if (savedData) {
      const parsedSessions = JSON.parse(savedData);
      const formattedSessions: Session[] = parsedSessions.map((s: any) => {
        let modeIcon = '💬 Chat';
        if (s.aiMode === 'coder') modeIcon = '💻 Coder';
        if (s.aiMode === 'planning') modeIcon = '🧠 Plan';
        if (s.aiMode === 'agent') modeIcon = '🤖 Agent';
        const diffMs = Date.now() - (s.createdAt || Date.now());
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let dateGroup = 'Older';
        let relativeTime = 'Long ago';
        
        if (diffDays === 0) {
          dateGroup = 'Today';
          relativeTime = 'Today';
        } else if (diffDays === 1) {
          dateGroup = 'Yesterday';
          relativeTime = 'Yesterday';
        } else {
          relativeTime = `${diffDays} days ago`;
        }

        return {
          id: s.id,
          title: s.title || 'Untitled Session',
          timestamp: new Date(s.createdAt || Date.now()).toISOString(),
          relativeTime: relativeTime,
          aiMode: modeIcon,
          dateGroup: dateGroup
        };
      });
      setSessions(formattedSessions);
      filterSessions(formattedSessions, searchQuery);
    } else {
      setSessions([]);
      setFilteredSessions([]);
    }
  }, [searchQuery]);
  // Filter sessions based on search query
  const filterSessions = (sessionsList: Session[], query: string) => {
    if (!query.trim()) {
      setFilteredSessions(sessionsList);
      return;
    }
    const lowerQuery = query.toLowerCase();
    setFilteredSessions(
      sessionsList.filter(session =>
        session.title.toLowerCase().includes(lowerQuery)
      )
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    filterSessions(sessions, query);
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    filterSessions(updatedSessions, searchQuery);
    onDeleteSession(sessionId);
  };

  // Group sessions by date categories
  const groupedSessions = React.useMemo(() => {
    const groups: { [key: string]: Session[] } = {};
    filteredSessions.forEach(session => {
      if (!groups[session.dateGroup]) {
        groups[session.dateGroup] = [];
      }
      groups[session.dateGroup].push(session);
    });
    return groups;
  }, [filteredSessions]);

  const dateGroupOrder = ['Today', 'Yesterday', 'Older'];

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--vscode-widget-border)]">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-[var(--vscode-list-hoverBackground)] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--vscode-button-background)]/30"
          title="Back"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4L5 9L11 14" />
          </svg>
        </button>
        <h1 className="text-base font-semibold tracking-tight">Chat History</h1>
        <span className="text-xs opacity-40 ml-auto">{sessions.length} sessions</span>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
          >
            <circle cx="6" cy="6" r="4.5" />
            <path d="M9.5 9.5L12.5 12.5" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search sessions..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-widget-border)] placeholder-[var(--vscode-input-placeholderForeground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vscode-button-background)]/30 focus:border-transparent transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                filterSessions(sessions, '');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3L9 9M9 3L3 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {Object.keys(groupedSessions).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mb-3">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="10" y1="9" x2="14" y2="9" />
            </svg>
            <p className="text-sm">{searchQuery ? 'No sessions match your search' : 'No chat history yet'}</p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  filterSessions(sessions, '');
                }}
                className="mt-2 text-xs text-[var(--vscode-button-background)] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          dateGroupOrder.map(group => {
            if (!groupedSessions[group]) return null;
            return (
              <div key={group}>
                {/* Date Group Header */}
                <h3 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-2 px-1">
                  {group}
                </h3>
                {/* Session Cards */}
                <div className="space-y-1">
                  {groupedSessions[group].map((session) => (
                    <button
                      key={session.id}
                      onClick={() => onSessionSelect(session.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ease-in-out hover:bg-[var(--vscode-list-hoverBackground)] active:bg-[var(--vscode-list-activeSelectionBackground)] group relative text-left"
                      style={{ color: 'var(--vscode-foreground)' }}
                    >
                      {/* Chat Icon */}
                      <span className="flex-shrink-0 opacity-40 group-hover:opacity-60 transition-opacity">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 2H14V11H4L2 13V2Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                          <circle cx="5.5" cy="6.5" r="0.5" fill="currentColor" opacity="0.5" />
                          <circle cx="8" cy="6.5" r="0.5" fill="currentColor" opacity="0.5" />
                          <circle cx="10.5" cy="6.5" r="0.5" fill="currentColor" opacity="0.5" />
                        </svg>
                      </span>

                      {/* Session Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{session.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] opacity-50">{session.aiMode}</span>
                          <span className="text-[10px] opacity-30">·</span>
                          <span className="text-[10px] opacity-30">{session.relativeTime}</span>
                        </div>
                      </div>

                      {/* Delete Button (visible on hover) */}
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className="flex-shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-40 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
                        title="Delete session"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 3.5H11.5" />
                          <path d="M4.5 3.5V2.5C4.5 2.22386 4.72386 2 5 2H9C9.27614 2 9.5 2.22386 9.5 2.5V3.5" />
                          <path d="M11 3.5V11C11 11.2761 10.7761 11.5 10.5 11.5H3.5C3.22386 11.5 3 11.2761 3 11V3.5" />
                          <line x1="5.5" y1="6" x2="5.5" y2="9" />
                          <line x1="8.5" y1="6" x2="8.5" y2="9" />
                        </svg>
                      </button>

                      {/* Arrow indicator */}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity ml-1"
                      >
                        <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default History;