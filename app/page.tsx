'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import {
  getWeekLabel,
  getMonday,
  getWeekDates,
  addDays,
  isSameDay,
  toISODateString,
} from '@/lib/utils/dateUtils';
import { formatHours } from '@/lib/utils/hourUtils';
import Link from 'next/link';
import ComplianceWidget from '@/components/legal/ComplianceWidget';
import WeekSummaryWidget from '@/components/recap/WeekSummaryWidget';

/* ---- Types ---- */
interface DayOverview {
  date: string;
  dayLabel: string;
  employees: number;
  hours: number;
  hasPharmacist: boolean;
  hasConflict: boolean;
}

interface Alert {
  type: 'error' | 'warning' | 'info';
  message: string;
  employeeName?: string;
  day?: string;
}

interface DashboardData {
  totalHours: number;
  activeEmployees: number;
  scheduledEmployees: number;
  pharmacistCoverage: number;
  conflictsCount: number;
  shiftsCount: number;
  employeesByRole: Record<string, number>;
  hoursByDay: Record<string, number>;
  weekOverview: DayOverview[];
  alerts: Alert[];
}

/* ---- Couleurs par rôle ---- */
const ROLE_COLORS: Record<string, string> = {
  Pharmacien: 'var(--color-primary-500)',
  Preparateur: '#10b981',
  Conditionneur: '#f59e0b',
  Apprenti: '#8b5cf6',
  Etudiant: '#ec4899',
};

const ROLE_LABELS: Record<string, string> = {
  Pharmacien: 'Pharmaciens',
  Preparateur: 'Préparateurs',
  Conditionneur: 'Conditionneurs',
  Apprenti: 'Apprentis',
  Etudiant: 'Étudiants',
};

