'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DistributionItem } from '@/lib/analytics/types';

interface PieChartCardProps {
  title: string;
  data: DistributionItem[];
}

export default function PieChartCard({ title, data }: PieChartCardProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <>
      <div className="chart-card">
        <h3 className="chart-title">{title}</h3>
        <div className="chart-container">
          {data.length === 0 ? (
            <div className="chart-empty">Aucune donnee</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                  formatter={(value, name) => [
                    `${value} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
                    name,
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
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

        .chart-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 260px;
          color: var(--color-neutral-400);
          font-size: var(--font-size-sm);
        }
      `}</style>
    </>
  );
}
