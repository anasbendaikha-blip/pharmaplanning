'use client';

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'list';
  count?: number;
}

export default function LoadingSkeleton({ type = 'card', count = 3 }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <>
        <div className="skeleton-table">
          <div className="skeleton-row skeleton-header-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-cell skeleton-cell-header" />
            ))}
          </div>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="skeleton-row">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="skeleton-cell" />
              ))}
            </div>
          ))}
        </div>
        <style jsx>{`
          .skeleton-table {
            background: white;
            border: 1px solid var(--color-neutral-200);
            border-radius: var(--radius-md);
            overflow: hidden;
          }
          .skeleton-row {
            display: flex;
            gap: var(--spacing-3);
            padding: var(--spacing-3) var(--spacing-4);
            border-bottom: 1px solid var(--color-neutral-100);
          }
          .skeleton-header-row {
            background-color: var(--color-neutral-50);
          }
          .skeleton-cell {
            flex: 1;
            height: 16px;
            background: var(--color-neutral-200);
            border-radius: var(--radius-sm);
            animation: pulse 1.5s ease-in-out infinite;
          }
          .skeleton-cell-header {
            height: 14px;
            background: var(--color-neutral-300);
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </>
    );
  }

  if (type === 'list') {
    return (
      <>
        <div className="skeleton-list">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="skeleton-list-item">
              <div className="skeleton-avatar" />
              <div className="skeleton-lines">
                <div className="skeleton-line skeleton-line-title" />
                <div className="skeleton-line skeleton-line-sub" />
              </div>
            </div>
          ))}
        </div>
        <style jsx>{`
          .skeleton-list {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-3);
          }
          .skeleton-list-item {
            display: flex;
            align-items: center;
            gap: var(--spacing-3);
            padding: var(--spacing-3) var(--spacing-4);
            background: white;
            border: 1px solid var(--color-neutral-200);
            border-radius: var(--radius-md);
          }
          .skeleton-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--color-neutral-200);
            flex-shrink: 0;
            animation: pulse 1.5s ease-in-out infinite;
          }
          .skeleton-lines {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .skeleton-line {
            height: 14px;
            background: var(--color-neutral-200);
            border-radius: var(--radius-sm);
            animation: pulse 1.5s ease-in-out infinite;
          }
          .skeleton-line-title { width: 60%; }
          .skeleton-line-sub { width: 40%; }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </>
    );
  }

  // Default: card
  return (
    <>
      <div className="skeleton-cards">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-card-header" />
            <div className="skeleton-card-body">
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line-short" />
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .skeleton-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-4);
        }
        .skeleton-card {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: var(--spacing-5);
        }
        .skeleton-card-header {
          height: 20px;
          background: var(--color-neutral-200);
          border-radius: var(--radius-sm);
          margin-bottom: var(--spacing-4);
          width: 60%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-card-body {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
        }
        .skeleton-line {
          height: 14px;
          background: var(--color-neutral-200);
          border-radius: var(--radius-sm);
          animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-line-short { width: 40%; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
