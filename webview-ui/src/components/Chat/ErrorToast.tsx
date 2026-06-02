import React, { useEffect } from 'react';

interface ErrorToastProps {
  message: string;
  onClose: () => void;
  onActionClick?: () => void;
  actionLabel?: string;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ message, onClose, onActionClick, actionLabel }) => {
  
  // Otomatis menutup error setelah 6 detik jika tidak ditutup manual
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="absolute top-16 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center animate-in slide-in-from-top-4 fade-in duration-300 ease-out">
      <div className="pointer-events-auto flex items-center justify-between gap-4 w-full max-w-xl p-3 rounded-xl border border-[var(--vscode-inputValidation-errorBorder)]/30 bg-[var(--vscode-inputValidation-errorBackground)]/10 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
        
        {/* Sisi Kiri: Ikon & Pesan */}
        <div className="flex items-center gap-3 overflow-hidden">
          <p className="text-[12px] font-medium text-[var(--vscode-foreground)] opacity-95 truncate leading-relaxed">
            {message}
          </p>
        </div>

        {/* Sisi Kanan: Tombol Aksi & Close */}
        <div className="flex items-center gap-2 shrink-0">
          {onActionClick && actionLabel && (
            <button
              onClick={onActionClick}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-colors shadow-sm"
            >
              {actionLabel}
            </button>
          )}
          
          <button
            onClick={onClose}
            className="p-1 rounded-md bg-transparent text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] transition-colors"
            title="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
};