/**
 * WeekGanttView — Vue Gantt semaine globale
 *
 * Affiche 7 colonnes (Lun-Dim) avec barres miniatures par employe.
 * Pastille couleur par employe (PAS de titres de categories).
 * Disponibilites etudiants : fond vert (dispo) / rouge (non dispo).
 * Clic cellule -> switch vers vue jour. Clic barre -> editer.
 * Legende en footer.
 *
 * Conventions : styled-jsx, prefix "wg-", pas d'emojis, ASCII uniquement.
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Employee, Shift, EmployeeCategory } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';

// --- Constants ---

const ROLE_COLORS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: '#dc2626',
  pharmacien_adjoint: '#ea580c',
  preparateur: '#16a34a',
  rayonniste: '#f59e0b',
  apprenti: '#7c3aed',
  etudiant: '#2563eb',
};

const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

const LEGEND_ITEMS: { label: string; color: string }[] = [
  { label: 'Pharmacien Titulaire', color: '#dc2626' },
  { label: 'Pharmacien Adjoint', color: '#ea580c' },
  { label: 'Preparateur', color: '#16a34a' },
  { label: 'Apprenti', color: '#7c3aed' },
  { label: 'Etudiant', color: '#2563eb' },
];

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const SIDEBAR_WIDTH = 160;
const ROW_HEIGHT = 64;

// --- Types ---

interface StudentAvailability {
  employeeId: string;
  /** Map of ISO date -> available */
  days: Map<string, boolean>;
}

interface WeekGanttViewProps {
  employees: Employee[];
  shifts: Shift[];
  weekDates: string[]; // 7 ISO dates (Lun-Dim)
  todayStr: string;
  onDayClick: (dayIndex: number) => void;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  studentAvailabilities?: StudentAvailability[];
}

// --- Helpers ---

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftEffectiveHours(shift: Shift): number {
  const startMin = timeToMinutes(shift.start_time);
  const endMin = timeToMinutes(shift.end_time);
  const totalMin = endMin - startMin - (shift.break_duration || 0);
  return Math.max(0, totalMin / 60);
}

function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].filter(e => e.is_active).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.last_name.localeCompare(b.last_name);
  });
}

