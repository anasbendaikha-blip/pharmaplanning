/**
 * GanttDayView — Vue Gantt detaillee par jour
 *
 * Timeline horizontale 7h-21h avec barres de creneaux par employe.
 * Bandes bleues avant ouverture / apres fermeture (pharmacie fermee).
 * Zone jaune fermeture 12h30-13h30 (Lun-Ven) avec label "FERME".
 * Samedi : pas de fermeture midi, pauses affichees sur barres longues.
 * Disponibilites etudiants : fond vert (dispo) / rouge (non dispo).
 * PAS de titres de categories — seulement pastille couleur par employe.
 * Legende en footer.
 *
 * Conventions : styled-jsx, prefix "gd-", pas d'emojis, ASCII uniquement.
 */
'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Employee, Shift, EmployeeCategory } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';

// --- Constants ---

const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 14h
const HOUR_PX = 60; // pixels par heure

/** Horaires d'ouverture pharmacie */
const OPEN_WEEKDAY = '08:30';
const CLOSE_WEEKDAY = '20:30';
const OPEN_SATURDAY = '08:30';
const CLOSE_SATURDAY = '19:30';

/** Fermeture midi Lun-Ven */
const CLOSURE_START = '12:30';
const CLOSURE_END = '13:30';

/** Couleurs par categorie */
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

const ROW_HEIGHT = 56;
const BAR_HEIGHT = 32;
const SIDEBAR_WIDTH = 180;

// --- Types ---

interface StudentAvailability {
  employeeId: string;
  available: boolean;
}

interface GanttDayViewProps {
  employees: Employee[];
  shifts: Shift[];
  date: string;
  todayStr: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onCreateAtTime: (employeeId: string, date: string, startTime: string) => void;
  studentAvailabilities?: StudentAvailability[];
}

// --- Helpers ---

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeToPercent(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const minutesFromStart = (h - START_HOUR) * 60 + m;
  const totalMinutes = TOTAL_HOURS * 60;
  return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
}

function percentToTime(percent: number): string {
  const totalMinutes = TOTAL_HOURS * 60;
  const minutesFromStart = (percent / 100) * totalMinutes;
  const roundedMinutes = Math.round(minutesFromStart / 15) * 15;
  const h = Math.floor(roundedMinutes / 60) + START_HOUR;
  const m = roundedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function shiftEffectiveHours(shift: Shift): number {
  const startMin = timeToMinutes(shift.start_time);
  const endMin = timeToMinutes(shift.end_time);
  const totalMin = endMin - startMin - (shift.break_duration || 0);
  return Math.max(0, totalMin / 60);
}

function shiftDurationHours(shift: Shift): number {
  const startMin = timeToMinutes(shift.start_time);
  const endMin = timeToMinutes(shift.end_time);
  return Math.max(0, (endMin - startMin) / 60);
}

function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].filter(e => e.is_active).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.last_name.localeCompare(b.last_name);
  });
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Dim, 6=Sam
}

