'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import { useToast } from '@/components/ui/Toast';
import type { Employee, EmployeeCategory } from '@/lib/types';
import { getFixedForEmployee } from '@/lib/horaires-fixes-service';
import { MOCK_HORAIRES_FIXES } from '@/app/planning/data/mockHorairesFixes';
import {
  exportPlanningToCSV,
  exportHorairesToJSON,
  downloadFile,
} from '@/lib/planning-import-export';

/** Category labels */
const CATEGORY_CONFIG: Record<EmployeeCategory, { label: string; icon: string; color: string }> = {
  pharmacien_titulaire: { label: 'Pharmacien Titulaire', icon: 'Ph', color: '#2563eb' },
  pharmacien_adjoint: { label: 'Pharmacien Adjoint', icon: 'Ph', color: '#3b82f6' },
  preparateur: { label: 'Preparateur', icon: 'Pr', color: '#10b981' },
  rayonniste: { label: 'Rayonniste', icon: 'Ra', color: '#f59e0b' },
  apprenti: { label: 'Apprenti', icon: 'Ap', color: '#8b5cf6' },
  etudiant: { label: 'Etudiant', icon: 'Et', color: '#ec4899' },
};

const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  alternance: 'Alternance',
  stage: 'Stage',
  interim: 'Interim',
};

const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

type SortField = 'nom' | 'role' | 'heures' | 'contrat';
type SortOrder = 'asc' | 'desc';

