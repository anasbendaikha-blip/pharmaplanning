/**
 * Page Récapitulatif Unifiée — Planning V2
 *
 * 3 onglets :
 *  - Synthèse : stats globales, vues par employé/jour, export PDF/Excel
 *  - Hebdomadaire : tableau heures Lun-Dim par employé
 *  - Mensuel : coming soon
 *
 * styled-jsx uniquement — préfixe rc-
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
import type { Employee, Shift } from '@/lib/types';
import { exportRecapPDF } from '@/lib/export/pdf-generator';
import { exportRecapExcel } from '@/lib/export/excel-generator';

// ═══════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════

type RecapTab = 'synthese' | 'hebdomadaire' | 'mensuel';

const TABS: { id: RecapTab; label: string; icon: string }[] = [
  { id: 'synthese', label: 'Synthèse', icon: '📈' },
  { id: 'hebdomadaire', label: 'Hebdomadaire', icon: '📅' },
  { id: 'mensuel', label: 'Mensuel', icon: '📆' },
];

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type SyntheseView = 'employees' | 'days';

// ═══════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════

export default function RecapPage() {
  const { organizationId, organization, isLoading: orgLoading } = useOrganization();
  const pharmacyName = organization?.name || 'Pharmacie';

  // Tab
  const [activeTab, setActiveTab] = useState<RecapTab>('synthese');

  // Week navigation
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const weekLabel = getWeekLabel(currentMonday);
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
  const weekStart = toISODateString(weekDates[0]);
  const weekEnd = toISODateString(weekDates[6]);
  const todayMonday = getMonday(new Date());
  const isCurrentWeek = toISODateString(currentMonday) === toISODateString(todayMonday);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Synthese sub-view
  const [synView, setSynView] = useState<SyntheseView>('employees');

  // Load data
  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const [emps, shfs] = await Promise.all([
        getEmployees(organizationId),
        getShiftsForWeek(organizationId, weekStart, weekEnd),
      ]);
      setEmployees(emps);
      setShifts(shfs);
      const result = generateWeekSummary(weekStart, shfs, emps);
      setSummary(result);
    } catch (err) {
      console.error('Erreur chargement recap:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, weekStart, weekEnd]);

  useEffect(() => {
    if (!orgLoading && organizationId) fetchData();
  }, [orgLoading, organizationId, fetchData]);

  // Navigation
  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleToday = () => setCurrentMonday(getMonday(new Date()));

  // Export
  const handleExportPDF = () => {
    if (!summary) return;
    exportRecapPDF(summary, pharmacyName);
  };
  const handleExportExcel = () => {
    if (!summary) return;
    exportRecapExcel(summary, pharmacyName);
  };

  // Hebdo table data
  const recapData = useMemo(() => {
    return employees.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id);
      const dayHours = weekDates.map(d => {
        const dateStr = toISODateString(d);
        const dayShifts = empShifts.filter(s => s.date === dateStr);
        return dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);
      });
      const totalHours = dayHours.reduce((sum, h) => sum + h, 0);
      return { employee: emp, dayHours, totalHours };
    }).filter(r => r.totalHours > 0 || employees.length <= 30);
  }, [employees, shifts, weekDates]);

  // Loading
  if (orgLoading || (isLoading && !summary)) {
    return (
      <>
        <div className="rc-loading">
          <span className="rc-spinner" />
          <span>Chargement du récapitulatif...</span>
        </div>
        <style jsx>{`
          .rc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 400px; color: var(--color-neutral-500); }
          .rc-spinner { width: 32px; height: 32px; border: 3px solid var(--color-neutral-200); border-top-color: var(--color-primary-500); border-radius: 50%; animation: rcspin 0.8s linear infinite; }
          @keyframes rcspin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  const avgHoursPerEmployee =
    summary && summary.employeeCount > 0
      ? Math.round((summary.totalHours / summary.employeeCount) * 10) / 10
      : 0;

  return (
    <>
      <div className="rc-page">
        {/* ─── Header ─── */}
        <div className="rc-header">
          <div className="rc-header-top">
            <div className="rc-header-left">
              <h1 className="rc-title">Récapitulatif</h1>
              <span className="rc-subtitle">{pharmacyName}</span>
            </div>
            <div className="rc-header-actions">
              <button className="rc-btn rc-btn--outline" onClick={handleExportPDF} type="button" disabled={!summary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                PDF
              </button>
              <button className="rc-btn rc-btn--outline" onClick={handleExportExcel} type="button" disabled={!summary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Excel
              </button>
            </div>
          </div>

          {/* Week navigation */}
          <div className="rc-week-nav">
            <button type="button" className="rc-nav-btn" onClick={handlePrev} title="Semaine précédente">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="rc-week-info">
              {summary && <span className="rc-week-num">Semaine {summary.weekNumber}</span>}
              <span className="rc-week-label">{weekLabel}</span>
            </div>
            <button type="button" className="rc-nav-btn" onClick={handleNext} title="Semaine suivante">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {!isCurrentWeek && (
              <button type="button" className="rc-today-btn" onClick={handleToday}>
                Aujourd&apos;hui
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="rc-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`rc-tab ${activeTab === tab.id ? 'rc-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <span className="rc-tab-icon">{tab.icon}</span>
                <span className="rc-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="rc-content">
          {activeTab === 'synthese' && summary && (
            <SyntheseTab
              summary={summary}
              avgHoursPerEmployee={avgHoursPerEmployee}
              synView={synView}
              setSynView={setSynView}
            />
          )}
          {activeTab === 'hebdomadaire' && (
            <HebdoTab
              recapData={recapData}
              weekDates={weekDates}
            />
          )}
          {activeTab === 'mensuel' && <MensuelTab />}
        </div>
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════ */
        /* Récapitulatif Page — rc- prefix        */
        /* ═══════════════════════════════════════ */

        .rc-page {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-width: 1100px;
        }

        /* Loading */
        .rc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 400px; color: var(--color-neutral-500); }
        .rc-spinner { width: 32px; height: 32px; border: 3px solid var(--color-neutral-200); border-top-color: var(--color-primary-500); border-radius: 50%; animation: rcspin 0.8s linear infinite; }
        @keyframes rcspin { to { transform: rotate(360deg); } }

        /* Header */
        .rc-header {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          overflow: hidden;
        }

        .rc-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 12px;
        }

        .rc-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .rc-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: var(--color-neutral-900);
        }

        .rc-subtitle {
          font-size: 12px;
          color: var(--color-neutral-400);
        }

        .rc-header-actions {
          display: flex;
          gap: 8px;
        }

        /* Buttons */
        .rc-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .rc-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rc-btn--outline {
          background: white;
          color: var(--color-neutral-600);
          border: 1px solid var(--color-neutral-300);
        }

        .rc-btn--outline:hover:not(:disabled) {
          background: var(--color-neutral-50);
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
        }

        /* Week navigation */
        .rc-week-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 24px;
        }

        .rc-nav-btn {
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
          transition: all 0.15s;
        }

        .rc-nav-btn:hover {
          background: var(--color-neutral-50);
          border-color: var(--color-neutral-300);
        }

        .rc-week-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }

        .rc-week-num {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .rc-week-label {
          font-size: 12px;
          color: var(--color-neutral-500);
        }

        .rc-today-btn {
          padding: 6px 14px;
          background: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }

        .rc-today-btn:hover {
          background: var(--color-primary-700);
        }

        /* Tabs */
        .rc-tabs {
          display: flex;
          gap: 0;
          border-top: 1px solid var(--color-neutral-100);
          padding: 0 16px;
        }

        .rc-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          border: none;
          background: none;
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-500);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .rc-tab:hover {
          color: var(--color-neutral-700);
          background: var(--color-neutral-50);
        }

        .rc-tab--active {
          color: var(--color-primary-700);
          border-bottom-color: var(--color-primary-600);
        }

        .rc-tab-icon {
          font-size: 14px;
        }

        /* Content */
        .rc-content {
          margin-top: 16px;
        }

        /* ─── Stats grid ─── */
        .rc-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .rc-stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          transition: all 0.15s;
        }

        .rc-stat-card:hover {
          border-color: var(--color-primary-200);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .rc-stat-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .rc-stat-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--color-primary-600);
          line-height: 1.2;
        }

        .rc-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-500);
        }

        /* ─── View toggle ─── */
        .rc-view-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .rc-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s;
        }

        .rc-toggle-btn:hover {
          border-color: var(--color-neutral-300);
        }

        .rc-toggle-btn--active {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
        }

        .rc-toggle-btn--active:hover {
          background: var(--color-primary-700);
          border-color: var(--color-primary-700);
        }

        /* ─── Employee table (synthese) ─── */
        .rc-section {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: 20px;
        }

        .rc-section-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-neutral-800);
          margin: 0 0 16px;
        }

        .rc-emp-table-wrap {
          overflow-x: auto;
        }

        .rc-emp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .rc-emp-table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 2px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .rc-emp-table .rc-th-center {
          text-align: center;
        }

        .rc-emp-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--color-neutral-100);
          vertical-align: middle;
        }

        .rc-emp-table tbody tr:hover {
          background: var(--color-neutral-50);
        }

        .rc-emp-name {
          font-weight: 600;
          color: var(--color-neutral-800);
        }

        .rc-cat-badge {
          display: inline-block;
          padding: 2px 8px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-600);
          white-space: nowrap;
        }

        .rc-cell-center {
          text-align: center;
        }

        .rc-hours-val {
          font-weight: 700;
          color: var(--color-primary-600);
        }

        .rc-delta {
          font-weight: 600;
          font-size: 12px;
        }

        .rc-delta--over {
          color: var(--color-warning-600);
        }

        .rc-delta--under {
          color: var(--color-neutral-500);
        }

        .rc-status-ok {
          color: var(--color-success-600);
          font-weight: 600;
          font-size: 12px;
        }

        .rc-status-warn {
          display: inline-block;
          padding: 2px 8px;
          background: var(--color-warning-100);
          color: var(--color-warning-700);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
        }

        .rc-row-warning {
          background: var(--color-warning-50);
        }

        /* ─── Day cards (synthese days view) ─── */
        .rc-days-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rc-day-card {
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: 16px;
        }

        .rc-day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .rc-day-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rc-day-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .rc-day-date {
          font-size: 13px;
          color: var(--color-neutral-500);
        }

        .rc-day-stats {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rc-day-stat {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-600);
        }

        .rc-day-sep {
          color: var(--color-neutral-300);
        }

        .rc-shifts-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .rc-shift-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
        }

        .rc-shift-time {
          font-weight: 700;
          font-size: 13px;
          color: var(--color-neutral-800);
          min-width: 110px;
        }

        .rc-shift-emp {
          flex: 1;
          font-weight: 600;
          color: var(--color-neutral-700);
          font-size: 13px;
        }

        .rc-shift-cat {
          font-size: 11px;
          color: var(--color-neutral-500);
        }

        .rc-shift-hours {
          font-weight: 700;
          color: var(--color-primary-600);
          font-size: 13px;
        }

        .rc-no-shifts {
          text-align: center;
          padding: 16px;
          color: var(--color-neutral-400);
          font-style: italic;
          font-size: 13px;
        }

        .rc-empty-state {
          text-align: center;
          padding: 32px;
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* ─── Hebdo table ─── */
        .rc-hebdo-wrap {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          overflow-x: auto;
        }

        .rc-hebdo-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .rc-hebdo-table th {
          padding: 10px 12px;
          text-align: center;
          font-weight: 600;
          color: var(--color-neutral-600);
          background: var(--color-neutral-50);
          border-bottom: 2px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .rc-hebdo-table .rc-col-emp {
          text-align: left;
          min-width: 160px;
        }

        .rc-hebdo-table .rc-col-day {
          min-width: 56px;
        }

        .rc-hebdo-day-name {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
        }

        .rc-hebdo-day-date {
          display: block;
          font-size: 11px;
          color: var(--color-neutral-400);
          font-weight: 400;
        }

        .rc-hebdo-table td {
          padding: 8px 12px;
          text-align: center;
          border-bottom: 1px solid var(--color-neutral-100);
          color: var(--color-neutral-700);
        }

        .rc-hebdo-cell-emp {
          text-align: left !important;
        }

        .rc-hebdo-emp-name {
          font-weight: 600;
          color: var(--color-neutral-800);
          display: block;
        }

        .rc-hebdo-emp-role {
          font-size: 11px;
          color: var(--color-neutral-500);
        }

        .rc-hebdo-hours { font-variant-numeric: tabular-nums; }
        .rc-hebdo-hours--empty { color: var(--color-neutral-300); }
        .rc-hebdo-total { font-weight: 700; color: var(--color-neutral-900); }
        .rc-hebdo-contract { color: var(--color-neutral-500); }
        .rc-hebdo-diff { font-weight: 600; }
        .rc-hebdo-diff--over { color: var(--color-warning-600); }
        .rc-hebdo-diff--under { color: var(--color-danger-600); }

        .rc-hebdo-table tbody tr:hover { background: var(--color-neutral-50); }

        .rc-hebdo-empty {
          text-align: center;
          padding: 48px 20px;
          color: var(--color-neutral-400);
        }

        .rc-hebdo-empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

        .rc-hebdo-empty-text {
          font-size: 14px;
        }

        /* ─── Mensuel (coming soon) ─── */
        .rc-mensuel {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .rc-coming-soon {
          text-align: center;
          max-width: 450px;
          padding: 40px;
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
        }

        .rc-coming-icon {
          font-size: 56px;
          margin-bottom: 16px;
        }

        .rc-coming-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-neutral-900);
          margin: 0 0 8px;
        }

        .rc-coming-text {
          font-size: 13px;
          color: var(--color-neutral-500);
          margin: 0 0 16px;
        }

        .rc-features {
          text-align: left;
          font-size: 13px;
          color: var(--color-neutral-600);
          line-height: 1.8;
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .rc-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .rc-header-top {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .rc-week-nav {
            flex-wrap: wrap;
            justify-content: center;
          }

          .rc-day-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }

        @media (max-width: 640px) {
          .rc-stats-grid {
            grid-template-columns: 1fr;
          }

          .rc-tabs {
            overflow-x: auto;
          }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Synthèse
// ═══════════════════════════════════════════════════════

function SyntheseTab({
  summary,
  avgHoursPerEmployee,
  synView,
  setSynView,
}: {
  summary: WeekSummary;
  avgHoursPerEmployee: number;
  synView: SyntheseView;
  setSynView: (v: SyntheseView) => void;
}) {
  return (
    <div className="rc-synthese">
      {/* Stats cards */}
      <div className="rc-stats-grid">
        <div className="rc-stat-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div className="rc-stat-content">
            <span className="rc-stat-value">{formatHours(summary.totalHours)}</span>
            <span className="rc-stat-label">Total heures</span>
          </div>
        </div>
        <div className="rc-stat-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div className="rc-stat-content">
            <span className="rc-stat-value">{summary.totalShifts}</span>
            <span className="rc-stat-label">Shifts planifiés</span>
          </div>
        </div>
        <div className="rc-stat-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <div className="rc-stat-content">
            <span className="rc-stat-value">{summary.employeeCount}</span>
            <span className="rc-stat-label">Employés actifs</span>
          </div>
        </div>
        <div className="rc-stat-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <div className="rc-stat-content">
            <span className="rc-stat-value">{formatHours(avgHoursPerEmployee)}</span>
            <span className="rc-stat-label">Moyenne / employé</span>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="rc-view-toggle">
        <button
          type="button"
          className={`rc-toggle-btn ${synView === 'employees' ? 'rc-toggle-btn--active' : ''}`}
          onClick={() => setSynView('employees')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          Par employé
        </button>
        <button
          type="button"
          className={`rc-toggle-btn ${synView === 'days' ? 'rc-toggle-btn--active' : ''}`}
          onClick={() => setSynView('days')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Par jour
        </button>
      </div>

      {/* Employee view */}
      {synView === 'employees' && (
        <div className="rc-section">
          <h2 className="rc-section-title">Heures par employé</h2>
          {summary.employeeSummaries.length === 0 ? (
            <div className="rc-empty-state">Aucun shift planifié cette semaine.</div>
          ) : (
            <div className="rc-emp-table-wrap">
              <table className="rc-emp-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 160 }}>Employé</th>
                    <th>Catégorie</th>
                    <th className="rc-th-center">Heures</th>
                    <th className="rc-th-center">Shifts</th>
                    <th className="rc-th-center">Objectif</th>
                    <th className="rc-th-center">Écart</th>
                    <th className="rc-th-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.employeeSummaries.map(emp => (
                    <tr key={emp.employeeId} className={!emp.isCompliant ? 'rc-row-warning' : ''}>
                      <td><span className="rc-emp-name">{emp.employeeName}</span></td>
                      <td><span className="rc-cat-badge">{emp.category}</span></td>
                      <td className="rc-cell-center"><span className="rc-hours-val">{formatHours(emp.totalHours)}</span></td>
                      <td className="rc-cell-center">{emp.shiftsCount}</td>
                      <td className="rc-cell-center">{emp.weeklyTarget}h</td>
                      <td className="rc-cell-center">
                        <span className={`rc-delta ${emp.hoursDelta > 0 ? 'rc-delta--over' : emp.hoursDelta < 0 ? 'rc-delta--under' : ''}`}>
                          {emp.hoursDelta > 0 ? '+' : ''}{formatHours(emp.hoursDelta)}
                        </span>
                      </td>
                      <td className="rc-cell-center">
                        {emp.isCompliant ? (
                          <span className="rc-status-ok">{'\u2713'} Conforme</span>
                        ) : (
                          <span className="rc-status-warn">{'\u26A0'} {'>'}48h</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Days view */}
      {synView === 'days' && (
        <div className="rc-section">
          <h2 className="rc-section-title">Planning par jour</h2>
          <div className="rc-days-list">
            {summary.dailySummaries.map(day => (
              <div key={day.date} className="rc-day-card">
                <div className="rc-day-header">
                  <div className="rc-day-info">
                    <span className="rc-day-name">{day.dayName}</span>
                    <span className="rc-day-date">{formatDate(new Date(day.date + 'T12:00:00'), 'medium')}</span>
                  </div>
                  <div className="rc-day-stats">
                    <span className="rc-day-stat">{formatHours(day.totalHours)}</span>
                    <span className="rc-day-sep">{'\u00B7'}</span>
                    <span className="rc-day-stat">{day.employeesCount} employé{day.employeesCount !== 1 ? 's' : ''}</span>
                    <span className="rc-day-sep">{'\u00B7'}</span>
                    <span className="rc-day-stat">{day.shiftsCount} shift{day.shiftsCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {day.shifts.length > 0 ? (
                  <div className="rc-shifts-list">
                    {day.shifts.map(shift => (
                      <div key={shift.id} className="rc-shift-item">
                        <span className="rc-shift-time">{shift.startTime} - {shift.endTime}</span>
                        <span className="rc-shift-emp">{shift.employeeName}</span>
                        <span className="rc-shift-cat">{shift.category}</span>
                        <span className="rc-shift-hours">{formatHours(shift.hours)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rc-no-shifts">Aucun shift planifié</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Hebdomadaire
// ═══════════════════════════════════════════════════════

function HebdoTab({
  recapData,
  weekDates,
}: {
  recapData: { employee: Employee; dayHours: number[]; totalHours: number }[];
  weekDates: Date[];
}) {
  if (recapData.length === 0) {
    return (
      <div className="rc-hebdo-wrap">
        <div className="rc-hebdo-empty">
          <div className="rc-hebdo-empty-icon">📊</div>
          <div className="rc-hebdo-empty-text">Aucune donnée pour cette semaine</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rc-hebdo-wrap">
      <table className="rc-hebdo-table">
        <thead>
          <tr>
            <th className="rc-col-emp">Employé</th>
            {DAYS.map((day, i) => (
              <th key={day} className="rc-col-day">
                <span className="rc-hebdo-day-name">{day}</span>
                <span className="rc-hebdo-day-date">{weekDates[i].getDate()}</span>
              </th>
            ))}
            <th>Total</th>
            <th>Contrat</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>
          {recapData.map(({ employee, dayHours, totalHours }) => {
            const diff = totalHours - employee.contract_hours;
            return (
              <tr key={employee.id}>
                <td className="rc-hebdo-cell-emp">
                  <span className="rc-hebdo-emp-name">{employee.first_name} {employee.last_name}</span>
                  <span className="rc-hebdo-emp-role">{employee.role}</span>
                </td>
                {dayHours.map((h, i) => (
                  <td key={i} className={`rc-hebdo-hours ${h === 0 ? 'rc-hebdo-hours--empty' : ''}`}>
                    {h > 0 ? formatHours(h) : '-'}
                  </td>
                ))}
                <td className="rc-hebdo-total">{formatHours(totalHours)}</td>
                <td className="rc-hebdo-contract">{employee.contract_hours}h</td>
                <td className={`rc-hebdo-diff ${diff > 0 ? 'rc-hebdo-diff--over' : diff < 0 ? 'rc-hebdo-diff--under' : ''}`}>
                  {diff > 0 ? '+' : ''}{formatHours(diff)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab: Mensuel (Coming Soon)
// ═══════════════════════════════════════════════════════

function MensuelTab() {
  return (
    <div className="rc-mensuel">
      <div className="rc-coming-soon">
        <div className="rc-coming-icon">📆</div>
        <h2 className="rc-coming-title">Vue Mensuelle</h2>
        <p className="rc-coming-text">Cette fonctionnalité sera disponible prochainement</p>
        <div className="rc-features">
          • Vue globale du mois<br />
          • Statistiques mensuelles<br />
          • Comparaison avec mois précédents<br />
          • Export rapport mensuel
        </div>
      </div>
    </div>
  );
}
