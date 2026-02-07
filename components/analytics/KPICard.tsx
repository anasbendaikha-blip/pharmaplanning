'use client';

import type { KPIMetric } from '@/lib/analytics/types';

interface KPICardProps {
  metric: KPIMetric;
  icon?: string;
}

export default function KPICard({ metric, icon }: KPICardProps) {
  const trendColor =
    metric.trend === 'up'
      ? 'var(--color-success-500)'
      : metric.trend === 'down'
        ? 'var(--color-danger-500)'
        : 'var(--color-neutral-400)';

  const trendArrow =
    metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';

  return (
    <>
      <div className="kpi-card">
        <div className="kpi-header">
          {icon && (
            <svg
              className="kpi-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={icon} />
            </svg>
          )}
          <span className="kpi-label">{metric.label}</span>
        </div>

        <div className="kpi-value">
          {metric.value}
          {metric.unit && <span className="kpi-unit">{metric.unit}</span>}
        </div>

        <div className="kpi-footer">
          <span className="kpi-trend" style={{ color: trendColor }}>
            {trendArrow} {metric.trendValue}%
          </span>
          <span className="kpi-prev">
            vs {metric.previousValue}{metric.unit}
          </span>
        </div>
      </div>

      <style jsx>{`
        .kpi-card {
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: var(--spacing-5);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
          transition: all var(--transition-fast);
        }

        .kpi-card:hover {
          border-color: var(--color-primary-300);
          box-shadow: var(--shadow-sm);
        }

        .kpi-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .kpi-icon {
          color: var(--color-primary-500);
          flex-shrink: 0;
        }

        .kpi-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
        }

        .kpi-value {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
          line-height: var(--line-height-tight);
        }

        .kpi-unit {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
          margin-left: var(--spacing-1);
        }

        .kpi-footer {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .kpi-trend {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        .kpi-prev {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
        }
      `}</style>
    </>
  );
}
