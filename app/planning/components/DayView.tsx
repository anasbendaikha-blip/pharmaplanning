'use client';

import { useMemo, memo } from 'react';
import type { Employee, Shift, Conflict, EmployeeCategory } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import ConflictBadge from './ConflictBadge';

/** Plage horaire de la timeline (8h - 20h) */
const TIMELINE_START = 8;
const TIMELINE_END = 20;
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START; // 12h

/** Ordre d'affichage des catégories */
const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

/** Info catégories */
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  pharmacien_titulaire: { label: 'Pharmaciens Titulaires', color: '#2563eb' },
  pharmacien_adjoint: { label: 'Pharmaciens Adjoints', color: '#3b82f6' },
  preparateur: { label: 'Préparateurs', color: '#10b981' },
  rayonniste: { label: 'Rayonnistes', color: '#f59e0b' },
  apprenti: { label: 'Apprentis', color: '#8b5cf6' },
  etudiant: { label: 'Étudiants', color: '#ec4899' },
};

/** Noms de jours en français */
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface DayViewProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  date: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
}

export default function DayView({
  employees,
  shifts,
  conflicts,
  date,
  onCellClick,
}: DayViewProps) {
  // Shifts du jour uniquement
  const dayShifts = useMemo(() => {
    return shifts.filter(s => s.date === date);
  }, [shifts, date]);

  // Employés groupés par catégorie
  const employeesByCategory = useMemo(() => {
    const groups = new Map<EmployeeCategory, Employee[]>();
    for (const cat of CATEGORY_ORDER) {
      const catEmployees = employees
        .filter(e => e.category === cat && e.is_active)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));
      if (catEmployees.length > 0) {
        groups.set(cat, catEmployees);
      }
    }
    return groups;
  }, [employees]);

  // Shifts par employé
  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of dayShifts) {
      const existing = map.get(shift.employee_id) || [];
      existing.push(shift);
      map.set(shift.employee_id, existing);
    }
    return map;
  }, [dayShifts]);

  // Label du jour
  const dateLabel = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${DAY_NAMES[dt.getDay()]} ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
  }, [date]);

  // Stats du jour
  const dayStats = useMemo(() => {
    const presentIds = new Set(dayShifts.map(s => s.employee_id));
    const totalHours = dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);
    return { present: presentIds.size, totalHours };
  }, [dayShifts]);

  // Heures de la timeline
  const timelineHours = useMemo(() => {
    return Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);
  }, []);

  return (
    <>
      <div className="dayview">
        {/* En-tête du jour */}
        <div className="dayview-header-bar">
          <h3 className="dayview-date">{dateLabel}</h3>
          <div className="dayview-stats">
            <span className="dayview-stat">{dayStats.present} présents</span>
            <span className="dayview-stat">{formatHours(dayStats.totalHours)} planifiées</span>
          </div>
        </div>

        {/* Timeline header */}
        <div className="dayview-timeline-wrap">
          <div className="dayview-emp-header">Employé</div>
          <div className="dayview-timeline-header">
            {timelineHours.map(h => (
              <div key={h} className="dayview-hour-mark">
                <span className="dayview-hour-label">{h}h</span>
              </div>
            ))}
          </div>
          <div className="dayview-total-header">Total</div>
        </div>

        {/* Lignes par catégorie */}
        <div className="dayview-body">
          {Array.from(employeesByCategory.entries()).map(([category, catEmployees]) => {
            const info = CATEGORY_INFO[category] || { label: category, color: '#666' };

            return (
              <div key={category}>
                {/* Séparateur catégorie */}
                <div className="dayview-category">
                  <span className="dayview-cat-dot" style={{ backgroundColor: info.color }} />
                  <span className="dayview-cat-label">{info.label}</span>
                  <span className="dayview-cat-count">{catEmployees.length}</span>
                </div>

                {/* Lignes employé */}
                {catEmployees.map(emp => (
                  <DayViewRow
                    key={emp.id}
                    employee={emp}
                    shifts={shiftsByEmployee.get(emp.id) || []}
                    conflicts={conflicts.filter(c => c.employee_ids.includes(emp.id) && c.date === date)}
                    date={date}
                    onCellClick={onCellClick}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .dayview {
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: white;
        }

        .dayview-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-3) var(--spacing-4);
          border-bottom: 1px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
        }

        .dayview-date {
          margin: 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .dayview-stats {
          display: flex;
          gap: var(--spacing-3);
        }

        .dayview-stat {
          padding: 2px var(--spacing-3);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
        }

        .dayview-timeline-wrap {
          display: grid;
          grid-template-columns: 180px 1fr 80px;
          position: sticky;
          top: 0;
          z-index: 5;
          background: var(--color-neutral-50);
          border-bottom: 2px solid var(--color-neutral-300);
        }

        .dayview-emp-header {
          padding: var(--spacing-2) var(--spacing-3);
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-right: 2px solid var(--color-neutral-300);
        }

        .dayview-timeline-header {
          display: flex;
          position: relative;
        }

        .dayview-hour-mark {
          flex: 1;
          padding: var(--spacing-2) 0;
          text-align: left;
          border-left: 1px solid var(--color-neutral-200);
          padding-left: 4px;
        }

        .dayview-hour-label {
          font-size: 10px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
        }

        .dayview-total-header {
          padding: var(--spacing-2) var(--spacing-3);
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-left: 2px solid var(--color-neutral-300);
          text-align: center;
        }

        .dayview-body {
          max-height: calc(100vh - 320px);
          overflow-y: auto;
        }

        .dayview-category {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-1) var(--spacing-3);
          background: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .dayview-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dayview-cat-label {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .dayview-cat-count {
          font-size: 10px;
          color: var(--color-neutral-400);
          font-weight: var(--font-weight-medium);
        }
      `}</style>
    </>
  );
}

/** Ligne d'un employé dans la vue jour */
interface DayViewRowProps {
  employee: Employee;
  shifts: Shift[];
  conflicts: Conflict[];
  date: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
}

const DayViewRow = memo(function DayViewRow({
  employee,
  shifts,
  conflicts,
  date,
  onCellClick,
}: DayViewRowProps) {
  const totalHours = shifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const hasConflicts = conflicts.some(c => c.severity === 'error');

  return (
    <>
      <div
        className={`dayrow ${hasConflicts ? 'dayrow--conflict' : ''}`}
        onClick={() => onCellClick(employee.id, date, shifts.length > 0 ? shifts[0] : null)}
      >
        {/* Info employé */}
        <div className="dayrow-emp">
          <span className="dayrow-dot" style={{ backgroundColor: employee.display_color }} />
          <div className="dayrow-info">
            <span className="dayrow-name">{employee.first_name} {employee.last_name}</span>
          </div>
        </div>

        {/* Timeline avec barres */}
        <div className="dayrow-timeline">
          {/* Lignes de grille horaires */}
          {Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => (
            <div
              key={i}
              className={`dayrow-gridline ${i === 0 ? '' : ''}`}
              style={{ left: `${(i / TIMELINE_HOURS) * 100}%` }}
            />
          ))}

          {/* Barres de shift */}
          {shifts.map(shift => {
            const startMinutes = timeToMinutes(shift.start_time);
            const endMinutes = timeToMinutes(shift.end_time);
            const timelineStartMin = TIMELINE_START * 60;
            const timelineEndMin = TIMELINE_END * 60;
            const timelineRange = timelineEndMin - timelineStartMin;

            // Clamp dans la timeline
            const barStart = Math.max(0, ((startMinutes - timelineStartMin) / timelineRange) * 100);
            const barEnd = Math.min(100, ((endMinutes - timelineStartMin) / timelineRange) * 100);
            const barWidth = barEnd - barStart;

            if (barWidth <= 0) return null;

            return (
              <div
                key={shift.id}
                className="dayrow-bar"
                style={{
                  left: `${barStart}%`,
                  width: `${barWidth}%`,
                  backgroundColor: employee.display_color,
                }}
                title={`${formatTime(shift.start_time)} - ${formatTime(shift.end_time)} (${formatHours(shift.effective_hours)})`}
              >
                <span className="dayrow-bar-label">
                  {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                </span>
                {shift.break_duration > 0 && (
                  <span className="dayrow-bar-break">
                    P:{shift.break_duration}min
                  </span>
                )}
              </div>
            );
          })}

          {/* Badges de conflits */}
          {conflicts.length > 0 && (
            <div className="dayrow-conflicts">
              {conflicts.map(c => (
                <ConflictBadge
                  key={c.id}
                  severity={c.severity}
                  message={c.message}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        {/* Total heures */}
        <div className="dayrow-total">
          {totalHours > 0 ? (
            <span className="dayrow-total-val">{formatHours(totalHours)}</span>
          ) : (
            <span className="dayrow-total-empty">—</span>
          )}
        </div>
      </div>

      <style jsx>{`
        .dayrow {
          display: grid;
          grid-template-columns: 180px 1fr 80px;
          min-height: 44px;
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .dayrow:hover {
          background-color: var(--color-neutral-50);
        }

        .dayrow--conflict {
          background-color: var(--color-danger-50);
        }
        .dayrow--conflict:hover {
          background-color: var(--color-danger-100);
        }

        .dayrow-emp {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-3);
          border-right: 2px solid var(--color-neutral-300);
        }

        .dayrow-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .dayrow-info {
          overflow: hidden;
        }

        .dayrow-name {
          font-size: 12px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .dayrow-timeline {
          position: relative;
          padding: 6px 0;
        }

        .dayrow-gridline {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background-color: var(--color-neutral-100);
        }

        .dayrow-bar {
          position: absolute;
          top: 6px;
          bottom: 6px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: 0 var(--spacing-2);
          color: white;
          overflow: hidden;
          z-index: 1;
          min-height: 24px;
          opacity: 0.85;
          transition: opacity var(--transition-fast);
        }

        .dayrow:hover .dayrow-bar {
          opacity: 1;
        }

        .dayrow-bar-label {
          font-size: 10px;
          font-weight: var(--font-weight-bold);
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .dayrow-bar-break {
          font-size: 9px;
          opacity: 0.8;
          white-space: nowrap;
        }

        .dayrow-conflicts {
          position: absolute;
          top: 2px;
          right: 4px;
          display: flex;
          gap: 2px;
          z-index: 2;
        }

        .dayrow-total {
          display: flex;
          align-items: center;
          justify-content: center;
          border-left: 2px solid var(--color-neutral-300);
          padding: var(--spacing-1) var(--spacing-2);
        }

        .dayrow-total-val {
          font-size: 12px;
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .dayrow-total-empty {
          font-size: 12px;
          color: var(--color-neutral-300);
        }
      `}</style>
    </>
  );
});

/** Convertit "HH:MM" en minutes depuis minuit */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Formate une heure "HH:MM" → "Xh" ou "XhMM" */
function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  return min === 0 ? `${hour}h` : `${hour}h${m}`;
}