export default function DashboardPage() {
  const { organization, organizationId, isLoading: orgLoading } = useOrganization();
  const pharmacyName = organization?.name ?? 'Pharmacie';

  // Navigation semaine
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const todayMonday = getMonday(new Date());
  const isCurrentWeek = isSameDay(currentMonday, todayMonday);
  const weekLabel = getWeekLabel(currentMonday);

  // Données
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dates de la semaine
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
  const weekStart = toISODateString(weekDates[0]);
  const weekEnd = toISODateString(weekDates[6]);

  // Charger les stats
  const loadStats = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ organizationId, weekStart, weekEnd });
      const res = await fetch(`/api/dashboard-stats?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, weekStart, weekEnd]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadStats();
  }, [orgLoading, organizationId, loadStats]);

  // Navigation
  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleToday = () => setCurrentMonday(getMonday(new Date()));

  // Graphique barres : hauteur max
  const maxDayHours = useMemo(() => {
    if (!data) return 50;
    return Math.max(...Object.values(data.hoursByDay), 1);
  }, [data]);

  if (orgLoading || (isLoading && !data)) {
    return (
      <>
        <div className="dashboard-loading">
          <span className="loading-spinner" />
          <span>Chargement du tableau de bord...</span>
        </div>
        <style jsx>{`
          .dashboard-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-3);
            height: 300px;
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

  const stats = data!;
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <>
      <div className="dashboard">
        {/* ─── En-tête avec navigation semaine ─── */}
        <section className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Tableau de bord</h1>
            <p className="dashboard-subtitle">{pharmacyName}</p>
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

        {/* ─── 4 cartes statistiques ─── */}
        <section className="stats-grid">
          <StatCard
            label="Heures planifiées"
            value={formatHours(stats.totalHours)}
            detail={`${stats.scheduledEmployees}/${stats.activeEmployees} employés planifiés`}
            variant="primary"
          />
          <StatCard
            label="Couverture pharmacien"
            value={`${stats.pharmacistCoverage}%`}
            detail="Objectif : 100% jours ouvrés"
            variant={stats.pharmacistCoverage === 100 ? 'success' : 'warning'}
          />
          <StatCard
            label="Conflits détectés"
            value={String(stats.conflictsCount)}
            detail={stats.conflictsCount === 0 ? 'Aucun conflit' : 'À résoudre'}
            variant={stats.conflictsCount === 0 ? 'success' : 'danger'}
          />
          <StatCard
            label="Shifts cette semaine"
            value={String(stats.shiftsCount)}
            detail={`${stats.activeEmployees} employés actifs`}
            variant="neutral"
          />
        </section>

        {/* ─── Graphiques côte à côte ─── */}
        <section className="charts-row">
          {/* Graphique barres : Heures par jour */}
          <div className="chart-card">
            <h2 className="section-title">Heures par jour</h2>
            <div className="bar-chart">
              {DAYS.map(day => {
                const hours = stats.hoursByDay[day] || 0;
                const pct = maxDayHours > 0 ? (hours / maxDayHours) * 100 : 0;
                return (
                  <div key={day} className="bar-col">
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        title={`${Math.round(hours * 10) / 10}h`}
                      />
                    </div>
                    <span className="bar-value">{Math.round(hours)}h</span>
                    <span className="bar-label">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Graphique rôles */}
          <div className="chart-card">
            <h2 className="section-title">Effectif par rôle</h2>
            <div className="role-chart">
              {Object.entries(stats.employeesByRole)
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => {
                  const pct = stats.activeEmployees > 0
                    ? Math.round((count / stats.activeEmployees) * 100)
                    : 0;
                  return (
                    <div key={role} className="role-row">
                      <div className="role-info">
                        <span
                          className="role-dot"
                          style={{ backgroundColor: ROLE_COLORS[role] || 'var(--color-neutral-400)' }}
                        />
                        <span className="role-name">{ROLE_LABELS[role] || role}</span>
                      </div>
                      <div className="role-bar-track">
                        <div
                          className="role-bar-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: ROLE_COLORS[role] || 'var(--color-neutral-400)',
                          }}
                        />
                      </div>
                      <span className="role-count">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>

        {/* ─── Vue semaine 7 jours ─── */}
        <section className="week-overview">
          <h2 className="section-title">Vue de la semaine</h2>
          <div className="week-grid">
            {stats.weekOverview.map((day, index) => (
              <div
                key={day.date}
                className={`week-day ${day.hasConflict ? 'week-day--conflict' : ''} ${day.employees === 0 ? 'week-day--closed' : ''}`}
              >
                <span className="week-day-label">{day.dayLabel}</span>
                <span className="week-day-date">{weekDates[index].getDate()}</span>
                <span className="week-day-employees">
                  {day.employees > 0 ? `${day.employees} emp.` : 'Fermé'}
                </span>
                <span className="week-day-hours">
                  {day.hours > 0 ? formatHours(day.hours) : '—'}
                </span>
                {!day.hasPharmacist && day.employees > 0 && (
                  <span className="week-day-no-pharma" title="Aucun pharmacien">!</span>
                )}
                {day.hasConflict && (
                  <span className="week-day-conflict-badge" title="Conflit détecté">!</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Alertes conformité ─── */}
        {stats.alerts.length > 0 && (
          <section className="alerts-section">
            <h2 className="section-title">
              Alertes de conformité
              <span className="alerts-badge">{stats.alerts.length}</span>
            </h2>
            <div className="alerts-list">
              {stats.alerts.map((alert, i) => (
                <div key={i} className={`alert alert-${alert.type}`}>
                  <span className="alert-icon">
                    {alert.type === 'error' ? '\u2717' : '\u26A0'}
                  </span>
                  <div className="alert-body">
                    <span className="alert-message">{alert.message}</span>
                    {(alert.employeeName || alert.day) && (
                      <span className="alert-meta">
                        {[alert.employeeName, alert.day].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Widgets résumé ─── */}
        <section className="widgets-row">
          <ComplianceWidget />
          <WeekSummaryWidget />
        </section>

        {/* ─── Accès rapide ─── */}
        <section className="quick-access">
          <h2 className="section-title">Accès rapide</h2>
          <div className="quick-grid">
            <QuickLink href="/planning" label="Planning Gantt" description="Voir et modifier les horaires" />
            <QuickLink href="/recap" label="Récapitulatif" description="Heures hebdomadaires par employé" />
            <QuickLink href="/gardes" label="Gardes" description="Planning des gardes et astreintes" />
            <QuickLink href="/employes" label="Employés" description={`Gérer les ${stats.activeEmployees} employés`} />
            <QuickLink href="/conges" label="Congés" description="Calendrier annuel des congés" />
            <QuickLink href="/portail-employe" label="Portail Employé" description="Vue employé du planning" />
            <QuickLink href="/titulaire/analytics" label="Analytics" description="KPIs, graphiques et predictions" />
            <QuickLink href="/titulaire/conformite" label="Conformité" description="Rapport de conformité légale" />
            <QuickLink href="/titulaire/recap-hebdo" label="Récap. Hebdo" description="Synthèse heures et exports" />
          </div>
        </section>
      </div>

      <style jsx>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
          max-width: 1100px;
        }

        /* ─── Header + Navigation semaine ─── */
        .dashboard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }

        .dashboard-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
          margin: 0;
        }

        .dashboard-subtitle {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin-top: var(--spacing-1);
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

        /* ─── Stats grid ─── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-4);
        }

        /* ─── Widgets row ─── */
        .widgets-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }

        /* ─── Charts row ─── */
        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }

        .chart-card {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-5);
        }

        /* ─── Bar chart ─── */
        .bar-chart {
          display: flex;
          align-items: flex-end;
          gap: var(--spacing-2);
          height: 180px;
          margin-top: var(--spacing-3);
        }

        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          height: 100%;
        }

        .bar-track {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
        }

        .bar-fill {
          width: 100%;
          background: linear-gradient(to top, var(--color-primary-500), var(--color-primary-300));
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          transition: height 0.4s ease;
          min-height: 4px;
        }

        .bar-value {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
        }

        .bar-label {
          font-size: 11px;
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
        }

        /* ─── Role chart ─── */
        .role-chart {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
          margin-top: var(--spacing-3);
        }

        .role-row {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
        }

        .role-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          min-width: 120px;
        }

        .role-dot {
          width: 10px;
          height: 10px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }

        .role-name {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
        }

        .role-bar-track {
          flex: 1;
          height: 8px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .role-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.4s ease;
          min-width: 4px;
        }

        .role-count {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
          min-width: 24px;
          text-align: right;
        }

        /* ─── Section titles ─── */
        .section-title {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0 0 var(--spacing-3) 0;
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .alerts-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          background: var(--color-danger-100);
          color: var(--color-danger-700);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
        }

        /* ─── Week overview ─── */
        .week-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: var(--spacing-2);
        }

        .week-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-1);
          padding: var(--spacing-3);
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          position: relative;
          transition: all 0.15s ease;
        }

        .week-day:hover {
          border-color: var(--color-primary-200);
        }

        .week-day--conflict {
          border-color: var(--color-warning-400);
          background-color: var(--color-warning-50);
        }

        .week-day--closed {
          background-color: var(--color-neutral-50);
          opacity: 0.6;
        }

        .week-day-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          text-transform: uppercase;
        }

        .week-day-date {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .week-day-employees {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .week-day-hours {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-primary-700);
        }

        .week-day-conflict-badge {
          position: absolute;
          top: var(--spacing-1);
          right: var(--spacing-1);
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-warning-500);
          color: white;
          border-radius: 50%;
          font-size: 10px;
          font-weight: var(--font-weight-bold);
        }

        .week-day-no-pharma {
          position: absolute;
          top: var(--spacing-1);
          left: var(--spacing-1);
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-danger-500);
          color: white;
          border-radius: 50%;
          font-size: 10px;
          font-weight: var(--font-weight-bold);
        }

        /* ─── Alertes ─── */
        .alerts-section {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-5);
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        .alert-error {
          background-color: var(--color-danger-50);
          border-left: 3px solid var(--color-danger-500);
          color: var(--color-danger-800);
        }

        .alert-warning {
          background-color: var(--color-warning-50);
          border-left: 3px solid var(--color-warning-500);
          color: var(--color-warning-800);
        }

        .alert-info {
          background-color: var(--color-primary-50);
          border-left: 3px solid var(--color-primary-500);
          color: var(--color-primary-800);
        }

        .alert-icon {
          font-size: var(--font-size-md);
          flex-shrink: 0;
          margin-top: 1px;
        }

        .alert-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .alert-message {
          font-weight: var(--font-weight-medium);
        }

        .alert-meta {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        /* ─── Quick access ─── */
        .quick-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-3);
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .charts-row,
          .widgets-row {
            grid-template-columns: 1fr;
          }
          .week-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .quick-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .week-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .quick-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-header {
            flex-direction: column;
          }
          .week-label {
            min-width: auto;
            font-size: var(--font-size-xs);
          }
        }
      `}</style>
    </>
  );
}

/* ──── Sous-composants ──── */

function StatCard({
  label,
  value,
  detail,
  variant,
}: {
  label: string;
  value: string;
  detail: string;
  variant: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const colorMap = {
    primary: 'var(--color-primary-600)',
    success: 'var(--color-success-500)',
    warning: 'var(--color-warning-600)',
    danger: 'var(--color-danger-600)',
    neutral: 'var(--color-neutral-600)',
  };

  return (
    <>
      <div className="stat-card">
        <span className="stat-label">{label}</span>
        <span className="stat-value" style={{ color: colorMap[variant] }}>
          {value}
        </span>
        <span className="stat-detail">{detail}</span>
      </div>

      <style jsx>{`
        .stat-card {
          display: flex;
          flex-direction: column;
          padding: var(--spacing-4);
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          transition: all 0.15s ease;
        }

        .stat-card:hover {
          border-color: var(--color-primary-200);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .stat-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .stat-value {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          margin-top: var(--spacing-1);
          line-height: 1.2;
        }

        .stat-detail {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          margin-top: var(--spacing-1);
        }
      `}</style>
    </>
  );
}

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <>
      <Link href={href} className="quick-link">
        <span className="quick-link-label">{label}</span>
        <span className="quick-link-desc">{description}</span>
      </Link>

      <style jsx>{`
        :global(.quick-link) {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
          padding: var(--spacing-4);
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        :global(.quick-link:hover) {
          border-color: var(--color-primary-300);
          background-color: var(--color-primary-50);
          text-decoration: none;
        }

        :global(.quick-link-label) {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
        }

        :global(.quick-link-desc) {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }
      `}</style>
    </>
  );
}
