'use client';

interface EmptyStateProps {
  /** SVG path d attribute for the icon */
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <>
      <div className="empty-state">
        {icon && (
          <svg
            className="empty-icon"
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
            <path d={icon} />
          </svg>
        )}
        <h3 className="empty-title">{title}</h3>
        <p className="empty-description">{description}</p>
        {action && (
          <button className="empty-action" onClick={action.onClick} type="button">
            {action.label}
          </button>
        )}
      </div>

      <style jsx>{`
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--spacing-12) var(--spacing-6);
          min-height: 300px;
        }

        .empty-icon {
          color: var(--color-neutral-300);
          margin-bottom: var(--spacing-4);
        }

        .empty-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          margin: 0 0 var(--spacing-2) 0;
        }

        .empty-description {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin: 0 0 var(--spacing-5) 0;
          max-width: 360px;
          line-height: var(--line-height-relaxed);
        }

        .empty-action {
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

        .empty-action:hover {
          background-color: var(--color-primary-700);
        }
      `}</style>
    </>
  );
}
