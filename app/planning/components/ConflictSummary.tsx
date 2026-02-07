'use client';

import { useMemo } from 'react';
import type { Conflict } from '@/lib/types';

interface ConflictSummaryProps {
  conflicts: Conflict[];
  pharmacistCoveragePercent: number;
}

export default function ConflictSummary({
  conflicts,
  pharmacistCoveragePercent,
}: ConflictSummaryProps) {
  const { errors, warnings, infos } = useMemo(() => {
    const errors = conflicts.filter(c => c.severity === 'error');
    const warnings = conflicts.filter(c => c.severity === 'warning');
    const infos = conflicts.filter(c => c.severity === 'info');
    return { errors, warnings, infos };
  }, [conflicts]);

  const isValid = errors.length === 0;

  return (
    <>
      <div className={`conflict-summary ${isValid ? 'conflict-summary--valid' : 'conflict-summary--invalid'}`}>
        <div className="summary-status">
          <span className="summary-icon">
            {isValid ? '\u2713' : '\u2717'}
          </span>
          <span className="summary-label">
            {isValid ? 'Planning conforme' : 'Conflits détectés'}
          </span>
        </div>

        <div className="summary-counts">
          {errors.length > 0 && (
            <span className="count count--error" title={errors.map(e => e.message).join('\n')}>
              {errors.length} erreur{errors.length > 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="count count--warning" title={warnings.map(w => w.message).join('\n')}>
              {warnings.length} avert.
            </span>
          )}
          {infos.length > 0 && (
            <span className="count count--info">
              {infos.length} info{infos.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="summary-coverage">
          <span className="coverage-label">Couverture pharmacien</span>
          <span className={`coverage-value ${pharmacistCoveragePercent === 100 ? 'coverage-value--full' : 'coverage-value--partial'}`}>
            {pharmacistCoveragePercent}%
          </span>
        </div>
      </div>

      <style jsx>{`
        .conflict-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-2) var(--spacing-4);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        .conflict-summary--valid {
          background-color: var(--color-success-50);
          border: 1px solid var(--color-success-500);
        }

        .conflict-summary--invalid {
          background-color: var(--color-danger-50);
          border: 1px solid var(--color-danger-300);
        }

        .summary-status {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .summary-icon {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
        }

        .conflict-summary--valid .summary-icon {
          color: var(--color-success-700);
        }
        .conflict-summary--invalid .summary-icon {
          color: var(--color-danger-600);
        }

        .summary-label {
          font-weight: var(--font-weight-semibold);
        }
        .conflict-summary--valid .summary-label {
          color: var(--color-success-700);
        }
        .conflict-summary--invalid .summary-label {
          color: var(--color-danger-700);
        }

        .summary-counts {
          display: flex;
          gap: var(--spacing-3);
        }

        .count {
          padding: 2px var(--spacing-2);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: help;
        }

        .count--error {
          background-color: var(--color-danger-100);
          color: var(--color-danger-700);
        }

        .count--warning {
          background-color: var(--color-warning-100);
          color: var(--color-warning-700);
        }

        .count--info {
          background-color: var(--color-secondary-100);
          color: var(--color-secondary-700);
        }

        .summary-coverage {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .coverage-label {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-600);
        }

        .coverage-value {
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
        }

        .coverage-value--full {
          color: var(--color-success-700);
        }
        .coverage-value--partial {
          color: var(--color-warning-600);
        }
      `}</style>
    </>
  );
}
