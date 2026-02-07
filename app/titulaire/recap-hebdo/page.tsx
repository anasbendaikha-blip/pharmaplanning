/**
 * Page Récapitulatif Hebdomadaire
 *
 * Synthèse du planning avec 2 vues :
 *  - Par employé : tableau heures, shifts, conformité, écart objectif
 *  - Par jour : carte par jour avec détail des shifts
 *
 * Navigation semaine, stats globales, boutons export (placeholder).
 *
 * styled-jsx uniquement.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getShiftsForWeek, getEmployees } from '@/lib/supabase/queries';
import { generateWeekSummary } from '@/lib/recap/generator';
import type { WeekSummary } from '@/lib/recap/types';
import {
  getMonday,
  getWeekDates,
  toISODateString,
  addDays,
  getWeekLabel,
  formatDate,
} from '@/lib/utils/dateUtils';
import { formatHours } from '@/lib/utils/hourUtils';
import Link from 'next/link';

type ViewMode = 'employees' | 'days';

export default function RecapHebdoPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();

  // Navigation semaine
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const weekLabel = getWeekLabel(currentMonday);
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
  const weekStart = toISODateString(weekDates[0]);
  const weekEnd = toISODateString(weekDates[6]);

  // Données
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vue
  const [viewMode, setViewMode] = useState<ViewMode>('employees');

  const loadSummary = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const [shifts, employees] = await Promise.all([
        getShiftsForWeek(organizationId, weekStart, weekEnd),
        getEmployees(organizationId),
      ]);

      const result = generateWeekSummary(weekStart, shifts, employees);
      setSummary(result);
    } catch (error) {
      console.error('Erreur chargement récapitulatif:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, weekStart, weekEnd]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadSummary();
  }, [orgLoading, organizationId, loadSummary]);

  // Navigation
  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleToday = () => setCurrentMonday(getMonday(new Date()));
  const todayMonday = getMonday(new Date());
  const isCurrentWeek = toISODateString(currentMonday) === toISODateString(todayMonday);

  // Export placeholders
  const handleExportPDF = () => {
    // TODO: implémenter avec jsPDF
    window.alert('Export PDF sera disponible prochainement (jsPDF)');
  };
  const handleExportExcel = () => {
    // TODO: implémenter avec xlsx
    window.alert('Export Excel sera disponible prochainement (xlsx)');
  };

  if (orgLoading || (isLoading && !summary)) {
    return (
      <>
        <div className="loading-page">
          <span className="loading-spinner" />
          <span>{"Génération du récapitulatif..."}</span>
        </div>
        <style jsx>{`
          .loading-page {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-3);
            height: 400px;
            color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  if (!summary) return null;

  const avgHoursPerEmployee =
    summary.employeeCount > 0
      ? Math.round((summary.totalHours / summary.employeeCount) * 10) / 10
      : 0;

  return (
    <>
      <div className="recap-page">
        {/* ─── En-tête ─── */}
        <section className="page-header">
          <div className="header-left">
            <Link href="/" className="back-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tableau de bord
            </Link>
            <h1 className="page-title">{"Récapitulatif Hebdomadaire"}</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-export" onClick={handleExportPDF}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              PDF
            </button>
            <button type="button" className="btn-export" onClick={handleExportExcel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
              Excel
            </button>
          </div>
        </section>

        {/* ─── Navigation semaine ─── */}
        <section className="week-navigation">
          <button type="button" className="week-nav-btn" onClick={handlePrev} title="Semaine précédente">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="week-info">
            <span className="week-number">Semaine {summary.weekNumber}</span>
            <span className="week-dates">{weekLabel}</span>
          </div>
          <button type="button" className="week-nav-btn" onClick={handleNext} title="Semaine suivante">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {!isCurrentWeek && (
            <button type="button" className="week-today-btn" onClick={handleToday}>
              {"Aujourd'hui"}
            </button>
          )}
        </section>

        {/* ─── Stats globales ─── */}
        <section className="stats-grid">
          <div className="stat-card">
            <svg className="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <div className="stat-content">
              <span className="stat-value">{formatHours(summary.totalHours)}</span>
              <span className="stat-label">Total heures</span>
            </div>
          </div>
          <div className="stat-card">
            <svg className="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div className="stat-content">
              <span className="stat-value">{summary.totalShifts}</span>
              <span className="stat-label">Shifts planifiés</span>
            </div>
          </div>
          <div className="stat-card">
            <svg className="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <div className="stat-content">
              <span className="stat-value">{summary.employeeCount}</span>
              <span className="stat-label">Employés actifs</span>
            </div>
          </div>
          <div className="stat-card">
            <svg className="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <div className="stat-content">
              <span className="stat-value">{formatHours(avgHoursPerEmployee)}</span>
              <span className="stat-label">{"Moyenne / employé"}</span>
            </div>
          </div>
        </section>

        {/* ─── Toggle vue ─── */}
        <section className="view-toggle">
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'employees' ? 'toggle-btn--active' : ''}`}
            onClick={() => setViewMode('employees')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            Par employé
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'days' ? 'toggle-btn--active' : ''}`}
            onClick={() => setViewMode('days')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Par jour
          </button>
        </section>

        {/* ─── Vue par employé ─── */}
        {viewMode === 'employees' && (
          <section className="content-section">
            <h2 className="section-title">Heures par employé</h2>

            {summary.employeeSummaries.length === 0 ? (
              <div className="empty-state">
                <p>Aucun shift planifié cette semaine.</p>
              </div>
            ) : (
              <div className="employees-table-wrapper">
                <table className="employees-table">
                  <thead>
                    <tr>
                      <th className="th-employee">Employé</th>
                      <th>Catégorie</th>
                      <th className="th-center">Heures</th>
                      <th className="th-center">Shifts</th>
                      <th className="th-center">Objectif</th>
                      <th className="th-center">{"Écart"}</th>
                      <th className="th-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.employeeSummaries.map(emp => (
                      <tr key={emp.employeeId} className={!emp.isCompliant ? 'row-warning' : ''}>
                        <td className="cell-employee">
                          <span className="emp-name">{emp.employeeName}</span>
                        </td>
                        <td>
                          <span className="category-badge">{emp.category}</span>
                        </td>
                        <td className="cell-center">
                          <span className="hours-value">{formatHours(emp.totalHours)}</span>
                        </td>
                        <td className="cell-center">{emp.shiftsCount}</td>
                        <td className="cell-center">{emp.weeklyTarget}h</td>
                        <td className="cell-center">
                          <span className={`delta ${emp.hoursDelta > 0 ? 'delta--over' : emp.hoursDelta < 0 ? 'delta--under' : ''}`}>
                            {emp.hoursDelta > 0 ? '+' : ''}{formatHours(emp.hoursDelta)}
                          </span>
                        </td>
                        <td className="cell-center">
                          {emp.isCompliant ? (
                            <span className="status-ok">{'\u2713'} Conforme</span>
                          ) : (
                            <span className="status-warning">{'\u26A0'} {'>'}48h</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ─── Vue par jour ─── */}
        {viewMode === 'days' && (
          <section className="content-section">
            <h2 className="section-title">Planning par jour</h2>
            <div className="days-list">
              {summary.dailySummaries.map(day => (
                <div key={day.date} className="day-card">
                  <div className="day-header">
                    <div className="day-info">
                      <span className="day-name">{day.dayName}</span>
                      <span className="day-date">{formatDate(new Date(day.date + 'T12:00:00'), 'medium')}</span>
                    </div>
                    <div className="day-stats">
                      <span className="day-stat">{formatHours(day.totalHours)}</span>
                      <span className="day-stat-sep">{'\u00B7'}</span>
                      <span className="day-stat">{day.employeesCount} employé{day.employeesCount !== 1 ? 's' : ''}</span>
                      <span className="day-stat-sep">{'\u00B7'}</span>
                      <span className="day-stat">{day.shiftsCount} shift{day.shiftsCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {day.shifts.length > 0 ? (
                    <div className="shifts-list">
                      {day.shifts.map(shift => (
                        <div key={shift.id} className="shift-item">
                          <span className="shift-time">{shift.startTime} - {shift.endTime}</span>
                          <span className="shift-employee">{shift.employeeName}</span>
                          <span className="shift-category">{shift.category}</span>
                          <span className="shift-hours">{formatHours(shift.hours)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-shifts">Aucun shift planifié</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .recap-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
          max-width: 1100px;
        }

        /* ─── Header ─── */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .header-left :global(.back-link) {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-1);
          font-size: var(--font-size-xs);
          color: var(--color-primary-600);
          text-decoration: none;
          margin-bottom: var(--spacing-2);
        }

        .header-left :global(.back-link:hover) {
          color: var(--color-primary-700);
        }

        .page-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: var(--spacing-2);
        }

        .btn-export {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-export:hover {
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
          background: var(--color-primary-50);
        }

        /* ─── Week nav ─── */
        .week-navigation {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
        }

        .week-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          cursor: pointer;
          color: var(--color-neutral-600);
          transition: all 0.15s ease;
        }

        .week-nav-btn:hover {
          background: var(--color-neutral-50);
          border-color: var(--color-neutral-300);
        }

        .week-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .week-number {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .week-dates {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }

        .week-today-btn {
          padding: 6px 14px;
          background: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .week-today-btn:hover {
          background: var(--color-primary-700);
        }

        /* ─── Stats grid ─── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-4);
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          transition: all 0.15s ease;
        }

        .stat-card:hover {
          border-color: var(--color-primary-200);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-value {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
          line-height: 1.2;
        }

        .stat-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
        }

        /* ─── View toggle ─── */
        .view-toggle {
          display: flex;
          gap: var(--spacing-2);
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:hover {
          border-color: var(--color-neutral-300);
        }

        .toggle-btn--active {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
        }

        .toggle-btn--active:hover {
          background: var(--color-primary-700);
          border-color: var(--color-primary-700);
        }

        /* ─── Content section ─── */
        .content-section {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-5);
        }

        .section-title {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0 0 var(--spacing-4) 0;
        }

        .empty-state {
          text-align: center;
          padding: var(--spacing-8);
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* ─── Employee table ─── */
        .employees-table-wrapper {
          overflow-x: auto;
        }

        .employees-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .employees-table th {
          text-align: left;
          padding: var(--spacing-3) var(--spacing-3);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 2px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .th-employee {
          min-width: 160px;
        }

        .th-center {
          text-align: center !important;
        }

        .employees-table td {
          padding: var(--spacing-3);
          border-bottom: 1px solid var(--color-neutral-100);
          vertical-align: middle;
        }

        .employees-table tbody tr:hover {
          background: var(--color-neutral-50);
        }

        .employees-table :global(.row-warning) {
          background: var(--color-warning-50);
        }

        .cell-employee {
          min-width: 160px;
        }

        .emp-name {
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
        }

        .category-badge {
          display: inline-block;
          padding: 2px 8px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          white-space: nowrap;
        }

        .cell-center {
          text-align: center;
        }

        .hours-value {
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
        }

        .delta {
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-xs);
        }

        .delta--over {
          color: var(--color-warning-600);
        }

        .delta--under {
          color: var(--color-neutral-500);
        }

        .status-ok {
          color: var(--color-success-600);
          font-weight: var(--font-weight-medium);
          font-size: var(--font-size-xs);
        }

        .status-warning {
          display: inline-block;
          padding: 2px 8px;
          background: var(--color-warning-100);
          color: var(--color-warning-700);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-weight-bold);
        }

        /* ─── Days view ─── */
        .days-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
        }

        .day-card {
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: var(--spacing-4);
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-3);
        }

        .day-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .day-name {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .day-date {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }

        .day-stats {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .day-stat {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
        }

        .day-stat-sep {
          color: var(--color-neutral-300);
        }

        .shifts-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .shift-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
        }

        .shift-time {
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-800);
          min-width: 110px;
        }

        .shift-employee {
          flex: 1;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          font-size: var(--font-size-sm);
        }

        .shift-category {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .shift-hours {
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
          font-size: var(--font-size-sm);
        }

        .no-shifts {
          text-align: center;
          padding: var(--spacing-4);
          color: var(--color-neutral-400);
          font-style: italic;
          font-size: var(--font-size-sm);
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .page-header {
            flex-direction: column;
          }
          .week-navigation {
            flex-wrap: wrap;
          }
          .day-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-2);
          }
        }
      `}</style>
    </>
  );
}
