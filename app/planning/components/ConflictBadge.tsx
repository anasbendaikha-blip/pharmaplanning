'use client';

import type { ConflictSeverity } from '@/lib/types';

interface ConflictBadgeProps {
  severity: ConflictSeverity;
  message: string;
  compact?: boolean;
}

const SEVERITY_CONFIG: Record<ConflictSeverity, { icon: string; label: string }> = {
  error: { icon: '\u2717', label: 'Violation légale' },
  warning: { icon: '\u26A0', label: 'Avertissement' },
  info: { icon: '\u2139', label: 'Information' },
};

export default function ConflictBadge({ severity, message, compact = false }: ConflictBadgeProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <>
      <span
        className={`conflict-badge conflict-badge--${severity} ${compact ? 'conflict-badge--compact' : ''}`}
        title={message}
        role="status"
        aria-label={`${config.label}: ${message}`}
      >
        <span className="conflict-icon">{config.icon}</span>
        {!compact && <span className="conflict-text">{message}</span>}
      </span>

      <style jsx>{`
        .conflict-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          line-height: 1;
          cursor: default;
          max-width: 100%;
        }

        .conflict-badge--compact {
          width: 18px;
          height: 18px;
          justify-content: center;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .conflict-badge--error {
          background-color: var(--color-danger-100);
          color: var(--color-danger-700);
        }
        .conflict-badge--error.conflict-badge--compact {
          background-color: var(--color-danger-500);
          color: white;
        }

        .conflict-badge--warning {
          background-color: var(--color-warning-100);
          color: var(--color-warning-800);
        }
        .conflict-badge--warning.conflict-badge--compact {
          background-color: var(--color-warning-500);
          color: white;
        }

        .conflict-badge--info {
          background-color: var(--color-secondary-50);
          color: var(--color-secondary-700);
        }
        .conflict-badge--info.conflict-badge--compact {
          background-color: var(--color-secondary-400);
          color: white;
        }

        .conflict-icon {
          font-size: 10px;
          flex-shrink: 0;
        }

        .conflict-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </>
  );
}