export default function EquipePage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { addToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<EmployeeCategory | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Load employees
  useEffect(() => {
    if (!organizationId || orgLoading) return;
    getEmployees(organizationId).then(data => {
      setEmployees(data);
      setIsLoading(false);
    });
  }, [organizationId, orgLoading]);

  // Filter + sort
  const filteredEmployees = useMemo(() => {
    let result = employees.filter(e => e.is_active);

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(e =>
        e.first_name.toLowerCase().includes(term) ||
        e.last_name.toLowerCase().includes(term) ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter(e => e.category === filterCategory);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'nom':
          cmp = a.last_name.localeCompare(b.last_name);
          break;
        case 'role':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'heures':
          cmp = a.contract_hours - b.contract_hours;
          break;
        case 'contrat':
          cmp = (a.contract_type || '').localeCompare(b.contract_type || '');
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [employees, searchTerm, filterCategory, sortField, sortOrder]);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    const csv = exportPlanningToCSV(MOCK_HORAIRES_FIXES, employees);
    downloadFile(csv, 'equipe-horaires-fixes.csv', 'text/csv');
    addToast('success', 'Export CSV telecharge');
  }, [employees, addToast]);

  const handleExportJSON = useCallback(() => {
    const json = exportHorairesToJSON(MOCK_HORAIRES_FIXES, employees);
    downloadFile(json, 'equipe-horaires-fixes.json', 'application/json');
    addToast('success', 'Export JSON telecharge');
  }, [employees, addToast]);

  // Initials helper
  const getInitials = (fn: string, ln: string) => `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();

  if (orgLoading || isLoading) {
    return (
      <div className="eq-loading">
        <span className="eq-spinner" />
        <span>Chargement de l&apos;equipe...</span>
        <style jsx>{`
          .eq-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 400px; color: var(--color-neutral-500); }
          .eq-spinner { width: 32px; height: 32px; border: 3px solid var(--color-neutral-200); border-top-color: var(--color-primary-500); border-radius: 50%; animation: eqspin 0.8s linear infinite; }
          @keyframes eqspin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="eq-page">
        {/* Header */}
        <div className="eq-header">
          <div className="eq-header-top">
            <h1 className="eq-title">Equipe &amp; Horaires Fixes</h1>
            <div className="eq-actions">
              <button className="eq-btn eq-btn--outline" onClick={handleExportCSV} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
              <button className="eq-btn eq-btn--outline" onClick={handleExportJSON} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export JSON
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="eq-filters">
            <div className="eq-search-wrap">
              <svg className="eq-search-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                className="eq-search"
                placeholder="Rechercher un employe..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="eq-search-clear" onClick={() => setSearchTerm('')} type="button">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            <select
              className="eq-filter-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as EmployeeCategory | 'all')}
            >
              <option value="all">Tous les roles</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <div className="eq-count">{filteredEmployees.length} employe{filteredEmployees.length > 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Table */}
        <div className="eq-table-wrap">
          <table className="eq-table">
            <thead>
              <tr>
                <th className="eq-th eq-th--sortable" onClick={() => handleSort('nom')}>
                  Employe {sortField === 'nom' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="eq-th eq-th--sortable" onClick={() => handleSort('role')}>
                  Role {sortField === 'role' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="eq-th">Horaires fixes</th>
                <th className="eq-th eq-th--sortable" onClick={() => handleSort('heures')}>
                  Contrat {sortField === 'heures' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="eq-th eq-th--sortable" onClick={() => handleSort('contrat')}>
                  Type {sortField === 'contrat' && (sortOrder === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="eq-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => {
                const horaires = getFixedForEmployee(MOCK_HORAIRES_FIXES, emp.id);
                const catCfg = CATEGORY_CONFIG[emp.category];
                const totalWeeklyHours = horaires.reduce((sum, h) => {
                  const [sh, sm] = h.start_time.split(':').map(Number);
                  const [eh, em] = h.end_time.split(':').map(Number);
                  return sum + ((eh * 60 + em) - (sh * 60 + sm) - h.break_duration) / 60;
                }, 0);

                // Which days have horaires
                const daysWithHoraires = new Set(horaires.map(h => h.day_of_week));

                return (
                  <tr key={emp.id} className="eq-row">
                    {/* Employee */}
                    <td className="eq-td">
                      <div className="eq-emp-cell">
                        <div className="eq-avatar" style={{ backgroundColor: catCfg.color }}>
                          {getInitials(emp.first_name, emp.last_name)}
                        </div>
                        <div className="eq-emp-info">
                          <span className="eq-emp-name">{emp.first_name} {emp.last_name}</span>
                          <span className="eq-emp-email">{emp.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="eq-td">
                      <span className="eq-role-badge" style={{ borderColor: catCfg.color, color: catCfg.color }}>
                        {catCfg.label}
                      </span>
                    </td>

                    {/* Horaires fixes summary */}
                    <td className="eq-td">
                      {horaires.length > 0 ? (
                        <div className="eq-hf-summary">
                          <div className="eq-hf-days">
                            {DAY_NAMES_SHORT.map((name, idx) => (
                              <span
                                key={idx}
                                className={`eq-hf-day ${daysWithHoraires.has(idx) ? 'eq-hf-day--active' : ''}`}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                          <span className="eq-hf-hours">{Math.round(totalWeeklyHours)}h/sem</span>
                        </div>
                      ) : (
                        <span className="eq-hf-empty">Aucun horaire fixe</span>
                      )}
                    </td>

                    {/* Contract hours */}
                    <td className="eq-td">
                      <span className="eq-contract">{emp.contract_hours}h/sem</span>
                    </td>

                    {/* Contract type */}
                    <td className="eq-td">
                      <span className="eq-contract-type">{CONTRACT_LABELS[emp.contract_type] || emp.contract_type}</span>
                    </td>

                    {/* Actions */}
                    <td className="eq-td">
                      <div className="eq-actions-cell">
                        <Link
                          href={`/equipe/${emp.id}/horaires`}
                          className="eq-action-btn"
                          title="Gerer horaires fixes"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Horaires
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredEmployees.length === 0 && (
            <div className="eq-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div className="eq-empty-text">Aucun employe trouve</div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .eq-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Header */
        .eq-header {
          background: white;
          border-radius: var(--radius-lg);
          padding: 20px;
          border: 1px solid var(--color-neutral-200);
        }

        .eq-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .eq-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: var(--color-neutral-900);
        }

        .eq-actions {
          display: flex;
          gap: 8px;
        }

        .eq-btn {
          padding: 7px 14px;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .eq-btn--outline {
          background: white;
          color: var(--color-neutral-600);
          border: 1px solid var(--color-neutral-300);
        }

        .eq-btn--outline:hover {
          background: var(--color-neutral-50);
          border-color: var(--color-neutral-400);
        }

        /* Filters */
        .eq-filters {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .eq-search-wrap {
          position: relative;
          flex: 1;
          max-width: 300px;
        }

        .eq-search-wrap .eq-search-icon-svg {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--color-neutral-400);
        }

        .eq-search {
          width: 100%;
          padding: 7px 30px 7px 32px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-700);
        }

        .eq-search:focus {
          outline: none;
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        .eq-search-clear {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          padding: 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--color-neutral-400);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .eq-search-clear:hover {
          color: var(--color-neutral-600);
        }

        .eq-filter-select {
          padding: 7px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-700);
          background: white;
          cursor: pointer;
        }

        .eq-count {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-500);
          white-space: nowrap;
        }

        /* Table */
        .eq-table-wrap {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          overflow: hidden;
        }

        .eq-table {
          width: 100%;
          border-collapse: collapse;
        }

        .eq-th {
          padding: 10px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--color-neutral-50);
          border-bottom: 2px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .eq-th--sortable {
          cursor: pointer;
          user-select: none;
          transition: color 0.15s;
        }

        .eq-th--sortable:hover {
          color: var(--color-neutral-800);
        }

        .eq-row {
          border-bottom: 1px solid var(--color-neutral-100);
          transition: background 0.1s;
        }

        .eq-row:hover {
          background: var(--color-neutral-50);
        }

        .eq-td {
          padding: 10px 16px;
          font-size: 13px;
          color: var(--color-neutral-700);
          vertical-align: middle;
        }

        /* Employee cell */
        .eq-emp-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .eq-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }

        .eq-emp-info {
          min-width: 0;
        }

        .eq-emp-name {
          display: block;
          font-weight: 600;
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .eq-emp-email {
          display: block;
          font-size: 11px;
          color: var(--color-neutral-400);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        /* Role badge */
        .eq-role-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: 600;
          background: white;
          border: 1px solid;
          white-space: nowrap;
        }

        /* Horaires fixes summary */
        .eq-hf-summary {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .eq-hf-days {
          display: flex;
          gap: 3px;
        }

        .eq-hf-day {
          width: 28px;
          height: 20px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          background: var(--color-neutral-100);
          color: var(--color-neutral-400);
        }

        .eq-hf-day--active {
          background: rgba(99, 102, 241, 0.12);
          color: #6366f1;
        }

        .eq-hf-hours {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-500);
        }

        .eq-hf-empty {
          font-size: 12px;
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* Contract */
        .eq-contract {
          font-weight: 600;
          color: var(--color-neutral-700);
        }

        .eq-contract-type {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary-600);
        }

        /* Actions */
        .eq-actions-cell {
          display: flex;
          gap: 6px;
        }

        .eq-action-btn {
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--color-neutral-300);
          background: white;
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        .eq-action-btn:hover {
          border-color: var(--color-primary-400);
          color: var(--color-primary-600);
          background: var(--color-primary-50);
        }

        /* Empty */
        .eq-empty {
          padding: 48px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .eq-empty-text {
          font-size: 14px;
          color: var(--color-neutral-500);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .eq-header-top {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .eq-filters {
            flex-wrap: wrap;
          }

          .eq-search-wrap {
            max-width: none;
          }
        }

        @media (max-width: 768px) {
          .eq-table-wrap {
            overflow-x: auto;
          }

          .eq-table {
            min-width: 700px;
          }
        }
      `}</style>
    </>
  );
}
