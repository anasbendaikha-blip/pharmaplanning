/**
 * Page Calendrier Annuel des Conges
 *
 * Vue annuelle sur 12 mois avec barres de conges colorees par type.
 * Tous les employes visibles simultanement, filtres, stats et export PDF.
 *
 * styled-jsx uniquement, CSS variables, pas de date-fns.
 */
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types & constantes ───

interface AnnualLeave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  business_days: number;
  notes: string | null;
  employee: {
    name: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface AnnualEmployee {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface AnnualStats {
  total: number;
  byType: Record<string, number>;
  byMonth: number[];
  totalDays: number;
}

const LEAVE_TYPES: Record<string, string> = {
  conge_paye: 'Conge paye',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  autre: 'Autre',
};

const LEAVE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  conge_paye: { bg: 'var(--color-primary-50)', text: 'var(--color-primary-700)', bar: 'var(--color-primary-500)' },
  rtt: { bg: '#ede9fe', text: '#7c3aed', bar: '#8b5cf6' },
  maladie: { bg: 'var(--color-danger-50)', text: 'var(--color-danger-700)', bar: 'var(--color-danger-500)' },
  sans_solde: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-700)', bar: 'var(--color-neutral-500)' },
  formation: { bg: 'var(--color-warning-50)', text: 'var(--color-warning-700)', bar: 'var(--color-warning-500)' },
  autre: { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary-700)', bar: 'var(--color-secondary-500)' },
};

const MONTHS_FR = [
  'Janv.', 'Fevr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Aout', 'Sept.', 'Oct.', 'Nov.', 'Dec.',
];

const MONTHS_FULL = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

