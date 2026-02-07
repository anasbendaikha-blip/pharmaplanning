'use client';

import type { EmployeeCategory } from '@/lib/types';

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  pharmacien_titulaire: { label: 'Pharmaciens Titulaires', color: '#2563eb' },
  pharmacien_adjoint: { label: 'Pharmaciens Adjoints', color: '#3b82f6' },
  preparateur: { label: 'Préparateurs', color: '#10b981' },
  rayonniste: { label: 'Rayonnistes', color: '#f59e0b' },
  apprenti: { label: 'Apprentis', color: '#8b5cf6' },
  etudiant: { label: 'Étudiants', color: '#ec4899' },
};

interface CategorySeparatorProps {
  category: EmployeeCategory;
  employeeCount: number;
  totalColumns: number; // 7 jours + 1 total = 8
}

export default function CategorySeparator({
  category,
  employeeCount,
  totalColumns,
}: CategorySeparatorProps) {
  const info = CATEGORY_INFO[category] || { label: category, color: '#666' };

  return (
    <>
      <tr className="category-separator">
        <td colSpan={totalColumns + 1} className="category-cell">
          <div className="category-content">
            <span className="category-dot" style={{ backgroundColor: info.color }} />
            <span className="category-label">{info.label}</span>
            <span className="category-count">{employeeCount}</span>
          </div>
        </td>
      </tr>

      <style jsx>{`
        .category-separator {
          /* Pas de hover */
        }

        .category-cell {
          background-color: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-300);
          padding: var(--spacing-1) var(--spacing-2);
        }

        .category-content {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .category-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .category-label {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .category-count {
          font-size: 10px;
          color: var(--color-neutral-400);
          font-weight: var(--font-weight-medium);
        }
      `}</style>
    </>
  );
}
