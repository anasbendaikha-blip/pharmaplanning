'use client';

import { memo } from 'react';
import { getDayShortFr, parseISODate } from '@/lib/utils/dateUtils';

interface TimelineHeaderProps {
  weekDates: string[];
  todayStr: string;
  /** Nombre d'employés planifiés par jour */
  dailyEmployeeCounts: Record<string, number>;
  /** Heures totales planifiées par jour */
  dailyTotalHours: Record<string, number>;
}

function TimelineHeaderComponent({
  weekDates,
  todayStr,
  dailyEmployeeCounts,
  dailyTotalHours: _dailyTotalHours,
}: TimelineHeaderProps) {
  return (
    <>
      <thead className="timeline-header">
        <tr>
          {/* Colonne employé */}
          <th className="header-employee-col">
            <span className="header-employee-label">Employé</span>
          </th>

          {/* Colonnes jours */}
          {weekDates.map(dateStr => {
            const date = parseISODate(dateStr);
            const isToday = dateStr === todayStr;
            const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1; // 0=lun
            const isSunday = dayIndex === 6;
            const empCount = dailyEmployeeCounts[dateStr] || 0;

            return (
              <th
                key={dateStr}
                className={`header-day ${isToday ? 'header-day--today' : ''} ${isSunday ? 'header-day--sunday' : ''}`}
              >
                <span className="header-day-name">{getDayShortFr(date)}</span>
                <span className="header-day-date">{date.getDate()}</span>
                <span className="header-day-meta">{empCount} emp.</span>
              </th>
            );
          })}

          {/* Colonne total */}
          <th className="header-total-col">
            <span className="header-total-label">Total</span>
            <span className="header-total-sub">Semaine</span>
          </th>
        </tr>
      </thead>

      <style jsx>{`
        .timeline-header {
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .timeline-header tr {
          background-color: var(--color-neutral-100);
        }

        .header-employee-col {
          position: sticky;
          left: 0;
          z-index: 11;
          background-color: var(--color-neutral-100);
          border-right: 2px solid var(--color-neutral-300);
          border-bottom: 2px solid var(--color-neutral-300);
          padding: var(--spacing-2);
          min-width: 180px;
          max-width: 180px;
          text-align: left;
        }

        .header-employee-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-day {
          padding: var(--spacing-1) var(--spacing-2);
          border-right: 1px solid var(--color-neutral-200);
          border-bottom: 2px solid var(--color-neutral-300);
          text-align: center;
          min-width: var(--planning-cell-min-width);
          background-color: var(--color-neutral-100);
        }

        .header-day--today {
          background-color: var(--color-primary-100);
        }

        .header-day--sunday {
          background-color: var(--color-neutral-200);
        }

        .header-day-name {
          display: block;
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-day-date {
          display: block;
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
          line-height: 1.2;
        }

        .header-day--today .header-day-date {
          color: var(--color-primary-700);
        }

        .header-day-meta {
          display: block;
          font-size: 9px;
          color: var(--color-neutral-500);
          font-weight: var(--font-weight-medium);
        }

        .header-total-col {
          position: sticky;
          right: 0;
          z-index: 11;
          background-color: var(--color-neutral-100);
          border-left: 2px solid var(--color-neutral-300);
          border-bottom: 2px solid var(--color-neutral-300);
          padding: var(--spacing-2);
          min-width: 90px;
          text-align: center;
        }

        .header-total-label {
          display: block;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .header-total-sub {
          display: block;
          font-size: 9px;
          color: var(--color-neutral-400);
        }
      `}</style>
    </>
  );
}

export default memo(TimelineHeaderComponent);