// ─── Helpers ───

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getEmployeeDisplayName(emp: AnnualEmployee): string {
  if (emp.first_name || emp.last_name) {
    return `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  }
  return emp.name || 'Inconnu';
}

/** Compute bar position within a month cell (percentage offsets) */
function computeBarPosition(
  leave: AnnualLeave,
  year: number,
  monthIndex: number,
): { left: number; width: number } | null {
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex, daysInMonth);

  const leaveStart = new Date(leave.start_date + 'T12:00:00');
  const leaveEnd = new Date(leave.end_date + 'T12:00:00');

  // Check overlap
  if (leaveEnd < monthStart || leaveStart > monthEnd) return null;

  const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
  const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

  const startDay = effectiveStart.getDate();
  const endDay = effectiveEnd.getDate();

  const left = ((startDay - 1) / daysInMonth) * 100;
  const width = ((endDay - startDay + 1) / daysInMonth) * 100;

  return { left, width: Math.max(width, 2) }; // min 2% visibility
}

// ─── Composant ───

export default function CongesAnnuelPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const printRef = useRef<HTMLDivElement>(null);

  // Annee en cours
  const [year, setYear] = useState(new Date().getFullYear());

  // Donnees
  const [leaves, setLeaves] = useState<AnnualLeave[]>([]);
  const [employees, setEmployees] = useState<AnnualEmployee[]>([]);
  const [stats, setStats] = useState<AnnualStats>({ total: 0, byType: {}, byMonth: Array(12).fill(0), totalDays: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filtres
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('approved');

  // Tooltip
  const [tooltip, setTooltip] = useState<{ leave: AnnualLeave; x: number; y: number } | null>(null);

  // ─── Chargement ───

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        organizationId,
        year: String(year),
      });

      if (filterEmployee !== 'all') params.set('employeeId', filterEmployee);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/leaves/annual?${params.toString()}`);

      if (!res.ok) throw new Error('Erreur chargement');

      const data = await res.json();
      setLeaves(data.leaves || []);
      setEmployees(data.employees || []);
      setStats(data.stats || { total: 0, byType: {}, byMonth: Array(12).fill(0), totalDays: 0 });
    } catch (error) {
      console.error('Erreur chargement conges annuels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, year, filterEmployee, filterType, filterStatus]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadData();
  }, [orgLoading, organizationId, loadData]);

  // ─── Donnees groupees par employe ───

  const employeesWithLeaves = useMemo(() => {
    // Build map of employee leaves
    const empLeavesMap = new Map<string, AnnualLeave[]>();

    for (const leave of leaves) {
      if (!empLeavesMap.has(leave.employee_id)) {
        empLeavesMap.set(leave.employee_id, []);
      }
      empLeavesMap.get(leave.employee_id)!.push(leave);
    }

    // Build display list: employees with at least one leave, sorted by name
    const result: Array<{
      employee: AnnualEmployee;
      leaves: AnnualLeave[];
      totalDays: number;
    }> = [];

    // Determine which employees to show
    const employeesToShow = filterEmployee === 'all'
      ? employees
      : employees.filter(e => e.id === filterEmployee);

    for (const emp of employeesToShow) {
      const empLeaves = empLeavesMap.get(emp.id) || [];
      // Show employee even if no leaves (for reference)
      result.push({
        employee: emp,
        leaves: empLeaves,
        totalDays: empLeaves.reduce((sum, l) => sum + (l.business_days || 0), 0),
      });
    }

    // Sort: employees with leaves first, then alphabetically
    result.sort((a, b) => {
      if (a.leaves.length > 0 && b.leaves.length === 0) return -1;
      if (a.leaves.length === 0 && b.leaves.length > 0) return 1;
      return getEmployeeDisplayName(a.employee).localeCompare(getEmployeeDisplayName(b.employee));
    });

    return result;
  }, [leaves, employees, filterEmployee]);

  // ─── Navigation annee ───

  const handlePrevYear = () => setYear(y => y - 1);
  const handleNextYear = () => setYear(y => y + 1);
  const handleCurrentYear = () => setYear(new Date().getFullYear());

  // ─── Export PDF ───

  const handlePrint = () => {
    window.print();
  };

  // ─── Tooltip handlers ───

  const handleBarHover = (leave: AnnualLeave, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      leave,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleBarLeave = () => {
    setTooltip(null);
  };

  // ─── Mois le plus charge ───

  const busiestMonth = useMemo(() => {
    const maxIdx = stats.byMonth.indexOf(Math.max(...stats.byMonth));
    return stats.byMonth[maxIdx] > 0 ? MONTHS_FULL[maxIdx] : '-';
  }, [stats.byMonth]);

  // ─── Rendu ───

  if (orgLoading || (isLoading && leaves.length === 0)) {
    return (
      <>
        <div className="loading-page">
          <span className="loading-spinner" />
          <span>Chargement du calendrier annuel...</span>
        </div>
        <style jsx>{`
          .loading-page {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: var(--spacing-3); height: 400px; color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 36px; height: 36px; border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500); border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="annual-page" ref={printRef}>
        {/* ─── Header ─── */}
        <section className="page-header">
          <div className="header-left">
            <Link href="/" className="back-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tableau de bord
            </Link>
            <h1 className="page-title">Calendrier Annuel des Conges</h1>
            <p className="page-subtitle">Vue d&#39;ensemble de toutes les absences sur l&#39;annee {year}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-outline" onClick={handlePrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Exporter PDF
            </button>
            <Link href="/calendrier-conges" className="btn-secondary-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Vue mensuelle
            </Link>
          </div>
        </section>

        {/* ─── Navigation annee ─── */}
        <section className="year-navigation">
          <button type="button" className="nav-btn" onClick={handlePrevYear}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="year-center">
            <h2 className="year-title">{year}</h2>
            {year !== new Date().getFullYear() && (
              <button type="button" className="today-btn" onClick={handleCurrentYear}>
                Aujourd&#39;hui
              </button>
            )}
          </div>
          <button type="button" className="nav-btn" onClick={handleNextYear}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </section>

        {/* ─── Stats ─── */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total conges</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.totalDays}j</span>
            <span className="stat-label">Jours d&#39;absence</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{employeesWithLeaves.filter(e => e.leaves.length > 0).length}</span>
            <span className="stat-label">Employes concernes</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-value--accent">{busiestMonth}</span>
            <span className="stat-label">Mois le plus charge</span>
          </div>
        </section>

        {/* ─── Filtres ─── */}
        <section className="filters-section">
          <div className="filter-group">
            <label htmlFor="filter-employee" className="filter-label">Employe</label>
            <select
              id="filter-employee"
              className="filter-select"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="all">Tous les employes</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {getEmployeeDisplayName(emp)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-type" className="filter-label">Type</label>
            <select
              id="filter-type"
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tous les types</option>
              {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-status" className="filter-label">Statut</label>
            <select
              id="filter-status"
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="approved">Approuve</option>
              <option value="pending">En attente</option>
              <option value="rejected">Refuse</option>
            </select>
          </div>
        </section>

        {/* ─── Legende ─── */}
        <section className="legend-section">
          {Object.entries(LEAVE_TYPES).map(([key, label]) => {
            const colors = LEAVE_COLORS[key];
            return (
              <div key={key} className="legend-item">
                <span
                  className="legend-color"
                  style={{ backgroundColor: colors?.bar || 'var(--color-neutral-400)' }}
                />
                <span className="legend-label">{label}</span>
                {stats.byType[key] ? (
                  <span className="legend-count">{stats.byType[key]}</span>
                ) : null}
              </div>
            );
          })}
        </section>

        {/* ─── Grille calendrier ─── */}
        <section className="calendar-section">
          <div className="calendar-grid">
            {/* Header: mois */}
            <div className="grid-header">
              <div className="grid-header-employee">Employe</div>
              {MONTHS_FR.map((m, i) => (
                <div key={i} className="grid-header-month">
                  {m}
                </div>
              ))}
              <div className="grid-header-total">Total</div>
            </div>

            {/* Body: lignes employes */}
            {employeesWithLeaves.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="empty-text">Aucun conge trouve pour {year}</p>
              </div>
            ) : (
              employeesWithLeaves.map(({ employee, leaves: empLeaves, totalDays }) => (
                <div key={employee.id} className="grid-row">
                  <div className="grid-cell-employee" title={getEmployeeDisplayName(employee)}>
                    <span className="emp-name">{getEmployeeDisplayName(employee)}</span>
                    <span className="emp-role">{employee.role}</span>
                  </div>

                  {Array.from({ length: 12 }, (_, monthIndex) => (
                    <div key={monthIndex} className="grid-cell-month">
                      {empLeaves.map(leave => {
                        const pos = computeBarPosition(leave, year, monthIndex);
                        if (!pos) return null;
                        const colors = LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre;
                        return (
                          <div
                            key={`${leave.id}-${monthIndex}`}
                            className="leave-bar"
                            style={{
                              left: `${pos.left}%`,
                              width: `${pos.width}%`,
                              backgroundColor: colors.bar,
                            }}
                            onMouseEnter={(e) => handleBarHover(leave, e)}
                            onMouseLeave={handleBarLeave}
                            title={`${LEAVE_TYPES[leave.type] || leave.type}: ${leave.start_date} - ${leave.end_date}`}
                          />
                        );
                      })}
                    </div>
                  ))}

                  <div className="grid-cell-total">
                    {totalDays > 0 ? `${totalDays}j` : '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ─── Repartition par mois (mini chart) ─── */}
        <section className="monthly-chart">
          <h3 className="section-title">Repartition mensuelle</h3>
          <div className="chart-bars">
            {stats.byMonth.map((count, i) => {
              const maxCount = Math.max(...stats.byMonth, 1);
              const heightPct = (count / maxCount) * 100;
              return (
                <div key={i} className="chart-col">
                  <div className="chart-bar-wrapper">
                    <div
                      className="chart-bar"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="chart-label">{MONTHS_FR[i]}</span>
                  {count > 0 && <span className="chart-value">{count}</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Detail par type ─── */}
        {Object.keys(stats.byType).length > 0 && (
          <section className="type-breakdown">
            <h3 className="section-title">Detail par type de conge</h3>
            <div className="type-grid">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const colors = LEAVE_COLORS[type] || LEAVE_COLORS.autre;
                  const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={type} className="type-card">
                      <div className="type-header">
                        <span className="type-dot" style={{ backgroundColor: colors.bar }} />
                        <span className="type-name">{LEAVE_TYPES[type] || type}</span>
                      </div>
                      <div className="type-stats">
                        <span className="type-count">{count}</span>
                        <span className="type-pct">{percentage}%</span>
                      </div>
                      <div className="type-progress-track">
                        <div
                          className="type-progress-fill"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: colors.bar,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </div>

      {/* ─── Tooltip ─── */}
      {tooltip && (
        <div
          className="leave-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          <div className="tooltip-header">
            <span className="tooltip-type">{LEAVE_TYPES[tooltip.leave.type] || tooltip.leave.type}</span>
          </div>
          <div className="tooltip-body">
            <span>{tooltip.leave.employee.name}</span>
            <span className="tooltip-dates">
              {new Date(tooltip.leave.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {' - '}
              {new Date(tooltip.leave.end_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="tooltip-days">{tooltip.leave.business_days || 0} jour{(tooltip.leave.business_days || 0) !== 1 ? 's' : ''} ouvre{(tooltip.leave.business_days || 0) !== 1 ? 's' : ''}</span>
          </div>
          {tooltip.leave.notes && (
            <div className="tooltip-notes">{tooltip.leave.notes}</div>
          )}
        </div>
      )}

      <style jsx>{`
        /* ─── Page layout ─── */
        .annual-page { display: flex; flex-direction: column; gap: var(--spacing-6); }

        /* ─── Header ─── */
        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: var(--spacing-3);
        }
        .header-left { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .header-left :global(.back-link) {
          display: inline-flex; align-items: center; gap: var(--spacing-1);
          font-size: var(--font-size-xs); color: var(--color-primary-600);
          text-decoration: none; margin-bottom: var(--spacing-2);
        }
        .header-left :global(.back-link:hover) { color: var(--color-primary-700); }
        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .page-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        .header-actions { display: flex; gap: var(--spacing-2); flex-wrap: wrap; }
        .btn-outline {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700); cursor: pointer; transition: all 0.15s ease;
        }
        .btn-outline:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-400); }
        .header-actions :global(.btn-secondary-link) {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          background: var(--color-primary-600); border: 1px solid var(--color-primary-600);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          color: white; text-decoration: none; transition: all 0.15s ease;
        }
        .header-actions :global(.btn-secondary-link:hover) { background: var(--color-primary-700); }

        /* ─── Year nav ─── */
        .year-navigation {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; color: var(--color-neutral-600); transition: all 0.15s ease;
        }
        .nav-btn:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-300); }
        .year-center { display: flex; align-items: center; gap: var(--spacing-3); }
        .year-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .today-btn {
          padding: var(--spacing-1) var(--spacing-3);
          background: var(--color-primary-50); border: 1px solid var(--color-primary-200);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-primary-700); cursor: pointer; transition: all 0.15s ease;
        }
        .today-btn:hover { background: var(--color-primary-100); }

        /* ─── Stats ─── */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-4); }
        .stat-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-4); background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
        }
        .stat-value { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-600); }
        .stat-value--accent { font-size: var(--font-size-base); color: var(--color-warning-600); }
        .stat-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-neutral-500); text-align: center; }

        /* ─── Filters ─── */
        .filters-section {
          display: flex; gap: var(--spacing-4); flex-wrap: wrap;
          padding: var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .filter-group { display: flex; flex-direction: column; gap: var(--spacing-1); flex: 1; min-width: 180px; }
        .filter-label {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600); text-transform: uppercase; letter-spacing: 0.03em;
        }
        .filter-select {
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); color: var(--color-neutral-700);
          background: white; transition: border-color 0.15s ease; cursor: pointer;
        }
        .filter-select:focus { outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100); }

        /* ─── Legend ─── */
        .legend-section {
          display: flex; flex-wrap: wrap; gap: var(--spacing-4);
          padding: var(--spacing-3) var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
        }
        .legend-item { display: flex; align-items: center; gap: var(--spacing-2); }
        .legend-color { width: 14px; height: 14px; border-radius: var(--radius-sm); flex-shrink: 0; }
        .legend-label { font-size: var(--font-size-xs); color: var(--color-neutral-600); font-weight: var(--font-weight-medium); }
        .legend-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 18px; padding: 0 4px;
          background: var(--color-neutral-100); border-radius: var(--radius-full);
          font-size: 11px; font-weight: var(--font-weight-bold); color: var(--color-neutral-600);
        }

        /* ─── Calendar grid ─── */
        .calendar-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .calendar-grid { overflow-x: auto; }

        .grid-header {
          display: grid; grid-template-columns: 180px repeat(12, 1fr) 60px;
          border-bottom: 2px solid var(--color-neutral-200);
          background: var(--color-neutral-50); position: sticky; top: 0; z-index: 1;
        }
        .grid-header-employee {
          padding: var(--spacing-3) var(--spacing-4);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700); text-transform: uppercase; letter-spacing: 0.03em;
          border-right: 1px solid var(--color-neutral-200);
        }
        .grid-header-month {
          padding: var(--spacing-3) var(--spacing-2);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-600); text-align: center;
          border-right: 1px solid var(--color-neutral-100);
        }
        .grid-header-total {
          padding: var(--spacing-3) var(--spacing-2);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700); text-align: center;
        }

        .grid-row {
          display: grid; grid-template-columns: 180px repeat(12, 1fr) 60px;
          border-bottom: 1px solid var(--color-neutral-100);
          transition: background-color 0.1s ease;
        }
        .grid-row:hover { background-color: var(--color-neutral-50); }
        .grid-row:last-child { border-bottom: none; }

        .grid-cell-employee {
          display: flex; flex-direction: column; justify-content: center;
          gap: 2px; padding: var(--spacing-2) var(--spacing-4);
          border-right: 1px solid var(--color-neutral-200);
          min-height: 44px; overflow: hidden;
        }
        .emp-name {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800); white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis;
        }
        .emp-role {
          font-size: 11px; color: var(--color-neutral-400);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .grid-cell-month {
          position: relative; padding: var(--spacing-2) 2px;
          border-right: 1px solid var(--color-neutral-100);
          min-height: 44px; display: flex; flex-direction: column;
          justify-content: center; gap: 2px;
        }

        .leave-bar {
          position: absolute; height: 8px; border-radius: 4px;
          top: 50%; transform: translateY(-50%);
          cursor: pointer; transition: opacity 0.15s ease, height 0.15s ease;
          opacity: 0.85; z-index: 1;
        }
        .leave-bar:hover { opacity: 1; height: 12px; z-index: 2; }

        .grid-cell-total {
          display: flex; align-items: center; justify-content: center;
          font-size: var(--font-size-sm); font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
        }

        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--spacing-3); padding: var(--spacing-10);
          text-align: center;
        }
        .empty-text { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        /* ─── Monthly chart ─── */
        .monthly-chart {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-5);
        }
        .section-title {
          font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800); margin: 0 0 var(--spacing-4);
        }
        .chart-bars {
          display: grid; grid-template-columns: repeat(12, 1fr);
          gap: var(--spacing-2); align-items: end;
        }
        .chart-col {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--spacing-1);
        }
        .chart-bar-wrapper {
          width: 100%; height: 100px;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .chart-bar {
          width: 70%; min-height: 2px;
          background: var(--color-primary-400); border-radius: 3px 3px 0 0;
          transition: height 0.3s ease;
        }
        .chart-label {
          font-size: 10px; color: var(--color-neutral-500);
          font-weight: var(--font-weight-medium); text-align: center;
        }
        .chart-value {
          font-size: 11px; color: var(--color-primary-600);
          font-weight: var(--font-weight-bold);
        }

        /* ─── Type breakdown ─── */
        .type-breakdown {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-5);
        }
        .type-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: var(--spacing-3);
        }
        .type-card {
          padding: var(--spacing-3); border: 1px solid var(--color-neutral-100);
          border-radius: var(--radius-md); display: flex; flex-direction: column;
          gap: var(--spacing-2);
        }
        .type-header { display: flex; align-items: center; gap: var(--spacing-2); }
        .type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .type-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700); }
        .type-stats { display: flex; justify-content: space-between; align-items: baseline; }
        .type-count { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .type-pct { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .type-progress-track {
          height: 4px; background: var(--color-neutral-100); border-radius: 2px;
          overflow: hidden;
        }
        .type-progress-fill {
          height: 100%; border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* ─── Tooltip ─── */
        .leave-tooltip {
          position: fixed; z-index: 1000;
          transform: translate(-50%, -100%);
          background: var(--color-neutral-900); color: white;
          border-radius: var(--radius-md); padding: var(--spacing-3);
          box-shadow: var(--shadow-lg); pointer-events: none;
          min-width: 180px; max-width: 280px;
        }
        .tooltip-header {
          margin-bottom: var(--spacing-2);
        }
        .tooltip-type {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          text-transform: uppercase; letter-spacing: 0.03em;
          opacity: 0.8;
        }
        .tooltip-body {
          display: flex; flex-direction: column; gap: 2px;
          font-size: var(--font-size-sm);
        }
        .tooltip-dates { font-size: var(--font-size-xs); opacity: 0.7; }
        .tooltip-days { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-primary-300); }
        .tooltip-notes {
          margin-top: var(--spacing-2); padding-top: var(--spacing-2);
          border-top: 1px solid rgba(255,255,255,0.1);
          font-size: var(--font-size-xs); font-style: italic; opacity: 0.6;
        }

        /* ─── Print styles ─── */
        @media print {
          .page-header,
          .filters-section,
          .header-actions,
          .nav-btn,
          .today-btn { display: none !important; }

          .annual-page { gap: var(--spacing-3); }
          .stats-grid { break-inside: avoid; }
          .calendar-section { break-inside: avoid; }
          .monthly-chart { break-inside: avoid; }
          .type-breakdown { break-inside: avoid; }
          .leave-tooltip { display: none !important; }

          .grid-row:hover { background-color: transparent; }
          .leave-bar:hover { height: 8px; }
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .page-header { flex-direction: column; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .filters-section { flex-direction: column; }
          .filter-group { min-width: 0; }
          .legend-section { gap: var(--spacing-3); }
          .chart-bars { grid-template-columns: repeat(6, 1fr); }
          .chart-bar-wrapper { height: 60px; }
          .type-grid { grid-template-columns: 1fr; }

          .grid-header,
          .grid-row {
            grid-template-columns: 120px repeat(12, minmax(40px, 1fr)) 50px;
          }
          .grid-header-month { font-size: 10px; padding: var(--spacing-2) 1px; }
          .grid-cell-employee { padding: var(--spacing-2); }
          .emp-name { font-size: var(--font-size-xs); }
        }

        @media (max-width: 640px) {
          .header-actions { width: 100%; }
          .btn-outline { flex: 1; justify-content: center; }
          .header-actions :global(.btn-secondary-link) { flex: 1; justify-content: center; }

          .grid-header,
          .grid-row {
            grid-template-columns: 90px repeat(12, minmax(30px, 1fr)) 40px;
          }
          .grid-header-month { font-size: 9px; }
          .grid-cell-employee { padding: var(--spacing-1); }
          .emp-name { font-size: 11px; }
          .emp-role { display: none; }
        }
      `}</style>
    </>
  );
}
