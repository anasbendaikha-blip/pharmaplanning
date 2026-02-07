'use client';

import { useEffect, useState, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import type { Employee, EmployeeCategory } from '@/lib/types';

/** Labels français des catégories */
const CATEGORY_LABELS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: 'Pharmacien Titulaire',
  pharmacien_adjoint: 'Pharmacien Adjoint',
  preparateur: 'Préparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti',
  etudiant: 'Étudiant',
};

/** Couleurs des pastilles par catégorie */
const CATEGORY_COLORS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: '#2563eb',
  pharmacien_adjoint: '#3b82f6',
  preparateur: '#10b981',
  rayonniste: '#f59e0b',
  apprenti: '#8b5cf6',
  etudiant: '#ec4899',
};

/** Ordre d'affichage des catégories */
const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

export default function EmployesPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<EmployeeCategory | 'all'>('all');

  useEffect(() => {
    if (!organizationId || orgLoading) return;
    let cancelled = false;
    getEmployees(organizationId)
      .then(data => { if (!cancelled) setEmployees(data); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId, orgLoading]);

  /** Employés groupés par catégorie */
  const grouped = useMemo(() => {
    const filtered = filterCategory === 'all'
      ? employees
      : employees.filter(e => e.category === filterCategory);

    const groups: Partial<Record<EmployeeCategory, Employee[]>> = {};
    for (const emp of filtered) {
      if (!groups[emp.category]) groups[emp.category] = [];
      groups[emp.category]!.push(emp);
    }
    return groups;
  }, [employees, filterCategory]);

  /** Compteur par catégorie */
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<EmployeeCategory, number>> = {};
    for (const emp of employees) {
      counts[emp.category] = (counts[emp.category] || 0) + 1;
    }
    return counts;
  }, [employees]);

  if (orgLoading || isLoading) {
    return (
      <>
        <div className="loading-state">
          <span className="loading-spinner" />
          <span className="loading-text">Chargement des employés...</span>
        </div>
        <style jsx>{`
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-3);
            height: 300px;
            color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .loading-text {
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="employes-page">
        {/* En-tête */}
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">Gestion des Employés</h1>
            <p className="page-subtitle">
              {employees.length} employé{employees.length > 1 ? 's' : ''} actif{employees.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filtres par catégorie */}
        <div className="category-filters">
          <button
            className={`filter-chip ${filterCategory === 'all' ? 'filter-chip--active' : ''}`}
            onClick={() => setFilterCategory('all')}
            type="button"
          >
            Tous ({employees.length})
          </button>
          {CATEGORY_ORDER.map(cat => {
            const count = categoryCounts[cat] || 0;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                className={`filter-chip ${filterCategory === cat ? 'filter-chip--active' : ''}`}
                onClick={() => setFilterCategory(cat)}
                type="button"
              >
                <span
                  className="filter-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* Liste des employés */}
        <div className="employees-grid">
          {CATEGORY_ORDER.map(cat => {
            const group = grouped[cat];
            if (!group || group.length === 0) return null;

            return (
              <div key={cat} className="category-section">
                <div className="category-header">
                  <span
                    className="category-dot"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  <h2 className="category-title">{CATEGORY_LABELS[cat]}</h2>
                  <span className="category-count">{group.length}</span>
                </div>

                <div className="employee-cards">
                  {group.map(emp => (
                    <div key={emp.id} className="employee-card">
                      <div className="card-avatar" style={{ backgroundColor: CATEGORY_COLORS[emp.category] }}>
                        {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                      </div>
                      <div className="card-info">
                        <div className="card-name">
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div className="card-details">
                          <span className="card-contract">{emp.contract_type}</span>
                          <span className="card-separator">·</span>
                          <span className="card-hours">{emp.contract_hours}h/sem</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .employes-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-5);
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .page-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          margin: 0;
        }

        .page-subtitle {
          color: var(--color-neutral-500);
          font-size: var(--font-size-sm);
          margin: var(--spacing-1) 0 0;
        }

        /* ─── Filtres ─── */
        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-2);
        }

        .filter-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-full);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-chip:hover {
          border-color: var(--color-primary-300);
          color: var(--color-primary-600);
        }

        .filter-chip--active {
          background: var(--color-primary-50);
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
          font-weight: var(--font-weight-semibold);
        }

        .filter-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ─── Grille ─── */
        .employees-grid {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
        }

        .category-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .category-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .category-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          margin: 0;
        }

        .category-count {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
          font-weight: var(--font-weight-medium);
        }

        .employee-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: var(--spacing-3);
        }

        .employee-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          transition: all 0.15s ease;
        }

        .employee-card:hover {
          border-color: var(--color-primary-200);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .card-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          font-weight: var(--font-weight-bold);
          flex-shrink: 0;
          text-transform: uppercase;
        }

        .card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .card-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-details {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .card-separator {
          color: var(--color-neutral-300);
        }
      `}</style>
    </>
  );
}
