'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesData } from '@/lib/analytics/types';

interface LineChartCardProps {
  title: string;
  data: TimeSeriesData[];
  color?: string;
  unit?: string;
}

export default function LineChartCard({
  title,
  data,
  color = '#10b981',
  unit = '',
}: LineChartCardProps) {
  return (
    <>
      <div className="chart-card">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
                formatter={(value) => [`${value}${unit}`, title]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <style jsx>{`
        .chart-card {
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: var(--spacing-5);
        }

        .chart-title {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0 0 var(--spacing-4) 0;
        }

        .chart-container {
          width: 100%;
          min-height: 260px;
        }
      `}</style>
    </>
  );
}
