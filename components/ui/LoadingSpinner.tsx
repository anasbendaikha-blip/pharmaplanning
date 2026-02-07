'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizeMap = { sm: 20, md: 32, lg: 48 };
  const dim = sizeMap[size];

  return (
    <>
      <div className="loading-spinner-wrapper">
        <span
          className="loading-spinner"
          style={{ width: `${dim}px`, height: `${dim}px` }}
        />
        {message && <span className="loading-message">{message}</span>}
      </div>

      <style jsx>{`
        .loading-spinner-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-3);
          padding: var(--spacing-6);
        }

        .loading-spinner {
          border: 3px solid var(--color-neutral-200);
          border-top-color: var(--color-primary-500);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-message {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          font-weight: var(--font-weight-medium);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
