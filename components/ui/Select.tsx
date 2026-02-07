'use client';

import { type SelectHTMLAttributes, useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  placeholder?: string;
}

export default function Select({
  label,
  options,
  error,
  hint,
  placeholder,
  required,
  ...props
}: SelectProps) {
  const id = useId();
  const selectId = props.id || id;
  const errorId = `${selectId}-error`;

  return (
    <>
      <div className={`select-group ${error ? 'select-group--error' : ''}`}>
        <label htmlFor={selectId} className="select-label">
          {label}
          {required && <span className="select-required">*</span>}
        </label>

        <div className="select-wrapper">
          <select
            id={selectId}
            className="select-field"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            required={required}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="select-arrow">&#9662;</span>
        </div>

        {error && (
          <p id={errorId} className="select-error" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="select-hint">{hint}</p>
        )}
      </div>

      <style jsx>{`
        .select-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .select-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
        }

        .select-required {
          color: var(--color-danger-500);
          margin-left: 2px;
        }

        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .select-field {
          width: 100%;
          height: 36px;
          padding: var(--spacing-2) var(--spacing-8) var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-base);
          color: var(--color-neutral-900);
          background-color: white;
          appearance: none;
          cursor: pointer;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .select-field:hover:not(:disabled) {
          border-color: var(--color-neutral-400);
        }

        .select-field:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px var(--color-primary-50);
        }

        .select-field:disabled {
          background-color: var(--color-neutral-100);
          color: var(--color-neutral-500);
          cursor: not-allowed;
        }

        .select-arrow {
          position: absolute;
          right: var(--spacing-3);
          color: var(--color-neutral-500);
          font-size: var(--font-size-xs);
          pointer-events: none;
        }

        .select-group--error .select-field {
          border-color: var(--color-danger-500);
        }

        .select-error {
          font-size: var(--font-size-xs);
          color: var(--color-danger-600);
          margin: 0;
        }

        .select-hint {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          margin: 0;
        }
      `}</style>
    </>
  );
}
