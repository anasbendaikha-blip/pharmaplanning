/**
 * Page Conformité Légale — Rapport détaillé
 *
 * Affiche :
 *  - Score global avec ComplianceBadge (taille large)
 *  - Compteurs par sévérité et par type
 *  - Liste filtrable des violations
 *  - Tableau de conformité par employé
 *
 * styled-jsx uniquement.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getShiftsForWeek, getEmployees } from '@/lib/supabase/queries';
import { generateComplianceReport } from '@/lib/legal/validation';
import {
  VIOLATION_LABELS,
  VIOLATION_DESCRIPTIONS,
  SEVERITY_LABELS,
  LEGAL_LIMITS,
} from '@/lib/legal/types';
import type { ComplianceReport, ViolationSeverity, ViolationType } from '@/lib/legal/types';
import { getMonday, getWeekDates, toISODateString, addDays, getWeekLabel } from '@/lib/utils/dateUtils';
import ComplianceBadge from '@/components/legal/ComplianceBadge';
import Link from 'next/link';

type FilterSeverity = 'all' | ViolationSeverity;
type FilterType = 'all' | ViolationType;

export default function ConformitePage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();

  // Navigation semaine
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const weekLabel = getWeekLabel(currentMonday);
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
  const weekStart = toISODateString(weekDates[0]);
  const weekEnd = toISODateString(weekDates[6]);

  // Données
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtres
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Onglet actif
  const [activeTab, setActiveTab] = useState<'violations' | 'employees'>('violations');

  const loadReport = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const [shifts, employees] = await Promise.all([
        getShiftsForWeek(organizationId, weekStart, weekEnd),
        getEmployees(organizationId),
      ]);

      const complianceReport = generateComplianceReport(
        shifts,
        employees,
        weekStart,
        weekEnd,
      );
      setReport(complianceReport);
    } catch (error) {
      console.error('Erreur chargement rapport conformité:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, weekStart, weekEnd]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadReport();
  }, [orgLoading, organizationId, loadReport]);

  // Navigation
  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleToday = () => setCurrentMonday(getMonday(new Date()));
  const todayMonday = getMonday(new Date());
  const isCurrentWeek = toISODateString(currentMonday) === toISODateString(todayMonday);

  // Violations filtrées
  const filteredViolations = useMemo(() => {
    if (!report) return [];
    return report.violations.filter(v => {
      if (filterSeverity !== 'all' && v.severity !== filterSeverity) return false;
      if (filterType !== 'all' && v.type !== filterType) return false;
      return true;
    });
  }, [report, filterSeverity, filterType]);

  if (orgLoading || (isLoading && !report)) {
    return (
      <>
        <div className="loading-page">
          <span className="loading-spinner" />
          <span>Analyse de conformité en cours...</span>
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

  if (!report) return null;

  const { score, violations, employeeCompliance } = report;

  return (
    <>
      <div className="conformite-page">
        {/* ─── En-tête ─── */}
        <section className="page-header">
          <div className="header-left">
            <Link href="/" className="back-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tableau de bord
            </Link>
            <h1 className="page-title">Rapport de conformité légale</h1>
            <p className="page-subtitle">
              Analyse des contraintes du Code du Travail et de la Convention Collective Pharmacie
            </p>
          </div>
          <div className="week-nav">
            <button className="week-nav-btn" onClick={handlePrev} type="button" title="Semaine précédente">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="week-label">{weekLabel}</span>
            <button className="week-nav-btn" onClick={handleNext} type="button" title="Semaine suivante">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {!isCurrentWeek && (
              <button className="week-today-btn" onClick={handleToday} type="button">
                {"Aujourd'hui"}
              </button>
            )}
          </div>
        </section>

        {/* ─── Score global + stats ─── */}
        <section className="score-section">
          <div className="score-card">
            <ComplianceBadge
              score={score.score}
              label={score.label}
              colorVar={score.colorVar}
              size="lg"
            />
          </div>

          <div className="score-details">
            <div className="detail-row">
              <span className="detail-label">Shifts analysés</span>
              <span className="detail-value">{report.shiftsAnalyzed}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Employés analysés</span>
              <span className="detail-value">{report.employeesAnalyzed}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Violations critiques</span>
              <span className="detail-value detail-value--critical">{score.bySeverity.critical}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Avertissements</span>
              <span className="detail-value detail-value--warning">{score.bySeverity.warning}</span>
            </div>
          </div>

          <div className="limits-card">
            <h3 className="limits-title">Limites légales appliquées</h3>
            <div className="limits-list">
              <div className="limit-item">
                <span className="limit-label">Repos hebdomadaire</span>
                <span className="limit-value">{'\u2265'} {LEGAL_LIMITS.WEEKLY_REST_HOURS}h consécutives</span>
              </div>
              <div className="limit-item">
                <span className="limit-label">Amplitude journalière</span>
                <span className="limit-value">{'\u2264'} {LEGAL_LIMITS.MAX_DAILY_AMPLITUDE_HOURS}h</span>
              </div>
              <div className="limit-item">
                <span className="limit-label">Durée hebdomadaire</span>
                <span className="limit-value">{'\u2264'} {LEGAL_LIMITS.MAX_WEEKLY_HOURS}h</span>
              </div>
              <div className="limit-item">
                <span className="limit-label">Repos quotidien</span>
                <span className="limit-value">{'\u2265'} {LEGAL_LIMITS.MIN_DAILY_REST_HOURS}h</span>
              </div>
              <div className="limit-item">
                <span className="limit-label">Pause obligatoire</span>
                <span className="limit-value">{LEGAL_LIMITS.MIN_BREAK_MINUTES} min / {LEGAL_LIMITS.CONTINUOUS_WORK_THRESHOLD_HOURS}h travail</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Onglets ─── */}
        <section className="tabs-section">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'violations' ? 'tab--active' : ''}`}
              onClick={() => setActiveTab('violations')}
            >
              Violations
              {violations.length > 0 && (
                <span className="tab-badge">{violations.length}</span>
              )}
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'employees' ? 'tab--active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              Par employé
              <span className="tab-badge tab-badge--neutral">{employeeCompliance.length}</span>
            </button>
          </div>

          {/* ─── TAB : Violations ─── */}
          {activeTab === 'violations' && (
            <div className="tab-content">
              {/* Filtres */}
              <div className="filters-row">
                <div className="filter-group">
                  <label className="filter-label" htmlFor="severity-filter">Sévérité</label>
                  <select
                    id="severity-filter"
                    className="filter-select"
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as FilterSeverity)}
                  >
                    <option value="all">Toutes</option>
                    <option value="critical">{SEVERITY_LABELS.critical}</option>
                    <option value="warning">{SEVERITY_LABELS.warning}</option>
                    <option value="info">{SEVERITY_LABELS.info}</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label className="filter-label" htmlFor="type-filter">Type</label>
                  <select
                    id="type-filter"
                    className="filter-select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as FilterType)}
                  >
                    <option value="all">Tous les types</option>
                    {Object.entries(VIOLATION_LABELS).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
                <span className="filter-count">
                  {filteredViolations.length} violation{filteredViolations.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Liste des violations */}
              {filteredViolations.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="20" stroke="var(--color-success-300)" strokeWidth="2"/>
                    <path d="M16 24l5 5 11-11" stroke="var(--color-success-500)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="empty-text">
                    {violations.length === 0
                      ? 'Aucune violation détectée pour cette semaine. Le planning est conforme !'
                      : 'Aucune violation ne correspond aux filtres sélectionnés.'
                    }
                  </p>
                </div>
              ) : (
                <div className="violations-list">
                  {filteredViolations.map(v => (
                    <div key={v.id} className={`violation-card violation-card--${v.severity}`}>
                      <div className="violation-header">
                        <span className={`severity-badge severity-badge--${v.severity}`}>
                          {SEVERITY_LABELS[v.severity]}
                        </span>
                        <span className="violation-type">{VIOLATION_LABELS[v.type]}</span>
                        <span className="violation-date">{v.date}</span>
                      </div>
                      <p className="violation-message">{v.message}</p>
                      <div className="violation-details">
                        <span className="violation-employee">{v.employeeName}</span>
                        <span className="violation-values">
                          Réel : <strong>{v.actualValue}</strong> · Limite : <strong>{v.legalLimit}</strong>
                        </span>
                      </div>
                      <p className="violation-desc">{VIOLATION_DESCRIPTIONS[v.type]}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB : Par employé ─── */}
          {activeTab === 'employees' && (
            <div className="tab-content">
              <div className="employee-table-wrapper">
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Score</th>
                      <th>Heures / semaine</th>
                      <th>Jours travaillés</th>
                      <th>Violations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeCompliance.map(ec => {
                      const critCount = ec.violations.filter(v => v.severity === 'critical').length;
                      const warnCount = ec.violations.filter(v => v.severity === 'warning').length;
                      return (
                        <tr key={ec.employee.id} className={critCount > 0 ? 'row--critical' : warnCount > 0 ? 'row--warning' : ''}>
                          <td className="cell-employee">
                            <span className="emp-name">
                              {ec.employee.first_name} {ec.employee.last_name}
                            </span>
                            <span className="emp-role">{ec.employee.category}</span>
                          </td>
                          <td>
                            <ComplianceBadge
                              score={ec.score}
                              label=""
                              colorVar={
                                ec.score >= 90
                                  ? 'var(--color-success-500)'
                                  : ec.score >= 70
                                    ? 'var(--color-success-600)'
                                    : ec.score >= 50
                                      ? 'var(--color-warning-500)'
                                      : 'var(--color-danger-500)'
                              }
                              size="sm"
                              showLabel={false}
                            />
                          </td>
                          <td className="cell-center">
                            <span className={ec.weeklyHours > LEGAL_LIMITS.MAX_WEEKLY_HOURS ? 'text-danger' : ''}>
                              {Math.round(ec.weeklyHours * 10) / 10}h
                            </span>
                          </td>
                          <td className="cell-center">{ec.daysWorked}/7</td>
                          <td className="cell-violations">
                            {ec.violations.length === 0 ? (
                              <span className="no-violations">{'\u2713'} Conforme</span>
                            ) : (
                              <div className="violation-counts">
                                {critCount > 0 && (
                                  <span className="violation-count violation-count--critical">
                                    {critCount} crit.
                                  </span>
                                )}
                                {warnCount > 0 && (
                                  <span className="violation-count violation-count--warning">
                                    {warnCount} avert.
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .conformite-page {
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

        .page-subtitle {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin: 0;
        }

        .week-nav {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
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

        .week-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          min-width: 220px;
          text-align: center;
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

        /* ─── Score section ─── */
        .score-section {
          display: grid;
          grid-template-columns: auto 1fr 1fr;
          gap: var(--spacing-4);
          align-items: start;
        }

        .score-card {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .score-details {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-5);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-600);
        }

        .detail-value {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .detail-value--critical {
          color: var(--color-danger-600);
        }

        .detail-value--warning {
          color: var(--color-warning-600);
        }

        .limits-card {
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-4);
        }

        .limits-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          margin: 0 0 var(--spacing-3) 0;
        }

        .limits-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .limit-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-xs);
        }

        .limit-label {
          color: var(--color-neutral-600);
        }

        .limit-value {
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-800);
        }

        /* ─── Tabs ─── */
        .tabs-section {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .tabs {
          display: flex;
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-2);
          padding: var(--spacing-3) var(--spacing-4);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab:hover {
          color: var(--color-neutral-700);
          background: var(--color-neutral-50);
        }

        .tab--active {
          color: var(--color-primary-700);
          border-bottom-color: var(--color-primary-600);
        }

        .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: var(--color-danger-100);
          color: var(--color-danger-700);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-weight-bold);
        }

        .tab-badge--neutral {
          background: var(--color-neutral-100);
          color: var(--color-neutral-600);
        }

        .tab-content {
          padding: var(--spacing-5);
        }

        /* ─── Filters ─── */
        .filters-row {
          display: flex;
          align-items: flex-end;
          gap: var(--spacing-4);
          margin-bottom: var(--spacing-4);
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .filter-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .filter-select {
          padding: 6px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
          background: white;
          cursor: pointer;
        }

        .filter-count {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin-left: auto;
        }

        /* ─── Empty state ─── */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-8) var(--spacing-4);
          text-align: center;
        }

        .empty-text {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          max-width: 400px;
          margin: 0;
        }

        /* ─── Violations list ─── */
        .violations-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
        }

        .violation-card {
          padding: var(--spacing-4);
          border-radius: var(--radius-md);
          border-left: 4px solid transparent;
        }

        .violation-card--critical {
          background: var(--color-danger-50);
          border-left-color: var(--color-danger-500);
        }

        .violation-card--warning {
          background: var(--color-warning-50);
          border-left-color: var(--color-warning-500);
        }

        .violation-card--info {
          background: var(--color-primary-50);
          border-left-color: var(--color-primary-500);
        }

        .violation-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          margin-bottom: var(--spacing-2);
          flex-wrap: wrap;
        }

        .severity-badge {
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .severity-badge--critical {
          background: var(--color-danger-100);
          color: var(--color-danger-700);
        }

        .severity-badge--warning {
          background: var(--color-warning-100);
          color: var(--color-warning-700);
        }

        .severity-badge--info {
          background: var(--color-primary-100);
          color: var(--color-primary-700);
        }

        .violation-type {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
        }

        .violation-date {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          margin-left: auto;
        }

        .violation-message {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
          margin: 0 0 var(--spacing-2) 0;
          line-height: 1.5;
        }

        .violation-details {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          margin-bottom: var(--spacing-2);
        }

        .violation-employee {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          background: var(--color-neutral-100);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }

        .violation-values {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .violation-desc {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
          font-style: italic;
          margin: 0;
          line-height: 1.4;
        }

        /* ─── Employee table ─── */
        .employee-table-wrapper {
          overflow-x: auto;
        }

        .employee-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .employee-table th {
          text-align: left;
          padding: var(--spacing-3) var(--spacing-4);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 2px solid var(--color-neutral-200);
        }

        .employee-table td {
          padding: var(--spacing-3) var(--spacing-4);
          border-bottom: 1px solid var(--color-neutral-100);
          vertical-align: middle;
        }

        .employee-table tbody tr:hover {
          background: var(--color-neutral-50);
        }

        .employee-table :global(.row--critical) {
          background: var(--color-danger-50);
        }

        .employee-table :global(.row--warning) {
          background: var(--color-warning-50);
        }

        .cell-employee {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .emp-name {
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
        }

        .emp-role {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .cell-center {
          text-align: center;
        }

        .text-danger {
          color: var(--color-danger-600);
          font-weight: var(--font-weight-bold);
        }

        .cell-violations {
          min-width: 140px;
        }

        .no-violations {
          color: var(--color-success-600);
          font-weight: var(--font-weight-medium);
          font-size: var(--font-size-xs);
        }

        .violation-counts {
          display: flex;
          gap: var(--spacing-2);
        }

        .violation-count {
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-weight-bold);
        }

        .violation-count--critical {
          background: var(--color-danger-100);
          color: var(--color-danger-700);
        }

        .violation-count--warning {
          background: var(--color-warning-100);
          color: var(--color-warning-700);
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .score-section {
            grid-template-columns: 1fr;
          }
          .page-header {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
