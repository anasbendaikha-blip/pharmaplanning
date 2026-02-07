'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import KPICard from '@/components/analytics/KPICard';
import LineChartCard from '@/components/analytics/LineChartCard';
import BarChartCard from '@/components/analytics/BarChartCard';
import PieChartCard from '@/components/analytics/PieChartCard';
import { exportAnalyticsPDF, exportAnalyticsExcel } from '@/lib/analytics/report-generator';
import type { AnalyticsDashboard, AnalyticsPeriod } from '@/lib/analytics/types';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '12m', label: '12 mois' },
];

const KPI_ICONS: Record<string, string> = {
  totalHours: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  totalShifts: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  averageHoursPerEmployee: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  overtimeHours: 'M13 10V3L4 14h7v7l9-11h-7z',
  leaveDays: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  complianceRate: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function AnalyticsPage() {
  const { organizationId, organizationName, isLoading: orgLoading } = useOrganization();
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          filters: { period },
        }),
      });

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }

      const data: AnalyticsDashboard = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error('❌ Analytics fetch error:', err);
      setError('Impossible de charger les analytics. Reessayez.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, period]);

  useEffect(() => {
    if (!orgLoading && organizationId) {
      fetchDashboard();
    }
  }, [orgLoading, organizationId, fetchDashboard]);

  const handleExportPDF = () => {
    if (dashboard) {
      exportAnalyticsPDF(dashboard, organizationName || 'Pharmacie');
    }
  };

  const handleExportExcel = () => {
    if (dashboard) {
      exportAnalyticsExcel(dashboard, organizationName || 'Pharmacie');
    }
  };

  if (orgLoading) {
    return (
      <div className="analytics-loading">
        <p>Chargement...</p>
        <style jsx>{`
          .analytics-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            color: var(--color-neutral-500);
            font-size: var(--font-size-base);
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="analytics-page">
        {/* ─── Header ─── */}
        <div className="analytics-header">
          <div className="header-left">
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">
              Tableau de bord analytique — {organizationName || 'Pharmacie'}
            </p>
          </div>
          <div className="header-actions">
            <div className="period-selector">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`period-btn ${period === opt.value ? 'period-btn--active' : ''}`}
                  onClick={() => setPeriod(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="export-actions">
              <button
                className="export-btn"
                onClick={handleExportPDF}
                disabled={!dashboard}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="18" />
                  <line x1="15" y1="15" x2="12" y2="18" />
                </svg>
                PDF
              </button>
              <button
                className="export-btn"
                onClick={handleExportExcel}
                disabled={!dashboard}
              >
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

        {/* ─── Error ─── */}
        {error && (
          <div className="analytics-error">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchDashboard}>
              Reessayer
            </button>
          </div>
        )}

        {/* ─── Loading ─── */}
        {loading && !dashboard && (
          <div className="analytics-loading-content">
            <div className="spinner" />
            <p>Calcul des analytics...</p>
          </div>
        )}

        {/* ─── Dashboard Content ─── */}
        {dashboard && (
          <>
            {/* KPIs */}
            <section className="kpi-section">
              <div className="kpi-grid">
                {(Object.keys(dashboard.kpis) as Array<keyof typeof dashboard.kpis>).map((key) => (
                  <KPICard
                    key={key}
                    metric={dashboard.kpis[key]}
                    icon={KPI_ICONS[key]}
                  />
                ))}
              </div>
            </section>

            {/* Charts Row 1: Line + Bar */}
            <section className="charts-section">
              <div className="charts-grid-2">
                <LineChartCard
                  title="Heures par semaine"
                  data={dashboard.charts.hoursPerWeek}
                  color="#10b981"
                  unit="h"
                />
                <BarChartCard
                  title="Shifts par jour"
                  data={dashboard.charts.shiftsPerDay}
                  color="#3b82f6"
                />
              </div>
            </section>

            {/* Charts Row 2: Pie charts */}
            <section className="charts-section">
              <div className="charts-grid-2">
                <PieChartCard
                  title="Repartition par type de shift"
                  data={dashboard.charts.shiftTypeDistribution}
                />
                <PieChartCard
                  title="Repartition par type de conge"
                  data={dashboard.charts.leaveTypeDistribution}
                />
              </div>
            </section>

            {/* Charts Row 3: Employee bar chart */}
            <section className="charts-section">
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

            {/* Predictions */}
            {dashboard.predictions.length > 0 && (
              <section className="predictions-section">
                <h2 className="section-title">Predictions & Recommandations</h2>
                <div className="predictions-grid">
                  {dashboard.predictions.map((pred, i) => (
                    <div
                      key={i}
                      className={`prediction-card prediction-card--${pred.type}`}
                    >
                      <div className="prediction-header">
                        <span className="prediction-badge">
                          {pred.type === 'alert'
                            ? 'Alerte'
                            : pred.type === 'recommendation'
                              ? 'Recommandation'
                              : 'Tendance'}
                        </span>
                        <span className="prediction-confidence">
                          {pred.confidence}% confiance
                        </span>
                      </div>
                      <h3 className="prediction-title">{pred.title}</h3>
                      <p className="prediction-desc">{pred.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Employees Table */}
            {dashboard.topEmployees.length > 0 && (
              <section className="table-section">
                <h2 className="section-title">Top employes</h2>
                <div className="table-wrapper">
                  <table className="analytics-table">
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
                          <td className="emp-name">{emp.employeeName}</td>
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
      </div>

      <style jsx>{`
        .analytics-page {
          max-width: var(--content-max-width);
          margin: 0 auto;
          padding: var(--spacing-6);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
        }

        .analytics-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-4);
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
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

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          flex-wrap: wrap;
        }

        .period-selector {
          display: flex;
          background-color: var(--color-neutral-100);
          border-radius: var(--radius-md);
          padding: 2px;
        }

        .period-btn {
          padding: var(--spacing-1) var(--spacing-3);
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-neutral-600);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .period-btn:hover {
          color: var(--color-neutral-900);
        }

        .period-btn--active {
          background-color: white;
          color: var(--color-primary-700);
          box-shadow: var(--shadow-sm);
        }

        .export-actions {
          display: flex;
          gap: var(--spacing-2);
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-1);
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          background-color: white;
          color: var(--color-neutral-700);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .export-btn:hover:not(:disabled) {
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
          background-color: var(--color-primary-50);
        }

        .export-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .analytics-error {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-4);
          background-color: var(--color-danger-50);
          border: 1px solid var(--color-danger-200);
          border-radius: var(--radius-md);
          color: var(--color-danger-700);
        }

        .analytics-error p {
          margin: 0;
          font-size: var(--font-size-sm);
        }

        .retry-btn {
          padding: var(--spacing-1) var(--spacing-3);
          border: 1px solid var(--color-danger-300);
          border-radius: var(--radius-sm);
          background-color: white;
          color: var(--color-danger-700);
          font-size: var(--font-size-sm);
          cursor: pointer;
          white-space: nowrap;
        }

        .retry-btn:hover {
          background-color: var(--color-danger-50);
        }

        .analytics-loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-3);
          min-height: 300px;
          color: var(--color-neutral-500);
          font-size: var(--font-size-sm);
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-neutral-200);
          border-top-color: var(--color-primary-500);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .kpi-section {
          /* no extra styles needed */
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-4);
        }

        .charts-section {
          /* wrapper */
        }

        .charts-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }

        @media (max-width: 768px) {
          .charts-grid-2 {
            grid-template-columns: 1fr;
          }

          .analytics-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
            justify-content: space-between;
          }
        }

        .predictions-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
        }

        .section-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0;
        }

        .predictions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-4);
        }

        .prediction-card {
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: var(--spacing-4);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .prediction-card--alert {
          border-left: 3px solid var(--color-warning-500);
        }

        .prediction-card--recommendation {
          border-left: 3px solid var(--color-primary-500);
        }

        .prediction-card--trend {
          border-left: 3px solid var(--color-success-500);
        }

        .prediction-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .prediction-badge {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-neutral-500);
        }

        .prediction-confidence {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
        }

        .prediction-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0;
        }

        .prediction-desc {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-600);
          margin: 0;
          line-height: var(--line-height-relaxed);
        }

        .table-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
        }

        .table-wrapper {
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          overflow-x: auto;
        }

        .analytics-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .analytics-table th {
          padding: var(--spacing-3) var(--spacing-4);
          text-align: left;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          background-color: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .analytics-table td {
          padding: var(--spacing-3) var(--spacing-4);
          color: var(--color-neutral-700);
          border-bottom: 1px solid var(--color-neutral-100);
        }

        .analytics-table tbody tr:hover {
          background-color: var(--color-neutral-50);
        }

        .emp-name {
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-900);
        }
      `}</style>
    </>
  );
}