function formatDayNum(isoDate: string): string {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function formatTimeCompact(time: string): string {
  const [h, m] = time.split(':');
  if (m === '00') return `${parseInt(h)}h`;
  return `${parseInt(h)}h${m}`;
}

// --- Component ---

export default function WeekGanttView({
  employees,
  shifts,
  weekDates,
  todayStr,
  onDayClick,
  onCellClick,
  studentAvailabilities = [],
}: WeekGanttViewProps) {
  const [tooltipData, setTooltipData] = useState<{ shift: Shift; emp: Employee; x: number; y: number } | null>(null);

  const sortedEmployees = useMemo(() => sortEmployees(employees), [employees]);

  // Index shifts by employee+date
  const shiftsIndex = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.employee_id}__${s.date}`;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [shifts]);

  // Availability index
  const availIndex = useMemo(() => {
    const map = new Map<string, boolean>(); // key = empId__date
    for (const sa of studentAvailabilities) {
      for (const [date, avail] of sa.days) {
        map.set(`${sa.employeeId}__${date}`, avail);
      }
    }
    return map;
  }, [studentAvailabilities]);

  // Weekly hours per employee
  const weeklyHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shifts) {
      const curr = map.get(s.employee_id) || 0;
      map.set(s.employee_id, curr + shiftEffectiveHours(s));
    }
    return map;
  }, [shifts]);

  // --- Handlers ---

  const handleCellClick = useCallback((e: React.MouseEvent, dayIndex: number) => {
    // If the click was on a shift bar, don't navigate
    const target = e.target as HTMLElement;
    if (target.closest('.wg-shift-bar')) return;
    onDayClick(dayIndex);
  }, [onDayClick]);

  const handleBarClick = useCallback((e: React.MouseEvent, employeeId: string, date: string, shift: Shift) => {
    e.stopPropagation();
    onCellClick(employeeId, date, shift);
  }, [onCellClick]);

  const handleBarMouseEnter = useCallback((e: React.MouseEvent, shift: Shift, emp: Employee) => {
    setTooltipData({ shift, emp, x: e.clientX, y: e.clientY });
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  // Determine which days are "closed" (Sunday by default)
  const isSunday = (dateStr: string) => getDayOfWeek(dateStr) === 0;

  return (
    <>
      <div className="wg-container">
        {/* Header row */}
        <div className="wg-header">
          <div className="wg-header-name">EMPLOYE</div>
          {weekDates.map((d, i) => {
            const isToday = d === todayStr;
            const closed = isSunday(d);
            return (
              <div
                key={d}
                className={`wg-header-day ${isToday ? 'wg-header-day--today' : ''} ${closed ? 'wg-header-day--closed' : ''}`}
                onClick={() => onDayClick(i)}
              >
                <span className="wg-day-name">{DAY_NAMES[i]}</span>
                <span className="wg-day-date">{formatDayNum(d)}</span>
              </div>
            );
          })}
          <div className="wg-header-total">H/sem</div>
        </div>

        {/* Body */}
        <div className="wg-body">
          {sortedEmployees.length === 0 ? (
            <div className="wg-empty">Aucun employe actif</div>
          ) : (
            sortedEmployees.map((emp, index) => {
              const empWeekHours = weeklyHours.get(emp.id) || 0;
              const isStudent = emp.category === 'etudiant';

              return (
                <div key={emp.id}>
                  {/* Employee row — NO category separator headers */}
                  <div className={`wg-row ${index % 2 === 0 ? 'wg-row--even' : ''}`}>
                    {/* Name with color badge (no category title) */}
                    <div className="wg-row-name">
                      <div
                        className="wg-role-badge"
                        style={{ backgroundColor: ROLE_COLORS[emp.category] }}
                      />
                      <span className="wg-name-text">
                        {emp.first_name} {emp.last_name.charAt(0)}.
                      </span>
                    </div>

                    {/* Day cells */}
                    {weekDates.map((d, dayIdx) => {
                      const key = `${emp.id}__${d}`;
                      const cellShifts = shiftsIndex.get(key) || [];
                      const closed = isSunday(d);
                      const isToday = d === todayStr;
                      const isSat = getDayOfWeek(d) === 6;

                      // Student availability
                      const availKey = `${emp.id}__${d}`;
                      const hasAvail = availIndex.has(availKey);
                      const isAvailable = availIndex.get(availKey) ?? true;

                      let cellBg = '';
                      if (isStudent && hasAvail && cellShifts.length === 0) {
                        cellBg = isAvailable ? 'wg-cell--available' : 'wg-cell--unavailable';
                      }

                      return (
                        <div
                          key={d}
                          className={`wg-cell ${closed ? 'wg-cell--closed' : ''} ${isToday ? 'wg-cell--today' : ''} ${cellBg}`}
                          onClick={(e) => handleCellClick(e, dayIdx)}
                        >
                          {closed ? (
                            <span className="wg-closed-text">Ferme</span>
                          ) : cellShifts.length === 0 && isStudent && hasAvail ? (
                            <span className={`wg-dispo-label ${isAvailable ? 'wg-dispo-label--yes' : 'wg-dispo-label--no'}`}>
                              {isAvailable ? 'DISPO' : 'NON DISPO'}
                            </span>
                          ) : (
                            <div className="wg-shifts-stack">
                              {cellShifts.map(shift => {
                                const showPause = shift.break_duration > 0 && (isSat || shiftEffectiveHours(shift) >= 6);
                                return (
                                  <div
                                    key={shift.id}
                                    className="wg-shift-bar"
                                    style={{ backgroundColor: ROLE_COLORS[emp.category] }}
                                    onClick={(e) => handleBarClick(e, emp.id, d, shift)}
                                    onMouseEnter={(e) => handleBarMouseEnter(e, shift, emp)}
                                    onMouseLeave={handleBarMouseLeave}
                                  >
                                    <span className="wg-bar-text">
                                      {formatTimeCompact(shift.start_time)}-{formatTimeCompact(shift.end_time)}
                                    </span>
                                    {showPause && (
                                      <span className="wg-bar-pause">P{shift.break_duration}min</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Weekly total */}
                    <div className={`wg-total ${empWeekHours > 35 ? 'wg-total--over' : ''}`}>
                      {empWeekHours > 0 ? formatHours(empWeekHours) : '-'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend footer */}
        <div className="wg-legend">
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="wg-legend-item">
              <span className="wg-legend-dot" style={{ backgroundColor: item.color }} />
              <span className="wg-legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <div
          className="wg-tooltip"
          style={{ left: tooltipData.x + 12, top: tooltipData.y - 10 }}
        >
          <div className="wg-tooltip-name">
            {tooltipData.emp.first_name} {tooltipData.emp.last_name}
          </div>
          <div className="wg-tooltip-time">
            {tooltipData.shift.start_time} - {tooltipData.shift.end_time}
          </div>
          <div className="wg-tooltip-hours">
            {formatHours(shiftEffectiveHours(tooltipData.shift))} effectives
            {tooltipData.shift.break_duration > 0 && ` | Pause ${tooltipData.shift.break_duration}min`}
          </div>
          {tooltipData.shift.notes && (
            <div className="wg-tooltip-notes">{tooltipData.shift.notes}</div>
          )}
          <div className="wg-tooltip-hint">Cliquer pour editer / Cliquer cellule pour vue jour</div>
        </div>
      )}

      <style jsx>{`
        .wg-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border: 1px solid var(--color-neutral-200, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
        }

        /* Header */
        .wg-header {
          display: flex;
          background: var(--color-neutral-50, #f9fafb);
          border-bottom: 2px solid var(--color-neutral-200, #e5e7eb);
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .wg-header-name {
          width: ${SIDEBAR_WIDTH}px;
          min-width: ${SIDEBAR_WIDTH}px;
          padding: 8px 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-neutral-500, #6b7280);
          border-right: 1px solid var(--color-neutral-200, #e5e7eb);
          display: flex;
          align-items: flex-end;
        }

        .wg-header-day {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 4px;
          border-right: 1px solid var(--color-neutral-200, #e5e7eb);
          cursor: pointer;
          transition: background 0.1s;
          min-width: 0;
        }

        .wg-header-day:hover {
          background: var(--color-neutral-100, #f3f4f6);
        }

        .wg-header-day--today {
          background: rgba(99, 102, 241, 0.08);
        }

        .wg-header-day--today:hover {
          background: rgba(99, 102, 241, 0.12);
        }

        .wg-header-day--closed {
          background: var(--color-neutral-100, #f3f4f6);
          opacity: 0.6;
        }

        .wg-day-name {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-neutral-500, #6b7280);
        }

        .wg-header-day--today .wg-day-name {
          color: var(--color-primary-600, #4f46e5);
        }

        .wg-day-date {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-700, #374151);
        }

        .wg-header-day--today .wg-day-date {
          color: var(--color-primary-700, #4338ca);
        }

        .wg-header-total {
          width: 60px;
          min-width: 60px;
          padding: 8px 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-neutral-500, #6b7280);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        /* Body */
        .wg-body {
          flex: 1;
          overflow-y: auto;
        }

        .wg-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--color-neutral-400, #9ca3af);
          font-size: 14px;
        }

        /* Employee row — no category separators */
        .wg-row {
          display: flex;
          min-height: ${ROW_HEIGHT}px;
          border-bottom: 1px solid var(--color-neutral-100, #f3f4f6);
        }

        .wg-row--even {
          background: rgba(0, 0, 0, 0.01);
        }

        /* Name with badge */
        .wg-row-name {
          width: ${SIDEBAR_WIDTH}px;
          min-width: ${SIDEBAR_WIDTH}px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 12px;
          border-right: 1px solid var(--color-neutral-200, #e5e7eb);
          overflow: hidden;
        }

        .wg-role-badge {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .wg-name-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-800, #1f2937);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Day cell */
        .wg-cell {
          flex: 1;
          min-width: 0;
          padding: 4px 3px;
          border-right: 1px solid var(--color-neutral-100, #f3f4f6);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
          transition: background 0.1s;
        }

        .wg-cell:hover {
          background: rgba(99, 102, 241, 0.04);
        }

        .wg-cell--today {
          background: rgba(99, 102, 241, 0.04);
          border-left: 2px solid var(--color-primary-400, #818cf8);
        }

        .wg-cell--closed {
          background: var(--color-neutral-50, #f9fafb);
          cursor: default;
        }

        .wg-cell--available {
          background: #d1fae5 !important;
        }

        .wg-cell--available:hover {
          background: #a7f3d0 !important;
        }

        .wg-cell--unavailable {
          background: #fee2e2 !important;
        }

        .wg-cell--unavailable:hover {
          background: #fecaca !important;
        }

        .wg-closed-text {
          font-size: 10px;
          color: var(--color-neutral-400, #9ca3af);
          text-align: center;
          font-weight: 500;
        }

        .wg-dispo-label {
          font-size: 10px;
          font-weight: 700;
          text-align: center;
          padding: 4px 0;
        }

        .wg-dispo-label--yes {
          color: #059669;
        }

        .wg-dispo-label--no {
          color: #dc2626;
        }

        /* Shift bars stack */
        .wg-shifts-stack {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .wg-shift-bar {
          padding: 3px 4px;
          border-radius: 4px;
          color: white;
          font-size: 10px;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 22px;
        }

        .wg-shift-bar:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }

        .wg-bar-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .wg-bar-pause {
          font-size: 9px;
          opacity: 0.85;
          flex-shrink: 0;
        }

        /* Weekly total */
        .wg-total {
          width: 60px;
          min-width: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-600, #4b5563);
        }

        .wg-total--over {
          color: #dc2626;
          font-weight: 700;
        }

        /* Legend footer */
        .wg-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          padding: 12px 16px;
          border-top: 1px solid var(--color-neutral-200, #e5e7eb);
          background: var(--color-neutral-50, #f9fafb);
          flex-shrink: 0;
        }

        .wg-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wg-legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .wg-legend-label {
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
        }

        /* Tooltip */
        .wg-tooltip {
          position: fixed;
          z-index: 50;
          background: #1f2937;
          color: white;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          pointer-events: none;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          max-width: 260px;
        }

        .wg-tooltip-name {
          font-weight: 700;
          font-size: 13px;
        }

        .wg-tooltip-time {
          font-weight: 600;
          margin-top: 2px;
        }

        .wg-tooltip-hours {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 2px;
        }

        .wg-tooltip-notes {
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
          font-style: italic;
        }

        .wg-tooltip-hint {
          font-size: 9px;
          opacity: 0.5;
          margin-top: 6px;
        }

        /* Print */
        @media print {
          .wg-container { border: none; }
          .wg-shift-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .wg-cell--available,
          .wg-cell--unavailable { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .wg-legend { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .wg-header-name,
          .wg-row-name {
            width: 100px;
            min-width: 100px;
          }
          .wg-role-badge { width: 8px; height: 8px; }
          .wg-bar-text { font-size: 9px; }
          .wg-header-total,
          .wg-total {
            width: 40px;
            min-width: 40px;
          }
          .wg-legend { gap: 12px; }
          .wg-legend-label { font-size: 10px; }
        }
      `}</style>
    </>
  );
}
