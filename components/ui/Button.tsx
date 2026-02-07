'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <>
      <button
        className={`btn btn-${variant} btn-${size}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="btn-spinner" />}
        {!loading && icon && <span className="btn-icon">{icon}</span>}
        <span className="btn-label">{children}</span>
      </button>

      <style jsx>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-2);
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
          line-height: 1;
        }

        .btn:focus-visible {
          outline: 2px solid var(--color-primary-500);
          outline-offset: 2px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Tailles */
        .btn-sm {
          padding: var(--spacing-1) var(--spacing-3);
          font-size: var(--font-size-xs);
          height: 28px;
        }

        .btn-md {
          padding: var(--spacing-2) var(--spacing-4);
          font-size: var(--font-size-sm);
          height: 36px;
        }

        .btn-lg {
          padding: var(--spacing-3) var(--spacing-6);
          font-size: var(--font-size-base);
          height: 44px;
        }

        /* Variantes */
        .btn-primary {
          background-color: var(--color-primary-600);
          color: white;
          border-color: var(--color-primary-600);
        }
        .btn-primary:hover:not(:disabled) {
          background-color: var(--color-primary-700);
          border-color: var(--color-primary-700);
        }
        .btn-primary:active:not(:disabled) {
          background-color: var(--color-primary-800);
        }

        .btn-secondary {
          background-color: white;
          color: var(--color-neutral-800);
          border-color: var(--color-neutral-300);
        }
        .btn-secondary:hover:not(:disabled) {
          background-color: var(--color-neutral-50);
          border-color: var(--color-neutral-400);
        }
        .btn-secondary:active:not(:disabled) {
          background-color: var(--color-neutral-100);
        }

        .btn-danger {
          background-color: var(--color-danger-600);
          color: white;
          border-color: var(--color-danger-600);
        }
        .btn-danger:hover:not(:disabled) {
          background-color: var(--color-danger-700);
          border-color: var(--color-danger-700);
        }
        .btn-danger:active:not(:disabled) {
          background-color: var(--color-danger-800);
        }

        .btn-ghost {
          background-color: transparent;
          color: var(--color-neutral-700);
          border-color: transparent;
        }
        .btn-ghost:hover:not(:disabled) {
          background-color: var(--color-neutral-100);
        }
        .btn-ghost:active:not(:disabled) {
          background-color: var(--color-neutral-200);
        }

        /* Spinner de chargement */
        .btn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .btn-icon {
          display: inline-flex;
          align-items: center;
          font-size: 1.1em;
        }
      `}</style>
    </>
  );
}
