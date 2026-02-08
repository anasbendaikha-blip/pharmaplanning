/**
 * Page Analytics V2 — Heures Sup & Gardes
 *
 * Dashboard analytique complet :
 * - KPIs globaux (existant)
 * - Graphiques (existant)
 * - Predictions (existant)
 * - Top employes (existant)
 * - NOUVEAU : Heures normales vs supplementaires
 * - NOUVEAU : Distribution gardes (soir/nuit/dimanche)
 *
 * styled-jsx global, recharts, pas de date-fns.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import KPICard from '@/components/analytics/KPICard';
import LineChartCard from '@/components/analytics/LineChartCard';
import BarChartCard from '@/components/analytics/BarChartCard';
import PieChartCard from '@/components/analytics/PieChartCard';
import { exportAnalyticsPDF, exportAnalyticsExcel } from '@/lib/analytics/report-generator';
import type { AnalyticsDashboard, AnalyticsPeriod } from '@/lib/analytics/types';
import type { HoursSplit, GuardInfo, OvertimeStats, GuardStats } from '@/lib/analytics/hours-calculator';

// ─── Constantes ───

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '12m', label: '12 mois' },
];

const WEEK_OPTIONS = [
  { value: '1', label: '1 semaine' },
  { value: '4', label: '4 semaines' },
  { value: '8', label: '8 semaines' },
  { value: '12', label: '12 semaines' },
];

const KPI_ICONS: Record<string, string> = {
  totalHours: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  totalShifts: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  averageHoursPerEmployee: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  overtimeHours: 'M13 10V3L4 14h7v7l9-11h-7z',
  leaveDays: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  complianceRate: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

type ViewTab = 'dashboard' | 'overtime' | 'guards';

// ─── Composant ───

export default function AnalyticsPage() {
  const { organizationId, organizationName, isLoading: orgLoading } = useOrganization();

  // Tab active
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');

  // Dashboard (existant)
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overtime (nouveau)
  const [overtimeData, setOvertimeData] = useState<HoursSplit[]>([]);
  const [overtimeStats, setOvertimeStats] = useState<OvertimeStats | null>(null);
  const [overtimeWeeks, setOvertimeWeeks] = useState('4');
  const [overtimeLoading, setOvertimeLoading] = useState(false);

  // Guards (nouveau)
  const [guardsData, setGuardsData] = useState<GuardInfo[]>([]);
  const [guardsStats, setGuardsStats] = useState<GuardStats | null>(null);
  const [guardsMonthLabel, setGuardsMonthLabel] = useState('');
  const [guardsMonthOffset, setGuardsMonthOffset] = useState(0);
  const [guardsLoading, setGuardsLoading] = useState(false);

  // ─── Fetch Dashboard ───

  const fetchDashboard = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, filters: { period } }),
      });

      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: AnalyticsDashboard = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Impossible de charger les analytics. Reessayez.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, period]);

  // ─── Fetch Overtime ───

  const fetchOvertime = useCallback(async () => {
    if (!organizationId) return;
    setOvertimeLoading(true);

    try {
      const res = await fetch(
        `/api/analytics/overtime?organizationId=${organizationId}&weeks=${overtimeWeeks}`,
      );
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setOvertimeData(data.results || []);
      setOvertimeStats(data.stats || null);
    } catch (err) {
      console.error('Overtime fetch error:', err);
    } finally {
      setOvertimeLoading(false);
    }
  }, [organizationId, overtimeWeeks]);

  // ─── Fetch Guards ───

  const fetchGuards = useCallback(async () => {
    if (!organizationId) return;
    setGuardsLoading(true);

    try {
      const res = await fetch(
        `/api/analytics/guards?organizationId=${organizationId}&monthOffset=${guardsMonthOffset}`,
      );
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setGuardsData(data.guards || []);
      setGuardsStats(data.stats || null);
      setGuardsMonthLabel(data.monthLabel || '');
    } catch (err) {
      console.error('Guards fetch error:', err);
    } finally {
      setGuardsLoading(false);
    }
  }, [organizationId, guardsMonthOffset]);

  // ─── Effects ───

  useEffect(() => {
    if (!orgLoading && organizationId) fetchDashboard();
  }, [orgLoading, organizationId, fetchDashboard]);

  useEffect(() => {
    if (!orgLoading && organizationId && activeTab === 'overtime') fetchOvertime();
  }, [orgLoading, organizationId, activeTab, fetchOvertime]);

  useEffect(() => {
    if (!orgLoading && organizationId && activeTab === 'guards') fetchGuards();
  }, [orgLoading, organizationId, activeTab, fetchGuards]);

  // ─── Overtime aggrege par employe ───

  const overtimeByEmployee = useMemo(() => {
    const map = new Map<string, {
      name: string;
      role: string;
      contractHours: number;
      normalHours: number;
      overtimeHours: number;
      totalHours: number;
      weeksWithOvertime: number;
      weeksCount: number;
      maxWeeklyHours: number;
      hasComplianceIssue: boolean;
    }>();

    for (const row of overtimeData) {
      const existing = map.get(row.employeeId);
      if (!existing) {
        map.set(row.employeeId, {
          name: row.employeeName,
          role: row.role,
          contractHours: row.contractHours,
          normalHours: row.normalHours,
          overtimeHours: row.overtimeHours,
          totalHours: row.totalHours,
          weeksWithOvertime: row.overtimeHours > 0 ? 1 : 0,
          weeksCount: 1,
          maxWeeklyHours: row.totalHours,
          hasComplianceIssue: row.totalHours > 48,
        });
      } else {
        existing.normalHours += row.normalHours;
        existing.overtimeHours += row.overtimeHours;
        existing.totalHours += row.totalHours;
        existing.weeksCount++;
        if (row.overtimeHours > 0) existing.weeksWithOvertime++;
        if (row.totalHours > existing.maxWeeklyHours) existing.maxWeeklyHours = row.totalHours;
        if (row.totalHours > 48) existing.hasComplianceIssue = true;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.overtimeHours - a.overtimeHours);
  }, [overtimeData]);

  // ─── Overtime bar chart data ───

  const overtimeChartData = useMemo(() => {
    return overtimeByEmployee
      .filter(e => e.totalHours > 0)
      .slice(0, 15)
      .map(e => ({
        label: e.name.split(' ')[0],
        value: Math.round(e.normalHours * 10) / 10,
      }));
  }, [overtimeByEmployee]);

  // ─── Guards sorted ───

  const guardsSorted = useMemo(() => {
    return [...guardsData].sort((a, b) => b.totalGuards - a.totalGuards);
  }, [guardsData]);

  // ─── Exports ───

  const handleExportPDF = () => {
    if (dashboard) exportAnalyticsPDF(dashboard, organizationName || 'Pharmacie');
  };

  const handleExportExcel = () => {
    if (dashboard) exportAnalyticsExcel(dashboard, organizationName || 'Pharmacie');
  };

  // ─── Loading initial ───

  if (orgLoading) {
    return (
      <>
        <div className="ap-loading">
          <p>Chargement...</p>
        </div>
        <style jsx>{`
          .ap-loading {
            display: flex; align-items: center; justify-content: center;
            min-height: 400px; color: var(--color-neutral-500); font-size: var(--font-size-base);
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="analytics-page">
        {/* ─── Header ─── */}
        <div className="ap-header">
          <div className="ap-header-left">
            <h1 className="ap-title">Analytics</h1>
            <p className="ap-subtitle">
              Tableau de bord analytique — {organizationName || 'Pharmacie'}
            </p>
          </div>
          <div className="ap-header-actions">
            {activeTab === 'dashboard' && (
              <div className="ap-period-selector">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`ap-period-btn ${period === opt.value ? 'ap-period-btn--active' : ''}`}
                    onClick={() => setPeriod(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <div className="ap-export-actions">
              <button className="ap-export-btn" onClick={handleExportPDF} disabled={!dashboard}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="18" />
                  <line x1="15" y1="15" x2="12" y2="18" />
                </svg>
                PDF
              </button>
              <button className="ap-export-btn" onClick={handleExportExcel} disabled={!dashboard}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Excel
              </button>
            </div>
          </div>
        </div>

        {/* ─── Tab Toggle ─── */}
        <div className="ap-tab-toggle">
          <button
            className={`ap-tab-btn ${activeTab === 'dashboard' ? 'ap-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </button>
          <button
            className={`ap-tab-btn ${activeTab === 'overtime' ? 'ap-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('overtime')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Heures Sup.
          </button>
          <button
            className={`ap-tab-btn ${activeTab === 'guards' ? 'ap-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('guards')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 15h12a1 1 0 00.707-1.707L18 12.586V9a6 6 0 00-6-6z" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            Gardes
          </button>
        </div>

        {/* ─── Error ─── */}
        {error && activeTab === 'dashboard' && (
          <div className="ap-error">
            <p>{error}</p>
            <button className="ap-retry-btn" onClick={fetchDashboard}>Reessayer</button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            TAB 1 : DASHBOARD
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <>
            {loading && !dashboard && (
              <div className="ap-loading-content">
                <div className="ap-spinner" />
                <p>Calcul des analytics...</p>
              </div>
            )}

            {dashboard && (
              <>
                <section className="ap-kpi-section">
                  <div className="ap-kpi-grid">
                    {(Object.keys(dashboard.kpis) as Array<keyof typeof dashboard.kpis>).map((key) => (
                      <KPICard key={key} metric={dashboard.kpis[key]} icon={KPI_ICONS[key]} />
                    ))}
                  </div>
                </section>

                <section className="ap-charts-section">
                  <div className="ap-charts-grid-2">
                    <LineChartCard title="Heures par semaine" data={dashboard.charts.hoursPerWeek} color="#10b981" unit="h" />
                    <BarChartCard title="Shifts par jour" data={dashboard.charts.shiftsPerDay} color="#3b82f6" />
                  </div>
                </section>

                <section className="ap-charts-section">
                  <div className="ap-charts-grid-2">
                    <PieChartCard title="Repartition par type de shift" data={dashboard.charts.shiftTypeDistribution} />
                    <PieChartCard title="Repartition par type de conge" data={dashboard.charts.leaveTypeDistribution} />
                  </div>
                </section>

                <section className="ap-charts-section">
                  <BarChartCard
                    title="Heures par employe"
                    data={dashboard.charts.hoursPerEmployee.map((e) => ({
                      label: e.employeeName.split(' ')[0],
                      value: e.totalHours,
                    }))}
                    color="#8b5cf6"
                    unit="h"
                  />
                </section>

                {dashboard.predictions.length > 0 && (
                  <section className="ap-predictions-section">
                    <h2 className="ap-section-title">Predictions & Recommandations</h2>
                    <div className="ap-predictions-grid">
                      {dashboard.predictions.map((pred, i) => (
                        <div key={i} className={`ap-prediction-card ap-prediction-card--${pred.type}`}>
                          <div className="ap-prediction-header">
                            <span className="ap-prediction-badge">
                              {pred.type === 'alert' ? 'Alerte' : pred.type === 'recommendation' ? 'Recommandation' : 'Tendance'}
                            </span>
                            <span className="ap-prediction-confidence">{pred.confidence}% confiance</span>
                          </div>
                          <h3 className="ap-prediction-title">{pred.title}</h3>
                          <p className="ap-prediction-desc">{pred.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {dashboard.topEmployees.length > 0 && (
                  <section className="ap-table-section">
                    <h2 className="ap-section-title">Top employes</h2>
                    <div className="ap-table-wrapper">
                      <table className="ap-table">
                        <thead>
                          <tr>
                            <th>Employe</th>
                            <th>Role</th>
                            <th>Heures</th>
                            <th>Shifts</th>
                            <th>H. Sup.</th>
                            <th>Conges</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.topEmployees.map((emp) => (
                            <tr key={emp.employeeId}>
                              <td className="ap-emp-name">{emp.employeeName}</td>
                              <td>{emp.role}</td>
                              <td>{emp.totalHours}h</td>
                              <td>{emp.shiftsCount}</td>
                              <td>{emp.overtime}h</td>
                              <td>{emp.leaveDays}j</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            TAB 2 : HEURES SUPPLEMENTAIRES
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'overtime' && (
          <>
            <div className="ap-ot-controls">
              <span className="ap-ot-controls-label">Periode :</span>
              <div className="ap-period-selector">
                {WEEK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`ap-period-btn ${overtimeWeeks === opt.value ? 'ap-period-btn--active' : ''}`}
                    onClick={() => setOvertimeWeeks(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {overtimeLoading ? (
              <div className="ap-loading-content">
                <div className="ap-spinner" />
                <p>Calcul des heures supplementaires...</p>
              </div>
            ) : (
              <>
                {overtimeStats && (
                  <section className="ap-ot-kpi-grid">
                    <div className="ap-ot-kpi-card">
                      <span className="ap-ot-kpi-value ap-ot-kpi-value--danger">{overtimeStats.totalOvertimeHours}h</span>
                      <span className="ap-ot-kpi-label">Heures sup. totales</span>
                    </div>
                    <div className="ap-ot-kpi-card">
                      <span className="ap-ot-kpi-value">{overtimeStats.employeesWithOvertime}</span>
                      <span className="ap-ot-kpi-label">Employes concernes</span>
                    </div>
                    <div className="ap-ot-kpi-card">
                      <span className="ap-ot-kpi-value">{overtimeStats.maxWeeklyHours}h</span>
                      <span className="ap-ot-kpi-label">Max hebdo.</span>
                    </div>
                    <div className="ap-ot-kpi-card">
                      <span className={`ap-ot-kpi-value ${overtimeStats.complianceIssues > 0 ? 'ap-ot-kpi-value--danger' : 'ap-ot-kpi-value--success'}`}>
                        {overtimeStats.complianceIssues}
                      </span>
                      <span className="ap-ot-kpi-label">Depassements 48h</span>
                    </div>
                  </section>
                )}

                {overtimeChartData.length > 0 && (
                  <section className="ap-charts-section">
                    <BarChartCard title="Heures normales par employe" data={overtimeChartData} color="#10b981" unit="h" />
                  </section>
                )}

                <section className="ap-table-section">
                  <h2 className="ap-section-title">Detail heures supplementaires</h2>
                  <div className="ap-table-wrapper">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Employe</th>
                          <th>Role</th>
                          <th>Contrat</th>
                          <th>H. Normales</th>
                          <th>H. Sup.</th>
                          <th>Total</th>
                          <th>Sem. H.Sup</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overtimeByEmployee.map((emp) => (
                          <tr key={emp.name} className={emp.overtimeHours > 0 ? 'ap-row--warning' : ''}>
                            <td className="ap-emp-name">{emp.name}</td>
                            <td>{emp.role}</td>
                            <td>{emp.contractHours}h/sem</td>
                            <td>{Math.round(emp.normalHours)}h</td>
                            <td className={emp.overtimeHours > 0 ? 'ap-cell--danger' : ''}>
                              {Math.round(emp.overtimeHours * 10) / 10}h
                            </td>
                            <td className="ap-cell--bold">{Math.round(emp.totalHours)}h</td>
                            <td>{emp.weeksWithOvertime}/{emp.weeksCount}</td>
                            <td>
                              {emp.hasComplianceIssue ? (
                                <span className="ap-badge ap-badge--danger">Depassement 48h</span>
                              ) : emp.overtimeHours > 0 ? (
                                <span className="ap-badge ap-badge--warning">Heures sup</span>
                              ) : (
                                <span className="ap-badge ap-badge--success">Conforme</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {overtimeByEmployee.length === 0 && (
                          <tr><td colSpan={8} className="ap-empty-row">Aucune donnee pour cette periode</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="ap-legend">
                  <h3 className="ap-legend-title">Conformite legale — Pharmacie d&#39;officine</h3>
                  <div className="ap-legend-grid">
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: 'var(--color-primary-500)' }} />
                      <span>Duree legale : 35h/semaine</span>
                    </div>
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: 'var(--color-warning-500)' }} />
                      <span>Heures sup 25% : 36h a 43h</span>
                    </div>
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: 'var(--color-danger-500)' }} />
                      <span>Heures sup 50% : au-dela de 43h</span>
                    </div>
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: '#991b1b' }} />
                      <span>Limite absolue : 48h/semaine max</span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            TAB 3 : DISTRIBUTION GARDES
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'guards' && (
          <>
            <div className="ap-guards-nav">
              <button className="ap-guards-nav-btn" onClick={() => setGuardsMonthOffset(o => o + 1)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h3 className="ap-guards-nav-title">{guardsMonthLabel || 'Chargement...'}</h3>
              <button
                className="ap-guards-nav-btn"
                onClick={() => setGuardsMonthOffset(o => Math.max(0, o - 1))}
                disabled={guardsMonthOffset === 0}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {guardsLoading ? (
              <div className="ap-loading-content">
                <div className="ap-spinner" />
                <p>Calcul des gardes...</p>
              </div>
            ) : (
              <>
                {guardsStats && (
                  <section className="ap-ot-kpi-grid">
                    <div className="ap-ot-kpi-card">
                      <span className="ap-ot-kpi-value">{guardsStats.totalGuards}</span>
                      <span className="ap-ot-kpi-label">Total gardes</span>
                    </div>
                    <div className="ap-ot-kpi-card">
                      <span className="ap-ot-kpi-value">{guardsStats.avgGuardsPerEmployee}</span>
                      <span className="ap-ot-kpi-label">Moy. par employe</span>
                    </div>
                    <div className="ap-ot-kpi-card">
                      <span className={`ap-ot-kpi-value ${guardsStats.imbalancedEmployees > 0 ? 'ap-ot-kpi-value--warning' : 'ap-ot-kpi-value--success'}`}>
                        {guardsStats.imbalancedEmployees}
                      </span>
                      <span className="ap-ot-kpi-label">Desequilibres</span>
                    </div>
                    <div className="ap-ot-kpi-card">
                      <div className="ap-ot-kpi-breakdown">
                        <span className="ap-ot-kpi-mini">Soir: {guardsStats.eveningTotal}</span>
                        <span className="ap-ot-kpi-mini">Nuit: {guardsStats.nightTotal}</span>
                        <span className="ap-ot-kpi-mini">Dim: {guardsStats.sundayTotal}</span>
                      </div>
                      <span className="ap-ot-kpi-label">Repartition</span>
                    </div>
                  </section>
                )}

                <section className="ap-guards-bars-section">
                  <h2 className="ap-section-title">Distribution par employe</h2>
                  <div className="ap-guards-bars-list">
                    {guardsSorted.map((guard) => {
                      const maxGuards = Math.max(...guardsSorted.map(g => g.totalGuards), 1);
                      const barWidth = (guard.totalGuards / maxGuards) * 100;

                      return (
                        <div key={guard.employeeId} className="ap-guards-bar-row">
                          <div className="ap-guards-bar-info">
                            <span className="ap-guards-bar-name">{guard.employeeName}</span>
                            <span className="ap-guards-bar-role">{guard.role}</span>
                          </div>

                          <div className="ap-guards-bar-track">
                            <div
                              className={`ap-guards-bar-fill ap-guards-bar-fill--${guard.distribution.toLowerCase()}`}
                              style={{ width: `${Math.max(barWidth, 2)}%` }}
                            >
                              {guard.totalGuards > 0 && (
                                <span className="ap-guards-bar-label">
                                  {guard.eveningGuards > 0 && `S:${guard.eveningGuards} `}
                                  {guard.nightGuards > 0 && `N:${guard.nightGuards} `}
                                  {guard.sundayGuards > 0 && `D:${guard.sundayGuards}`}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="ap-guards-bar-count">{guard.totalGuards}</span>

                          {guard.distribution !== 'NORMAL' && guard.totalGuards > 0 && (
                            <span className={`ap-badge ap-badge--${guard.distribution === 'LOW' ? 'warning' : 'danger'}`}>
                              {guard.distribution === 'LOW' ? 'Sous-charge' : 'Sur-charge'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {guardsSorted.length === 0 && (
                      <div className="ap-guards-empty"><p>Aucune donnee de garde pour ce mois</p></div>
                    )}
                  </div>
                </section>

                <section className="ap-legend">
                  <h3 className="ap-legend-title">Legende</h3>
                  <div className="ap-legend-grid">
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: '#10b981' }} />
                      <span>S = Garde soir (20h30-23h)</span>
                    </div>
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: '#6366f1' }} />
                      <span>N = Garde nuit (23h+)</span>
                    </div>
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: '#f59e0b' }} />
                      <span>D = Dimanche</span>
                    </div>
                    <div className="ap-legend-item">
                      <span className="ap-legend-dot" style={{ backgroundColor: 'var(--color-danger-500)' }} />
                      <span>Sur-charge = &gt;140% de la moyenne</span>
                    </div>
                  </div>
                </section>

                <section className="ap-table-section">
                  <h2 className="ap-section-title">Detail par employe</h2>
                  <div className="ap-table-wrapper">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Employe</th>
                          <th>Role</th>
                          <th>Soir</th>
                          <th>Nuit</th>
                          <th>Dimanche</th>
                          <th>Total</th>
                          <th>Heures</th>
                          <th>Equilibre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {guardsSorted.map((guard) => (
                          <tr key={guard.employeeId}>
                            <td className="ap-emp-name">{guard.employeeName}</td>
                            <td>{guard.role}</td>
                            <td>{guard.eveningGuards}</td>
                            <td>{guard.nightGuards}</td>
                            <td>{guard.sundayGuards}</td>
                            <td className="ap-cell--bold">{guard.totalGuards}</td>
                            <td>{guard.totalGuardHours}h</td>
                            <td>
                              {guard.totalGuards === 0 ? (
                                <span className="ap-badge ap-badge--neutral">Aucune</span>
                              ) : guard.distribution === 'NORMAL' ? (
                                <span className="ap-badge ap-badge--success">Equilibre</span>
                              ) : guard.distribution === 'LOW' ? (
                                <span className="ap-badge ap-badge--warning">Sous-charge</span>
                              ) : (
                                <span className="ap-badge ap-badge--danger">Sur-charge</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {guardsSorted.length === 0 && (
                          <tr><td colSpan={8} className="ap-empty-row">Aucune donnee pour ce mois</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        /* ─── Page layout ─── */
        .analytics-page {
          max-width: var(--content-max-width); margin: 0 auto;
          padding: var(--spacing-6); display: flex; flex-direction: column; gap: var(--spacing-6);
        }

        /* ─── Header ─── */
        .analytics-page .ap-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: var(--spacing-4);
        }
        .analytics-page .ap-header-left { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .analytics-page .ap-title {
          font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900); margin: 0;
        }
        .analytics-page .ap-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }
        .analytics-page .ap-header-actions {
          display: flex; align-items: center; gap: var(--spacing-3); flex-wrap: wrap;
        }

        /* ─── Period selector ─── */
        .analytics-page .ap-period-selector {
          display: flex; background-color: var(--color-neutral-100);
          border-radius: var(--radius-md); padding: 2px;
        }
        .analytics-page .ap-period-btn {
          padding: var(--spacing-1) var(--spacing-3); border: none;
          border-radius: var(--radius-sm); background: transparent;
          color: var(--color-neutral-600); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); cursor: pointer;
          transition: all var(--transition-fast); font-family: var(--font-family-primary);
        }
        .analytics-page .ap-period-btn:hover { color: var(--color-neutral-900); }
        .analytics-page .ap-period-btn--active {
          background-color: white; color: var(--color-primary-700); box-shadow: var(--shadow-sm);
        }

        /* ─── Export ─── */
        .analytics-page .ap-export-actions { display: flex; gap: var(--spacing-2); }
        .analytics-page .ap-export-btn {
          display: flex; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); background-color: white;
          color: var(--color-neutral-700); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); cursor: pointer;
          transition: all var(--transition-fast); font-family: var(--font-family-primary);
        }
        .analytics-page .ap-export-btn:hover:not(:disabled) {
          border-color: var(--color-primary-300); color: var(--color-primary-700);
          background-color: var(--color-primary-50);
        }
        .analytics-page .ap-export-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ─── Tab Toggle ─── */
        .analytics-page .ap-tab-toggle { display: flex; gap: var(--spacing-2); }
        .analytics-page .ap-tab-btn {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .analytics-page .ap-tab-btn:hover { border-color: var(--color-neutral-300); background: var(--color-neutral-50); }
        .analytics-page .ap-tab-btn--active {
          background: var(--color-primary-600); border-color: var(--color-primary-600); color: white;
        }
        .analytics-page .ap-tab-btn--active:hover { background: var(--color-primary-700); }

        /* ─── Error ─── */
        .analytics-page .ap-error {
          display: flex; align-items: center; gap: var(--spacing-3);
          padding: var(--spacing-4); background-color: var(--color-danger-50);
          border: 1px solid var(--color-danger-200); border-radius: var(--radius-md);
          color: var(--color-danger-700);
        }
        .analytics-page .ap-error p { margin: 0; font-size: var(--font-size-sm); }
        .analytics-page .ap-retry-btn {
          padding: var(--spacing-1) var(--spacing-3); border: 1px solid var(--color-danger-300);
          border-radius: var(--radius-sm); background-color: white;
          color: var(--color-danger-700); font-size: var(--font-size-sm);
          cursor: pointer; white-space: nowrap; font-family: var(--font-family-primary);
        }
        .analytics-page .ap-retry-btn:hover { background-color: var(--color-danger-50); }

        /* ─── Loading ─── */
        .analytics-page .ap-loading-content {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--spacing-3); min-height: 300px;
          color: var(--color-neutral-500); font-size: var(--font-size-sm);
        }
        .analytics-page .ap-spinner {
          width: 32px; height: 32px; border: 3px solid var(--color-neutral-200);
          border-top-color: var(--color-primary-500); border-radius: 50%;
          animation: ap-spin 0.8s linear infinite;
        }
        @keyframes ap-spin { to { transform: rotate(360deg); } }

        /* ─── KPI / Charts ─── */
        .analytics-page .ap-kpi-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-4);
        }
        .analytics-page .ap-charts-grid-2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4);
        }

        /* ─── Sections ─── */
        .analytics-page .ap-section-title {
          font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800); margin: 0;
        }

        /* ─── Predictions ─── */
        .analytics-page .ap-predictions-section { display: flex; flex-direction: column; gap: var(--spacing-4); }
        .analytics-page .ap-predictions-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--spacing-4);
        }
        .analytics-page .ap-prediction-card {
          background-color: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); padding: var(--spacing-4);
          display: flex; flex-direction: column; gap: var(--spacing-2);
        }
        .analytics-page .ap-prediction-card--alert { border-left: 3px solid var(--color-warning-500); }
        .analytics-page .ap-prediction-card--recommendation { border-left: 3px solid var(--color-primary-500); }
        .analytics-page .ap-prediction-card--trend { border-left: 3px solid var(--color-success-500); }
        .analytics-page .ap-prediction-header { display: flex; align-items: center; justify-content: space-between; }
        .analytics-page .ap-prediction-badge {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-neutral-500);
        }
        .analytics-page .ap-prediction-confidence { font-size: var(--font-size-xs); color: var(--color-neutral-400); }
        .analytics-page .ap-prediction-title {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800); margin: 0;
        }
        .analytics-page .ap-prediction-desc {
          font-size: var(--font-size-sm); color: var(--color-neutral-600);
          margin: 0; line-height: var(--line-height-relaxed);
        }

        /* ─── Tables ─── */
        .analytics-page .ap-table-section { display: flex; flex-direction: column; gap: var(--spacing-4); }
        .analytics-page .ap-table-wrapper {
          background-color: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); overflow-x: auto;
        }
        .analytics-page .ap-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
        .analytics-page .ap-table th {
          padding: var(--spacing-3) var(--spacing-4); text-align: left;
          font-weight: var(--font-weight-semibold); color: var(--color-neutral-600);
          background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);
          white-space: nowrap;
        }
        .analytics-page .ap-table td {
          padding: var(--spacing-3) var(--spacing-4); color: var(--color-neutral-700);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .analytics-page .ap-table tbody tr:hover { background-color: var(--color-neutral-50); }
        .analytics-page .ap-emp-name { font-weight: var(--font-weight-medium); color: var(--color-neutral-900); }
        .analytics-page .ap-row--warning { background-color: var(--color-warning-50); }
        .analytics-page .ap-row--warning:hover { background-color: var(--color-warning-100) !important; }
        .analytics-page .ap-cell--danger { color: var(--color-danger-600); font-weight: var(--font-weight-bold); }
        .analytics-page .ap-cell--bold { font-weight: var(--font-weight-bold); }
        .analytics-page .ap-empty-row {
          text-align: center; color: var(--color-neutral-400); padding: var(--spacing-8) !important;
        }

        /* ─── Badges ─── */
        .analytics-page .ap-badge {
          display: inline-flex; align-items: center; padding: 2px 10px;
          border-radius: var(--radius-full); font-size: 11px;
          font-weight: var(--font-weight-bold); white-space: nowrap;
        }
        .analytics-page .ap-badge--success { background: var(--color-success-50); color: var(--color-success-700); }
        .analytics-page .ap-badge--warning { background: var(--color-warning-50); color: var(--color-warning-700); }
        .analytics-page .ap-badge--danger { background: var(--color-danger-50); color: var(--color-danger-700); }
        .analytics-page .ap-badge--neutral { background: var(--color-neutral-100); color: var(--color-neutral-500); }

        /* ═══════════════════════════════════════════════════
           OVERTIME SECTION
           ═══════════════════════════════════════════════════ */
        .analytics-page .ap-ot-controls { display: flex; align-items: center; gap: var(--spacing-3); }
        .analytics-page .ap-ot-controls-label {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-600);
        }
        .analytics-page .ap-ot-kpi-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-4);
        }
        .analytics-page .ap-ot-kpi-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .analytics-page .ap-ot-kpi-value {
          font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-600);
        }
        .analytics-page .ap-ot-kpi-value--danger { color: var(--color-danger-600); }
        .analytics-page .ap-ot-kpi-value--warning { color: var(--color-warning-600); }
        .analytics-page .ap-ot-kpi-value--success { color: var(--color-success-600); }
        .analytics-page .ap-ot-kpi-label {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500); text-align: center;
        }
        .analytics-page .ap-ot-kpi-breakdown { display: flex; gap: var(--spacing-3); }
        .analytics-page .ap-ot-kpi-mini {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-700);
        }

        /* ─── Legend ─── */
        .analytics-page .ap-legend {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-4);
        }
        .analytics-page .ap-legend-title {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700); margin: 0 0 var(--spacing-3);
        }
        .analytics-page .ap-legend-grid { display: flex; flex-wrap: wrap; gap: var(--spacing-4); }
        .analytics-page .ap-legend-item {
          display: flex; align-items: center; gap: var(--spacing-2);
          font-size: var(--font-size-xs); color: var(--color-neutral-600);
        }
        .analytics-page .ap-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

        /* ═══════════════════════════════════════════════════
           GUARDS SECTION
           ═══════════════════════════════════════════════════ */
        .analytics-page .ap-guards-nav {
          display: flex; align-items: center; justify-content: center; gap: var(--spacing-4);
          padding: var(--spacing-3) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .analytics-page .ap-guards-nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; color: var(--color-neutral-600); transition: all 0.15s ease;
          font-family: var(--font-family-primary);
        }
        .analytics-page .ap-guards-nav-btn:hover:not(:disabled) {
          background: var(--color-neutral-50); border-color: var(--color-neutral-300);
        }
        .analytics-page .ap-guards-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .analytics-page .ap-guards-nav-title {
          font-size: var(--font-size-lg); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800); margin: 0; min-width: 200px; text-align: center;
        }

        /* ─── Guards bars ─── */
        .analytics-page .ap-guards-bars-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-5);
          display: flex; flex-direction: column; gap: var(--spacing-4);
        }
        .analytics-page .ap-guards-bars-list { display: flex; flex-direction: column; gap: var(--spacing-3); }
        .analytics-page .ap-guards-bar-row {
          display: flex; align-items: center; gap: var(--spacing-3);
          padding: var(--spacing-2) var(--spacing-3);
          background: var(--color-neutral-50); border-radius: var(--radius-md);
        }
        .analytics-page .ap-guards-bar-info { min-width: 160px; display: flex; flex-direction: column; gap: 2px; }
        .analytics-page .ap-guards-bar-name {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-800);
        }
        .analytics-page .ap-guards-bar-role { font-size: 11px; color: var(--color-neutral-400); }
        .analytics-page .ap-guards-bar-track {
          flex: 1; height: 28px; background: var(--color-neutral-200);
          border-radius: var(--radius-sm); overflow: hidden;
        }
        .analytics-page .ap-guards-bar-fill {
          height: 100%; display: flex; align-items: center; padding: 0 var(--spacing-2);
          transition: width 0.3s ease; border-radius: var(--radius-sm);
        }
        .analytics-page .ap-guards-bar-fill--normal { background: var(--color-primary-500); }
        .analytics-page .ap-guards-bar-fill--low { background: var(--color-warning-500); }
        .analytics-page .ap-guards-bar-fill--high { background: var(--color-danger-500); }
        .analytics-page .ap-guards-bar-label {
          font-size: 10px; font-weight: var(--font-weight-bold); color: white;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .analytics-page .ap-guards-bar-count {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700); min-width: 24px; text-align: right;
        }
        .analytics-page .ap-guards-empty {
          text-align: center; padding: var(--spacing-8);
          color: var(--color-neutral-400); font-size: var(--font-size-sm);
        }
        .analytics-page .ap-guards-empty p { margin: 0; }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .analytics-page .ap-charts-grid-2 { grid-template-columns: 1fr; }
          .analytics-page .ap-header { flex-direction: column; }
          .analytics-page .ap-header-actions { width: 100%; justify-content: space-between; }
          .analytics-page .ap-ot-kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .analytics-page .ap-tab-toggle { flex-wrap: wrap; }
          .analytics-page .ap-guards-bar-info { min-width: 120px; }
        }

        @media (max-width: 640px) {
          .analytics-page { padding: var(--spacing-3); gap: var(--spacing-4); }
          .analytics-page .ap-ot-kpi-grid { grid-template-columns: 1fr 1fr; }
          .analytics-page .ap-guards-bar-info { min-width: 90px; }
          .analytics-page .ap-guards-bar-name { font-size: var(--font-size-xs); }
          .analytics-page .ap-guards-bar-role { display: none; }
          .analytics-page .ap-legend-grid { flex-direction: column; gap: var(--spacing-2); }
        }

        /* ─── Print ─── */
        @media print {
          .analytics-page .ap-tab-toggle,
          .analytics-page .ap-period-selector,
          .analytics-page .ap-export-actions,
          .analytics-page .ap-ot-controls,
          .analytics-page .ap-guards-nav { display: none !important; }
          .analytics-page .ap-table { font-size: 11px; }
        }
      `}</style>
    </>
  );
}