function formatDateLong(dateStr: string): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${days[date.getDay()]} ${d} ${months[m - 1]} ${y}`;
}

// --- Component ---

export default function GanttDayView({
  employees,
  shifts,
  date,
  todayStr,
  onCellClick,
  onCreateAtTime,
  studentAvailabilities = [],
}: GanttDayViewProps) {
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{ shift: Shift; emp: Employee; x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isToday = date === todayStr;
  const dayOfWeek = getDayOfWeek(date);
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const showClosure = !isSaturday && !isSunday; // Fermeture seulement Lun-Ven

  // Horaires ouverture/fermeture selon le jour
  const openTime = isSaturday ? OPEN_SATURDAY : OPEN_WEEKDAY;
  const closeTime = isSaturday ? CLOSE_SATURDAY : CLOSE_WEEKDAY;

  // Zones fermees (bandes bleues)
  const closedBeforePercent = timeToPercent(openTime);
  const closedAfterPercent = timeToPercent(closeTime);

  const sortedEmployees = useMemo(() => sortEmployees(employees), [employees]);

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

  // Availability map for students
  const availabilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const sa of studentAvailabilities) {
      map.set(sa.employeeId, sa.available);
    }
    return map;
  }, [studentAvailabilities]);

  // Now indicator
  const [nowPercent, setNowPercent] = useState(-1);
  useEffect(() => {
    function updateNow() {
      if (!isToday) { setNowPercent(-1); return; }
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const p = timeToPercent(time);
      setNowPercent(p > 0 && p < 100 ? p : -1);
    }
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  // Hour marks
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) marks.push(h);
    return marks;
  }, []);

  // Closure zone positions (yellow zone)
  const closureZone = useMemo(() => {
    if (!showClosure) return null;
    return {
      left: timeToPercent(CLOSURE_START),
      width: timeToPercent(CLOSURE_END) - timeToPercent(CLOSURE_START),
    };
  }, [showClosure]);

  // Timeline width in pixels
  const timelineWidth = TOTAL_HOURS * HOUR_PX;

  // --- Handlers ---

  const handleBarClick = useCallback((e: React.MouseEvent, employeeId: string, shift: Shift) => {
    e.stopPropagation();
    onCellClick(employeeId, date, shift);
  }, [onCellClick, date]);

  const handleRowClick = useCallback((e: React.MouseEvent, employeeId: string) => {
    const timelineArea = (e.currentTarget as HTMLElement).querySelector('.gd-row-timeline') as HTMLElement;
    if (!timelineArea) return;
    const areaRect = timelineArea.getBoundingClientRect();
    const relativeX = e.clientX - areaRect.left;
    const percent = (relativeX / areaRect.width) * 100;
    const clickTime = percentToTime(percent);
    onCreateAtTime(employeeId, date, clickTime);
  }, [date, onCreateAtTime]);

  const handleBarMouseEnter = useCallback((e: React.MouseEvent, shift: Shift, emp: Employee) => {
    setHoveredShiftId(shift.id);
    setTooltipData({ shift, emp, x: e.clientX, y: e.clientY });
  }, []);

  const handleBarMouseLeave = useCallback(() => {
    setHoveredShiftId(null);
    setTooltipData(null);
  }, []);

  return (
    <>
      <div className="gd-container">
        {/* Date title */}
        <div className="gd-date-title">
          {formatDateLong(date).toUpperCase()}
        </div>

        {/* Timeline header + body in scrollable container */}
        <div className="gd-scroll-wrap" ref={scrollContainerRef}>
          {/* Header */}
          <div className="gd-header">
            <div className="gd-header-name">EMPLOYE</div>
            <div className="gd-header-timeline" style={{ minWidth: `${timelineWidth}px` }}>
              {/* Closed zones (blue bands) */}
              {!isSunday && (
                <>
                  <div
                    className="gd-closed-zone"
                    style={{ left: '0%', width: `${closedBeforePercent}%` }}
                  />
                  <div
                    className="gd-closed-zone"
                    style={{ left: `${closedAfterPercent}%`, width: `${100 - closedAfterPercent}%` }}
                  />
                </>
              )}

              {/* Closure zone in header (yellow) */}
              {closureZone && (
                <div
                  className="gd-closure gd-closure--header"
                  style={{ left: `${closureZone.left}%`, width: `${closureZone.width}%` }}
                />
              )}

              {/* Hour marks */}
              {hourMarks.map(h => (
                <div
                  key={h}
                  className="gd-hour-mark"
                  style={{ left: `${timeToPercent(`${String(h).padStart(2, '0')}:00`)}%` }}
                >
                  <span className="gd-hour-label">{h}h</span>
                </div>
              ))}

              {/* Now line */}
              {nowPercent > 0 && (
                <div className="gd-now" style={{ left: `${nowPercent}%` }}>
                  <div className="gd-now-dot" />
                </div>
              )}
            </div>
          </div>

          {/* Body rows */}
          <div className="gd-body">
            {sortedEmployees.length === 0 ? (
              <div className="gd-empty">
                <p>Aucun employe actif</p>
              </div>
            ) : (
              sortedEmployees.map((emp, index) => {
                const empShifts = shiftsByEmployee.get(emp.id) || [];
                const empDayHours = empShifts.reduce((sum, s) => sum + shiftEffectiveHours(s), 0);

                // Student availability
                const isStudent = emp.category === 'etudiant';
                const hasAvailability = availabilityMap.has(emp.id);
                const isAvailable = availabilityMap.get(emp.id) ?? true;

                let rowBgClass = '';
                if (isStudent && hasAvailability) {
                  rowBgClass = isAvailable ? 'gd-row--available' : 'gd-row--unavailable';
                }

                return (
                  <div key={emp.id}>
                    {/* Employee row — NO category separator headers */}
                    <div
                      className={`gd-row ${rowBgClass} ${index % 2 === 0 ? 'gd-row--even' : ''}`}
                      onClick={(e) => handleRowClick(e, emp.id)}
                    >
                      {/* Name sidebar with color badge (no category title) */}
                      <div className="gd-row-name">
                        <div
                          className="gd-role-badge"
                          style={{ backgroundColor: ROLE_COLORS[emp.category] }}
                        />
                        <div className="gd-name-info">
                          <span className="gd-name-text">
                            {emp.first_name} {emp.last_name.charAt(0)}.
                          </span>
                          {empDayHours > 0 && (
                            <span className="gd-name-hours">{formatHours(empDayHours)}</span>
                          )}
                          {isStudent && hasAvailability && empShifts.length === 0 && (
                            <span className={`gd-dispo-text ${isAvailable ? 'gd-dispo-text--yes' : 'gd-dispo-text--no'}`}>
                              {isAvailable ? 'Disponible' : 'Non dispo'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timeline area */}
                      <div className="gd-row-timeline" style={{ minWidth: `${timelineWidth}px` }}>
                        {/* Closed zones (blue bands) */}
                        {!isSunday && (
                          <>
                            <div
                              className="gd-closed-zone gd-closed-zone--row"
                              style={{ left: '0%', width: `${closedBeforePercent}%` }}
                            />
                            <div
                              className="gd-closed-zone gd-closed-zone--row"
                              style={{ left: `${closedAfterPercent}%`, width: `${100 - closedAfterPercent}%` }}
                            />
                          </>
                        )}

                        {/* Closure zone (yellow) */}
                        {closureZone && (
                          <div
                            className="gd-closure gd-closure--row"
                            style={{ left: `${closureZone.left}%`, width: `${closureZone.width}%` }}
                          >
                            <span className="gd-closure-label">FERME</span>
                          </div>
                        )}

                        {/* Grid lines */}
                        {hourMarks.map(h => (
                          <div
                            key={h}
                            className="gd-gridline"
                            style={{ left: `${timeToPercent(`${String(h).padStart(2, '0')}:00`)}%` }}
                          />
                        ))}

                        {/* Now indicator */}
                        {nowPercent > 0 && (
                          <div className="gd-now-row" style={{ left: `${nowPercent}%` }} />
                        )}

                        {/* Student availability background text */}
                        {isStudent && hasAvailability && empShifts.length === 0 && (
                          <div className={`gd-avail-bg ${isAvailable ? 'gd-avail-bg--yes' : 'gd-avail-bg--no'}`}>
                            {isAvailable ? 'Disponible toute la journee' : 'Non disponible'}
                          </div>
                        )}

                        {/* Shift bars */}
                        {empShifts.map(shift => {
                          const left = timeToPercent(shift.start_time);
                          const right = timeToPercent(shift.end_time);
                          const width = right - left;
                          const isHovered = hoveredShiftId === shift.id;
                          const duration = shiftDurationHours(shift);
                          const showPauseBadge = shift.break_duration > 0 && (isSaturday || duration >= 6);

                          return (
                            <div
                              key={shift.id}
                              className={`gd-bar ${isHovered ? 'gd-bar--hover' : ''}`}
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(width, 1.5)}%`,
                                backgroundColor: ROLE_COLORS[emp.category],
                              }}
                              onClick={(e) => handleBarClick(e, emp.id, shift)}
                              onMouseEnter={(e) => handleBarMouseEnter(e, shift, emp)}
                              onMouseLeave={handleBarMouseLeave}
                            >
                              <span className="gd-bar-time">
                                {shift.start_time}-{shift.end_time}
                              </span>
                              {showPauseBadge && (
                                <span className="gd-bar-pause">
                                  P {shift.break_duration}min
                                </span>
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
        </div>

        {/* Legend footer */}
        <div className="gd-legend">
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="gd-legend-item">
              <span className="gd-legend-dot" style={{ backgroundColor: item.color }} />
              <span className="gd-legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipData && (
        <div
          className="gd-tooltip"
          style={{ left: tooltipData.x + 12, top: tooltipData.y - 10 }}
        >
          <div className="gd-tooltip-name">
            {tooltipData.emp.first_name} {tooltipData.emp.last_name}
          </div>
          <div className="gd-tooltip-time">
            {tooltipData.shift.start_time} - {tooltipData.shift.end_time}
          </div>
          <div className="gd-tooltip-hours">
            {formatHours(shiftEffectiveHours(tooltipData.shift))} effectives
            {tooltipData.shift.break_duration > 0 && ` | Pause ${tooltipData.shift.break_duration}min`}
          </div>
          {tooltipData.shift.notes && (
            <div className="gd-tooltip-notes">{tooltipData.shift.notes}</div>
          )}
          <div className="gd-tooltip-hint">Cliquer pour editer</div>
        </div>
      )}

      <style jsx>{`
        .gd-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border: 1px solid var(--color-neutral-200, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
        }

        /* Date title */
        .gd-date-title {
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--color-neutral-600, #4b5563);
          background: var(--color-neutral-50, #f9fafb);
          border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
        }

        /* Scroll wrapper */
        .gd-scroll-wrap {
          flex: 1;
          overflow-x: auto;
          overflow-y: auto;
        }

        /* Header */
        .gd-header {
          display: flex;
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--color-neutral-50, #f9fafb);
          border-bottom: 2px solid var(--color-neutral-200, #e5e7eb);
        }

        .gd-header-name {
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
          position: sticky;
          left: 0;
          z-index: 11;
          background: var(--color-neutral-50, #f9fafb);
        }

        .gd-header-timeline {
          flex: 1;
          position: relative;
          height: 36px;
        }

        /* Closed zones (blue diagonal bands) */
        .gd-closed-zone {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 1;
          pointer-events: none;
          background: repeating-linear-gradient(
            45deg,
            rgba(30, 58, 138, 0.08),
            rgba(30, 58, 138, 0.08) 4px,
            rgba(37, 99, 235, 0.04) 4px,
            rgba(37, 99, 235, 0.04) 8px
          );
        }

        .gd-closed-zone--row {
          background: repeating-linear-gradient(
            45deg,
            rgba(30, 58, 138, 0.06),
            rgba(30, 58, 138, 0.06) 4px,
            rgba(37, 99, 235, 0.02) 4px,
            rgba(37, 99, 235, 0.02) 8px
          );
        }

        /* Hour marks */
        .gd-hour-mark {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--color-neutral-200, #e5e7eb);
          z-index: 2;
        }

        .gd-hour-label {
          position: absolute;
          bottom: 4px;
          left: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-neutral-500, #6b7280);
          white-space: nowrap;
          user-select: none;
        }

        /* Closure zone (12h30-13h30) — YELLOW */
        .gd-closure {
          position: absolute;
          top: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 3;
        }

        .gd-closure--header {
          background: linear-gradient(
            180deg,
            rgba(250, 204, 21, 0.2) 0%,
            rgba(250, 204, 21, 0.3) 100%
          );
          border-left: 2px dashed #ca8a04;
          border-right: 2px dashed #ca8a04;
        }

        .gd-closure--row {
          background: linear-gradient(
            180deg,
            rgba(250, 204, 21, 0.15) 0%,
            rgba(250, 204, 21, 0.25) 100%
          );
          border-left: 2px dashed #ca8a04;
          border-right: 2px dashed #ca8a04;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gd-closure-label {
          font-size: 10px;
          font-weight: 800;
          color: #92400e;
          letter-spacing: 2px;
          writing-mode: vertical-lr;
          text-orientation: mixed;
          transform: rotate(180deg);
          user-select: none;
        }

        /* Now indicator */
        .gd-now {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #dc2626;
          z-index: 8;
        }

        .gd-now-dot {
          position: absolute;
          top: -3px;
          left: -4px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #dc2626;
        }

        .gd-now-row {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(220, 38, 38, 0.3);
          z-index: 6;
          pointer-events: none;
        }

        /* Body */
        .gd-body {
          min-width: fit-content;
        }

        .gd-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--color-neutral-400, #9ca3af);
          font-size: 14px;
          width: 100%;
        }

        /* Employee row */
        .gd-row {
          display: flex;
          height: ${ROW_HEIGHT}px;
          border-bottom: 1px solid var(--color-neutral-100, #f3f4f6);
          cursor: pointer;
          transition: background 0.1s;
        }

        .gd-row:hover {
          background: rgba(99, 102, 241, 0.03);
        }

        .gd-row--even {
          background: rgba(0, 0, 0, 0.01);
        }

        .gd-row--available {
          background: #d1fae5 !important;
        }

        .gd-row--available:hover {
          background: #a7f3d0 !important;
        }

        .gd-row--unavailable {
          background: #fee2e2 !important;
        }

        .gd-row--unavailable:hover {
          background: #fecaca !important;
        }

        /* Name sidebar */
        .gd-row-name {
          width: ${SIDEBAR_WIDTH}px;
          min-width: ${SIDEBAR_WIDTH}px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 16px;
          border-right: 1px solid var(--color-neutral-200, #e5e7eb);
          overflow: hidden;
          position: sticky;
          left: 0;
          z-index: 5;
          background: inherit;
        }

        .gd-role-badge {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .gd-name-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          gap: 1px;
        }

        .gd-name-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-neutral-800, #1f2937);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gd-name-hours {
          font-size: 10px;
          color: var(--color-neutral-400, #9ca3af);
          font-weight: 500;
        }

        .gd-dispo-text {
          font-size: 10px;
          font-weight: 600;
        }

        .gd-dispo-text--yes {
          color: #059669;
        }

        .gd-dispo-text--no {
          color: #dc2626;
        }

        /* Timeline */
        .gd-row-timeline {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .gd-gridline {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--color-neutral-100, #f3f4f6);
          pointer-events: none;
        }

        /* Availability background text */
        .gd-avail-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          pointer-events: none;
          z-index: 1;
        }

        .gd-avail-bg--yes {
          color: #059669;
        }

        .gd-avail-bg--no {
          color: #dc2626;
        }

        /* Shift bar */
        .gd-bar {
          position: absolute;
          top: ${(ROW_HEIGHT - BAR_HEIGHT) / 2}px;
          height: ${BAR_HEIGHT}px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          z-index: 4;
          transition: transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
          min-width: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .gd-bar:hover,
        .gd-bar--hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          z-index: 7;
        }

        .gd-bar-time {
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          padding: 0 8px;
          text-align: center;
          flex: 1;
        }

        .gd-bar-pause {
          background: rgba(255, 255, 255, 0.25);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
          margin-right: 4px;
        }

        /* Legend footer */
        .gd-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          padding: 12px 16px;
          border-top: 1px solid var(--color-neutral-200, #e5e7eb);
          background: var(--color-neutral-50, #f9fafb);
          flex-shrink: 0;
        }

        .gd-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gd-legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .gd-legend-label {
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
        }

        /* Tooltip */
        .gd-tooltip {
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

        .gd-tooltip-name {
          font-weight: 700;
          font-size: 13px;
        }

        .gd-tooltip-time {
          font-weight: 600;
          font-size: 13px;
          margin-top: 2px;
        }

        .gd-tooltip-hours {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 2px;
        }

        .gd-tooltip-notes {
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
          font-style: italic;
        }

        .gd-tooltip-hint {
          font-size: 9px;
          opacity: 0.5;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Print */
        @media print {
          .gd-container { border: none; }
          .gd-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .gd-closure { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .gd-closed-zone { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .gd-row--available,
          .gd-row--unavailable { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .gd-legend { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .gd-header-name,
          .gd-row-name {
            width: 120px;
            min-width: 120px;
          }
          .gd-role-badge { width: 10px; height: 10px; }
          .gd-name-text { font-size: 11px; }
          .gd-legend { gap: 12px; }
          .gd-legend-label { font-size: 10px; }
        }
      `}</style>
    </>
  );
}
