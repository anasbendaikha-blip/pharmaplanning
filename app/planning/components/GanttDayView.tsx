/**
 * GanttDayView — Vue Gantt par jour
 *
 * Affiche une timeline horizontale 7h-20h avec les creneaux de chaque employe.
 * Zones de contexte : bleu fonce = ferme, jaune = pause dejeuner.
 * Clic sur zone vide -> creer creneau, clic sur barre -> editer.
 *
 * Conventions : styled-jsx, prefix "gt-", pas d'emojis, ASCII uniquement.
 */
'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import type { Employee, Shift, EmployeeCategory } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';

// ─── Constants ───

/** Timeline commence a 7h, finit a 20h */
const START_HOUR = 7;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 13h

/** Pharmacie ouverture/fermeture */
const OPEN_TIME = '08:30';
const CLOSE_TIME = '19:30';
const PAUSE_START = '12:30';
const PAUSE_END = '14:00';

/** Couleurs par categorie */
const ROLE_COLORS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: '#dc2626',
  pharmacien_adjoint: '#ea580c',
  preparateur: '#16a34a',
  rayonniste: '#f59e0b',
  apprenti: '#7c3aed',
  etudiant: '#2563eb',
};

const ROLE_LABELS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: 'Ph. Tit.',
  pharmacien_adjoint: 'Ph. Adj.',
  preparateur: 'Prep.',
  rayonniste: 'Ray.',
  apprenti: 'App.',
  etudiant: 'Etud.',
};

/** Ordre des categories */
const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

/** Hauteur d'une ligne employe en px */
const ROW_HEIGHT = 40;

// ─── Types ───

interface GanttDayViewProps {
  employees: Employee[];
  shifts: Shift[];
  date: string;
  todayStr: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onCreateAtTime: (employeeId: string, date: string, startTime: string) => void;
}

// ─── Helpers ───

/** Convertit "HH:MM" en position % sur la timeline */
function timeToPercent(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const minutesFromStart = (h - START_HOUR) * 60 + m;
  const totalMinutes = TOTAL_HOURS * 60;
  return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
}

/** Convertit position % en "HH:MM" (arrondi au quart d'heure) */
function percentToTime(percent: number): string {
  const totalMinutes = TOTAL_HOURS * 60;
  const minutesFromStart = (percent / 100) * totalMinutes;
  const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
  const h = Math.floor(roundedMinutes / 60) + START_HOUR;
  const m = roundedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Calcule heures effectives d'un shift */
function shiftEffectiveHours(shift: Shift): number {
  const [sh, sm] = shift.start_time.split(':').map(Number);
  const [eh, em] = shift.end_time.split(':').map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - (shift.break_duration || 0);
  return Math.max(0, totalMin / 60);
}

/** Trier les employes par categorie puis par nom */
function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].filter(e => e.is_active).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.last_name.localeCompare(b.last_name);
  });
}

/** Generer les heures pour l'axe */
function generateHourMarks(): number[] {
  const marks: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    marks.push(h);
  }
  return marks;
}

// ─── Component ───

