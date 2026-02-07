'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <>
      <div className="error-page">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
        </svg>
        <h2>Une erreur est survenue</h2>
        <p className="error-description">
          {error.message || 'Un probleme inattendu est survenu. Veuillez reessayer.'}
        </p>
        <button onClick={reset} className="error-retry-btn" type="button">
          Reessayer
        </button>
      </div>

      <style jsx>{`
        .error-page {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          text-align: center;
          padding: var(--spacing-8);
          color: var(--color-neutral-600);
        }

        h2 {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
          margin: var(--spacing-4) 0 var(--spacing-2) 0;
        }

        .error-description {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin: 0 0 var(--spacing-5) 0;
          max-width: 400px;
          line-height: var(--line-height-relaxed);
        }

        .error-retry-btn {
          padding: var(--spacing-2) var(--spacing-5);
          background-color: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .error-retry-btn:hover {
          background-color: var(--color-primary-700);
        }
      `}</style>
    </>
  );
}
