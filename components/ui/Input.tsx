'use client';

import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export default function Input({
  label,
  error,
  hint,
  icon,
  required,
  ...props
}: InputProps) {
  const id = useId();
  const inputId = props.id || id;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <>
      <div className={`input-group ${error ? 'input-group--error' : ''}`}>
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>

        <div className="input-wrapper">
          {icon && <span className="input-icon">{icon}</span>}
          <input
            id={inputId}
            className={`input-field ${icon ? 'input-field--with-icon' : ''}`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            required={required}
            {...props}
          />
        </div>

        {error && (
          <p id={errorId} className="input-error" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="input-hint">
            {hint}
          </p>
        )}
      </div>

      <style jsx>{`
        .input-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .input-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
        }

        .input-required {
          color: var(--color-danger-500);
          margin-left: 2px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: var(--spacing-3);
          color: var(--color-neutral-500);
          display: inline-flex;
          pointer-events: none;
        }

        .input-field {
          width: 100%;
          height: 36px;
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-base);
          color: var(--color-neutral-900);
          background-color: white;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .input-field--with-icon {
          padding-left: var(--spacing-10);
        }

        .input-field::placeholder {
          color: var(--color-neutral-400);
        }

        .input-field:hover:not(:disabled) {
          border-color: var(--color-neutral-400);
        }

        .input-field:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px var(--color-primary-50);
        }

        .input-field:disabled {
          background-color: var(--color-neutral-100);
          color: var(--color-neutral-500);
          cursor: not-allowed;
        }

        .input-group--error .input-field {
          border-color: var(--color-danger-500);
        }

        .input-group--error .input-field:focus {
          box-shadow: 0 0 0 3px var(--color-danger-50);
        }

        .input-error {
          font-size: var(--font-size-xs);
          color: var(--color-danger-600);
          margin: 0;
        }

        .input-hint {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          margin: 0;
        }
      `}</style>
    </>
  );
}