export default function GanttDayView({
  employees,
  shifts,
  date,
  todayStr,
  onCellClick,
  onCreateAtTime,
}: GanttDayViewProps) {
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null);
  const [tooltipShift, setTooltipShift] = useState<{ shift: Shift; x: number; y: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const isToday = date === todayStr;

  // Employes tries
  const sortedEmployees = useMemo(() => sortEmployees(employees), [employees]);

  // Index shifts par employeeId
  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    const dayShifts = shifts.filter(s => s.date === date);
    for (const s of dayShifts) {
      const arr = map.get(s.employee_id) || [];
      arr.push(s);
      map.set(s.employee_id, arr);
    }
    return map;
  }, [shifts, date]);

  // Stats du jour
  const dayStats = useMemo(() => {
    const dayShifts = shifts.filter(s => s.date === date);
    const uniqueEmployees = new Set(dayShifts.map(s => s.employee_id)).size;
    const totalHours = dayShifts.reduce((sum, s) => sum + shiftEffectiveHours(s), 0);
    return { present: uniqueEmployees, totalHours };
  }, [shifts, date]);

  // Heure courante (pour l'indicateur "now")
  const nowPercent = useMemo(() => {
    if (!isToday) return -1;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const p = timeToPercent(time);
    return p > 0 && p < 100 ? p : -1;
  }, [isToday]);

  // Marks heures
  const hourMarks = useMemo(() => generateHourMarks(), []);

  // ─── Handlers ───

  const handleBarClick = useCallback((e: React.MouseEvent, employeeId: string, shift: Shift) => {
    e.stopPropagation();
    onCellClick(employeeId, date, shift);
  }, [onCellClick, date]);

  const handleRowClick = useCallback((e: React.MouseEvent, employeeId: string) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    // Calculer la position relative dans la zone timeline
    // La sidebar fait ~180px, on doit la soustraire
    const timelineArea = e.currentTarget.querySelector('.gt-row-timeline') as HTMLElement;
    if (!timelineArea) return;
    const areaRect = timelineArea.getBoundingClientRect();
    const relativeX = e.clientX - areaRect.left;
    const percent = (relativeX / areaRect.width) * 100;
    const clickTime = percentToTime(percent);
    onCreateAtTime(employeeId, date, clickTime);
  }, [date, onCreateAtTime]);

  const handleBarMouseEnter = useCallback((e: React.MouseEvent, shift: Shift) => {
    setHoveredShiftId(shift.id);
    setTooltipShift({ shift, x: e.clientX, y: e.clientY });
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    setHoveredShiftId(null);
    setTooltipShift(null);
  }, []);

  // ─── Zones contexte (positions %) ───
  const zones = useMemo(() => {
    return {
      closedBefore: { left: 0, width: timeToPercent(OPEN_TIME) },
      closedAfter: { left: timeToPercent(CLOSE_TIME), width: 100 - timeToPercent(CLOSE_TIME) },
      pause: { left: timeToPercent(PAUSE_START), width: timeToPercent(PAUSE_END) - timeToPercent(PAUSE_START) },
    };
  }, []);

  return (
    <>
      <div className="gt-container" ref={timelineRef}>
        {/* ─── Timeline Header ─── */}
        <div className="gt-header">
          <div className="gt-header-name">Employe</div>
          <div className="gt-header-timeline">
            {/* Zones de contexte dans le header */}
            <div className="gt-zone gt-zone--closed" style={{ left: `${zones.closedBefore.left}%`, width: `${zones.closedBefore.width}%` }} />
            <div className="gt-zone gt-zone--pause" style={{ left: `${zones.pause.left}%`, width: `${zones.pause.width}%` }} />
            <div className="gt-zone gt-zone--closed" style={{ left: `${zones.closedAfter.left}%`, width: `${zones.closedAfter.width}%` }} />

            {/* Marqueurs d'heures */}
            {hourMarks.map(h => (
              <div
                key={h}
                className="gt-hour-mark"
                style={{ left: `${timeToPercent(`${String(h).padStart(2, '0')}:00`)}%` }}
              >
                <span className="gt-hour-label">{h}h</span>
              </div>
            ))}

            {/* Indicateur "maintenant" */}
            {nowPercent > 0 && (
              <div className="gt-now-line" style={{ left: `${nowPercent}%` }}>
                <div className="gt-now-dot" />
              </div>
            )}
          </div>
        </div>

        {/* ─── Body : lignes employes ─── */}
        <div className="gt-body">
          {sortedEmployees.length === 0 ? (
            <div className="gt-empty">
              <p>Aucun employe actif</p>
            </div>
          ) : (
            sortedEmployees.map((emp, index) => {
              const empShifts = shiftsByEmployee.get(emp.id) || [];
              const prevCategory = index > 0 ? sortedEmployees[index - 1].category : null;
              const showCategorySep = emp.category !== prevCategory;
              const empDayHours = empShifts.reduce((sum, s) => sum + shiftEffectiveHours(s), 0);

              return (
                <div key={emp.id}>
                  {/* Separateur categorie */}
                  {showCategorySep && (
                    <div className="gt-cat-sep">
                      <span className="gt-cat-dot" style={{ backgroundColor: ROLE_COLORS[emp.category] }} />
                      <span className="gt-cat-text">{ROLE_LABELS[emp.category]}</span>
                    </div>
                  )}

                  {/* Ligne employe */}
                  <div
                    className={`gt-row ${index % 2 === 0 ? 'gt-row--even' : ''}`}
                    onClick={(e) => handleRowClick(e, emp.id)}
                  >
                    {/* Sidebar nom */}
                    <div className="gt-row-name">
                      <span className="gt-avatar" style={{ backgroundColor: ROLE_COLORS[emp.category] }}>
                        {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                      </span>
                      <div className="gt-name-text">
                        <span className="gt-name-main">
                          {emp.first_name} {emp.last_name.charAt(0)}.
                        </span>
                        {empDayHours > 0 && (
                          <span className="gt-name-hours">{formatHours(empDayHours)}</span>
                        )}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="gt-row-timeline">
                      {/* Zones de contexte */}
                      <div className="gt-zone gt-zone--closed-row" style={{ left: `${zones.closedBefore.left}%`, width: `${zones.closedBefore.width}%` }} />
                      <div className="gt-zone gt-zone--pause-row" style={{ left: `${zones.pause.left}%`, width: `${zones.pause.width}%` }} />
                      <div className="gt-zone gt-zone--closed-row" style={{ left: `${zones.closedAfter.left}%`, width: `${zones.closedAfter.width}%` }} />

                      {/* Lignes verticales demi-heures */}
                      {hourMarks.map(h => (
                        <div
                          key={h}
                          className="gt-gridline"
                          style={{ left: `${timeToPercent(`${String(h).padStart(2, '0')}:00`)}%` }}
                        />
                      ))}

                      {/* Indicateur now */}
                      {nowPercent > 0 && (
                        <div className="gt-now-line-row" style={{ left: `${nowPercent}%` }} />
                      )}

                      {/* Barres de creneaux */}
                      {empShifts.map(shift => {
                        const left = timeToPercent(shift.start_time);
                        const right = timeToPercent(shift.end_time);
                        const width = right - left;
                        const isHovered = hoveredShiftId === shift.id;
                        const hours = shiftEffectiveHours(shift);
                        const isSpecial = shift.type === 'garde' || shift.type === 'formation' || shift.type === 'conge' || shift.type === 'maladie';

                        return (
                          <div
                            key={shift.id}
                            className={`gt-bar ${isHovered ? 'gt-bar--hovered' : ''} ${isSpecial ? 'gt-bar--special' : ''}`}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(width, 1)}%`,
                              backgroundColor: ROLE_COLORS[emp.category],
                            }}
                            onClick={(e) => handleBarClick(e, emp.id, shift)}
                            onMouseEnter={(e) => handleBarMouseEnter(e, shift)}
                            onMouseLeave={handleBarMouseLeave}
                            title={`${shift.start_time}-${shift.end_time} (${formatHours(hours)})`}
                          >
                            {width > 8 && (
                              <span className="gt-bar-text">
                                {shift.start_time}-{shift.end_time}
                              </span>
                            )}
                            {width > 15 && hours > 0 && (
                              <span className="gt-bar-hours">{formatHours(hours)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Legende ─── */}
        <div className="gt-legend">
          {CATEGORY_ORDER.filter(cat => sortedEmployees.some(e => e.category === cat)).map(cat => (
            <div key={cat} className="gt-legend-item">
              <span className="gt-legend-dot" style={{ backgroundColor: ROLE_COLORS[cat] }} />
              <span className="gt-legend-text">{ROLE_LABELS[cat]}</span>
            </div>
          ))}
          <div className="gt-legend-sep" />
          <div className="gt-legend-item">
            <span className="gt-legend-zone gt-legend-zone--closed" />
            <span className="gt-legend-text">Ferme</span>
          </div>
          <div className="gt-legend-item">
            <span className="gt-legend-zone gt-legend-zone--pause" />
            <span className="gt-legend-text">Pause</span>
          </div>
        </div>
      </div>

      {/* ─── Tooltip ─── */}
      {tooltipShift && (
        <div
          className="gt-tooltip"
          style={{ left: tooltipShift.x + 12, top: tooltipShift.y - 10 }}
        >
          <div className="gt-tooltip-time">
            {tooltipShift.shift.start_time} - {tooltipShift.shift.end_time}
          </div>
          <div className="gt-tooltip-info">
            {formatHours(shiftEffectiveHours(tooltipShift.shift))} effectives
            {tooltipShift.shift.break_duration > 0 && ` | Pause ${tooltipShift.shift.break_duration}min`}
          </div>
          {tooltipShift.shift.notes && (
            <div className="gt-tooltip-notes">{tooltipShift.shift.notes}</div>
          )}
          <div className="gt-tooltip-hint">Cliquer pour editer</div>
        </div>
      )}

      <style jsx>{`
        .gt-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        /* ═══ Header Timeline ═══ */
        .gt-header {
          display: flex;
          border-bottom: 2px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
          flex-shrink: 0;
        }

        .gt-header-name {
          width: 180px;
          min-width: 140px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-neutral-500);
          border-right: 1px solid var(--color-neutral-200);
          display: flex;
          align-items: flex-end;
        }

        .gt-header-timeline {
          flex: 1;
          position: relative;
          height: 36px;
          overflow: hidden;
        }

        /* ═══ Hour marks ═══ */
        .gt-hour-mark {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--color-neutral-200);
        }

        .gt-hour-label {
          position: absolute;
          bottom: 4px;
          left: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-neutral-500);
          white-space: nowrap;
          user-select: none;
        }

        /* ═══ Zones de contexte ═══ */
        .gt-zone {
          position: absolute;
          top: 0;
          bottom: 0;
          pointer-events: none;
        }

        .gt-zone--closed {
          background: rgba(30, 58, 138, 0.08);
        }

        .gt-zone--pause {
          background: rgba(254, 240, 138, 0.5);
        }

        .gt-zone--closed-row {
          background: rgba(30, 58, 138, 0.06);
        }

        .gt-zone--pause-row {
          background: rgba(254, 240, 138, 0.25);
        }

        /* ═══ Now indicator ═══ */
        .gt-now-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #dc2626;
          z-index: 5;
        }

        .gt-now-dot {
          position: absolute;
          top: -3px;
          left: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #dc2626;
        }

        .gt-now-line-row {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(220, 38, 38, 0.3);
          z-index: 3;
          pointer-events: none;
        }

        /* ═══ Body ═══ */
        .gt-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .gt-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--color-neutral-400);
          font-size: 14px;
        }

        /* ═══ Category separator ═══ */
        .gt-cat-sep {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 12px;
          background: var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .gt-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .gt-cat-text {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-neutral-500);
        }

        /* ═══ Row ═══ */
        .gt-row {
          display: flex;
          height: ${ROW_HEIGHT}px;
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: pointer;
          transition: background 0.1s;
        }

        .gt-row:hover {
          background: rgba(99, 102, 241, 0.03);
        }

        .gt-row--even {
          background: rgba(0, 0, 0, 0.01);
        }

        .gt-row--even:hover {
          background: rgba(99, 102, 241, 0.03);
        }

        /* ═══ Row name sidebar ═══ */
        .gt-row-name {
          width: 180px;
          min-width: 140px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          border-right: 1px solid var(--color-neutral-200);
          overflow: hidden;
          flex-shrink: 0;
        }

        .gt-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }

        .gt-name-text {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .gt-name-main {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-800);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gt-name-hours {
          font-size: 10px;
          color: var(--color-neutral-400);
          font-weight: 500;
        }

        /* ═══ Row timeline ═══ */
        .gt-row-timeline {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .gt-gridline {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--color-neutral-100);
          pointer-events: none;
        }

        /* ═══ Shift bar ═══ */
        .gt-bar {
          position: absolute;
          top: 4px;
          height: ${ROW_HEIGHT - 8}px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: white;
          cursor: pointer;
          z-index: 2;
          transition: transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
          min-width: 4px;
        }

        .gt-bar:hover,
        .gt-bar--hovered {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 4;
        }

        .gt-bar--special {
          border: 2px dashed rgba(255, 255, 255, 0.5);
        }

        .gt-bar-text {
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .gt-bar-hours {
          font-size: 9px;
          font-weight: 500;
          opacity: 0.85;
          white-space: nowrap;
        }

        /* ═══ Legend ═══ */
        .gt-legend {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 12px;
          border-top: 1px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .gt-legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .gt-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .gt-legend-zone {
          width: 14px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .gt-legend-zone--closed {
          background: rgba(30, 58, 138, 0.15);
          border: 1px solid rgba(30, 58, 138, 0.3);
        }

        .gt-legend-zone--pause {
          background: rgba(254, 240, 138, 0.6);
          border: 1px solid rgba(202, 138, 4, 0.3);
        }

        .gt-legend-text {
          font-size: 10px;
          color: var(--color-neutral-500);
          font-weight: 500;
        }

        .gt-legend-sep {
          width: 1px;
          height: 14px;
          background: var(--color-neutral-300);
        }

        /* ═══ Tooltip ═══ */
        .gt-tooltip {
          position: fixed;
          z-index: 50;
          background: var(--color-neutral-900);
          color: white;
          border-radius: var(--radius-md);
          padding: 8px 12px;
          font-size: 12px;
          pointer-events: none;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          max-width: 240px;
        }

        .gt-tooltip-time {
          font-weight: 700;
          font-size: 13px;
        }

        .gt-tooltip-info {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 2px;
        }

        .gt-tooltip-notes {
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
          font-style: italic;
        }

        .gt-tooltip-hint {
          font-size: 9px;
          opacity: 0.5;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* ═══ Print ═══ */
        @media print {
          .gt-legend { display: none; }
          .gt-container { border: none; }
          .gt-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .gt-zone { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }

        /* ═══ Responsive ═══ */
        @media (max-width: 768px) {
          .gt-header-name,
          .gt-row-name {
            width: 100px;
            min-width: 80px;
          }
          .gt-avatar { display: none; }
          .gt-name-main { font-size: 11px; }
        }
      `}</style>
    </>
  );
}
