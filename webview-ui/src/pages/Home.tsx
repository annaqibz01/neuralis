import React from 'react';

interface Session {
  id: string;
  title: string;
  timestamp: string;
  aiMode?: string;
}

interface HomeProps {
  onNewChat: () => void;
  onViewHistory: () => void;
  recentHistory: Session[];
  onSessionSelect: (sessionId: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNewChat, onViewHistory, recentHistory, onSessionSelect }) => {
  // ===== SVG Icons =====
  const NeuralisLogo = () => (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0 lg:w-16 lg:h-16"
    >
      {/* Outer glow ring */}
      <circle
        cx="28"
        cy="28"
        r="26"
        stroke="var(--vscode-button-background)"
        strokeWidth="1.5"
        opacity="0.15"
      />
      {/* Main ring */}
      <circle
        cx="28"
        cy="28"
        r="22"
        stroke="var(--vscode-button-background)"
        strokeWidth="1.5"
        opacity="0.3"
        strokeDasharray="4 4"
      />
      {/* Inner circle */}
      <circle
        cx="28"
        cy="28"
        r="14"
        fill="var(--vscode-button-background)"
        opacity="0.9"
      />
      {/* Neural network pattern */}
      <g opacity="0.8">
        <line x1="28" y1="16" x2="28" y2="40" stroke="var(--vscode-sideBar-background)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="28" x2="40" y2="28" stroke="var(--vscode-sideBar-background)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="19.5" y1="19.5" x2="36.5" y2="36.5" stroke="var(--vscode-sideBar-background)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
        <line x1="36.5" y1="19.5" x2="19.5" y2="36.5" stroke="var(--vscode-sideBar-background)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      </g>
      {/* Center node */}
      <circle
        cx="28"
        cy="28"
        r="4"
        fill="var(--vscode-button-background)"
        stroke="var(--vscode-sideBar-background)"
        strokeWidth="2"
      />
      {/* Pulsing dots */}
      <circle cx="28" cy="18" r="1.5" fill="var(--vscode-button-background)" opacity="0.4"/>
      <circle cx="28" cy="38" r="1.5" fill="var(--vscode-button-background)" opacity="0.4"/>
      <circle cx="18" cy="28" r="1.5" fill="var(--vscode-button-background)" opacity="0.4"/>
      <circle cx="38" cy="28" r="1.5" fill="var(--vscode-button-background)" opacity="0.4"/>
    </svg>
  );

  const PlusIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <path d="M6 10H14M10 6V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  const ClockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5.5" opacity="0.5"/>
      <path d="M7 4V7L9 9"/>
    </svg>
  );

  const ChatIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2H14V11H4L2 13V2Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="5.5" cy="6.5" r="0.5" fill="currentColor" opacity="0.5"/>
      <circle cx="8" cy="6.5" r="0.5" fill="currentColor" opacity="0.5"/>
      <circle cx="10.5" cy="6.5" r="0.5" fill="currentColor" opacity="0.5"/>
    </svg>
  );

  const ArrowRight = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2L8 6L4 10"/>
    </svg>
  );

  const HistoryIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5"/>
      <path d="M7 4.5V7.5L9 9"/>
      <path d="M11.5 11.5L13.5 13.5"/>
    </svg>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--vscode-sideBar-background)] text-[var(--vscode-foreground)]">
      {/* ===== Main Content Container ===== */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 py-8 lg:px-12 lg:gap-12">
        
        {/* ===== Hero Section ===== */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:flex-1 lg:max-w-lg">
          {/* Logo with ambient glow */}
          <div className="relative mb-4 lg:mb-6">
            <div className="absolute inset-0 rounded-full blur-xl opacity-20" style={{ backgroundColor: 'var(--vscode-button-background)' }} />
            <NeuralisLogo />
          </div>

          {/* Greeting */}
          <h1 className="text-lg font-bold tracking-tight mb-2 lg:text-2xl lg:leading-tight">
            Hello! Ready to optimize your code?
          </h1>
          
          {/* Subtitle */}
          <p className="hidden lg:block text-sm mb-6 opacity-70" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Your AI companion is here to help you write better code.
          </p>

          {/* Primary CTA - New Chat */}
          <button
            onClick={onNewChat}
            className="
              flex items-center gap-2 px-6 py-3 rounded-xl
              bg-[var(--vscode-button-background)]
              text-[var(--vscode-button-foreground)]
              hover:opacity-90
              active:scale-[0.98]
              transition-all duration-200 ease-in-out
              shadow-lg shadow-[var(--vscode-button-background)]/20
              focus:outline-none focus:ring-2 focus:ring-[var(--vscode-button-background)]/50
              font-medium
            "
          >
            <PlusIcon />
            <span>New Chat</span>
          </button>
        </div>

        {/* ===== Recent Sessions Preview ===== */}
        <div className="w-full mt-8 lg:mt-0 lg:flex-1 lg:max-w-md">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-4">
            <HistoryIcon />
            <h2 className="text-xs font-semibold uppercase tracking-wider opacity-50" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              Recent Sessions
            </h2>
            {recentHistory.length > 0 && (
              <span className="text-[10px] opacity-30 ml-auto">{recentHistory.length} sessions</span>
            )}
          </div>

          {/* Sessions Preview List */}
          <div className="space-y-1">
            {recentHistory.length > 0 ? (
              recentHistory.slice(0, 4).map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)} // Session click handler (future implementation)
                  className="
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-150 ease-in-out
                    hover:bg-[var(--vscode-list-hoverBackground)]
                    active:bg-[var(--vscode-list-activeSelectionBackground)]
                    group text-left cursor-pointer
                  "
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  {/* Session Icon */}
                  <span className="flex-shrink-0 opacity-40 group-hover:opacity-60 transition-opacity">
                    <ChatIcon />
                  </span>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate leading-tight">{session.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <ClockIcon />
                      <span className="text-[10px] opacity-40">{session.timestamp}</span>
                      {session.aiMode && (
                        <>
                          <span className="text-[10px] opacity-20">·</span>
                          <span className="text-[10px] opacity-30">{session.aiMode}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <span className="flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
                    <ArrowRight />
                  </span>
                </button>
              ))
            ) : (
              <div className="text-center py-6 opacity-40">
                <p className="text-sm">No recent sessions</p>
                <p className="text-xs mt-1">Start a new chat to see your history here</p>
              </div>
            )}
          </div>

          {/* View All History Link */}
          {recentHistory.length > 0 && (
            <button
              onClick={onViewHistory}
              className="
                w-full flex items-center justify-center gap-1.5 py-2.5 mt-2
                text-xs font-medium opacity-40 hover:opacity-70
                transition-all duration-150 ease-in-out
                rounded-lg hover:bg-[var(--vscode-list-hoverBackground)]
                focus:outline-none focus:ring-1 focus:ring-[var(--vscode-button-background)]/30
                group
              "
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              <span>See all sessions</span>
              <span className="group-hover:translate-x-0.5 transition-transform duration-150">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3L9 7L5 11"/>
                </svg>
              </span>
            </button>
          )}

          {/* Empty state CTA */}
          {recentHistory.length === 0 && (
            <button
              onClick={onNewChat}
              className="
                w-full flex items-center justify-center gap-1.5 py-2.5 mt-2
                text-xs font-medium opacity-40 hover:opacity-70
                transition-all duration-150 ease-in-out
                rounded-lg hover:bg-[var(--vscode-list-hoverBackground)]
                focus:outline-none focus:ring-1 focus:ring-[var(--vscode-button-background)]/30
              "
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              <PlusIcon />
              <span>Start your first conversation</span>
            </button>
          )}
        </div>
      </div>

      {/* ===== Bottom Gradient ===== */}
      <div className="h-6 flex-shrink-0 lg:h-8" style={{ background: `linear-gradient(to top, var(--vscode-sideBar-background), transparent)` }} />
    </div>
  );
};

export default Home;