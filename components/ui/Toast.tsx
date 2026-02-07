'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      setToasts(prev => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé dans un ToastProvider');
  }
  return context;
}

/* ---- Conteneur d'affichage ---- */

const TOAST_ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
};

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <>
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">{TOAST_ICONS[toast.type]}</span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => onRemove(toast.id)}
              aria-label="Fermer la notification"
              type="button"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .toast-container {
          position: fixed;
          top: var(--spacing-4);
          right: var(--spacing-4);
          z-index: var(--z-toast);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
          max-width: 400px;
        }

        .toast {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          animation: toastSlideIn var(--transition-normal);
          font-size: var(--font-size-sm);
        }

        .toast-success {
          background-color: var(--color-success-50);
          border-left: 3px solid var(--color-success-500);
          color: var(--color-success-700);
        }

        .toast-error {
          background-color: var(--color-danger-50);
          border-left: 3px solid var(--color-danger-500);
          color: var(--color-danger-700);
        }

        .toast-warning {
          background-color: var(--color-warning-50);
          border-left: 3px solid var(--color-warning-500);
          color: var(--color-warning-700);
        }

        .toast-info {
          background-color: var(--color-secondary-50);
          border-left: 3px solid var(--color-secondary-500);
          color: var(--color-secondary-700);
        }

        .toast-icon {
          font-size: var(--font-size-md);
          flex-shrink: 0;
        }

        .toast-message {
          flex: 1;
        }

        .toast-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: none;
          background: transparent;
          color: inherit;
          opacity: 0.6;
          cursor: pointer;
          font-size: var(--font-size-xs);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .toast-close:hover {
          opacity: 1;
          background-color: rgba(0, 0, 0, 0.05);
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
