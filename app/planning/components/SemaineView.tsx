'use client';

import { useMemo, useState, useCallback } from 'react';
import type { Employee, Shift, Conflict, EmployeeCategory, Disponibilite } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import { getDayShortFr, parseISODate } from '@/lib/utils/dateUtils';
import {
  TIMELINE_START,
  TIMELINE_END,
  TIMELINE_SPAN,
  TIMELINE_TICKS_COMPACT,
  PLANNING_ZONES,
  COLORS,
  CATEGORY_ORDER,
  CATEGORY_CONFIG,
  Z_LAYERS,
  getSlotPosition,
  getZonePosition,
  formatTime,
  getInitials,
  getSlotColor,
} from '@/lib/planning-config';
import {
  getDispoIndicator,
  enrichDisposWithUsage,
  findUnusedDispos,
} from '@/lib/disponibilites-service';
import { calculateDayStats } from '@/lib/week-analytics';
import type { DayStats } from '@/lib/week-analytics';
import ConflictBadge from './ConflictBadge';

interface SemaineViewProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  disponibilites: Disponibilite[];
  weekDates: string[];
  todayStr: string;
  filter: 'all' | EmployeeCategory;
  hideEmpty: boolean;
  showDispos: boolean;
  showZones: boolean;
  showEmployeeColumn: boolean;
  collapsedCats: Set<EmployeeCategory>;
  onToggleCategory: (cat: EmployeeCategory) => void;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
  onDayClick: (dayIndex: number) => void;
}

export default function SemaineView({
  employees,
  shifts,
  conflicts,
  disponibilites,
  weekDates,
  todayStr,
  filter,
  hideEmpty,
  showDispos,
  showZones,
  showEmployeeColumn,
  collapsedCats,
  onToggleCategory,
  onCellClick,
  onShiftDrop,
  onDayClick,
}: SemaineViewProps) {
  // Jours ouvrables uniquement (Lun-Sam = index 0-5)
  const workDays = useMemo(() => weekDates.slice(0, 6), [weekDates]);

  // Employés actifs groupés par catégorie
  const employeesByCategory = useMemo(() => {
    const groups = new Map<EmployeeCategory, Employee[]>();
    for (const cat of CATEGORY_ORDER) {
      if (filter !== 'all' && filter !== cat) continue;
      const catEmps = employees
        .filter(e => e.category === cat && e.is_active)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));
      if (catEmps.length > 0) {
        groups.set(cat, catEmps);
      }
    }
    return groups;
  }, [employees, filter]);

  // Index shifts par employeeId|date
  const shiftIndex = useMemo(() => {
    const idx = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.employee_id}|${s.date}`;
      const arr = idx.get(key) || [];
      arr.push(s);
      idx.set(key, arr);
    }
    return idx;
  }, [shifts]);

  // Shifts par employé (pour weekly total)
  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const arr = map.get(s.employee_id) || [];
      arr.push(s);
      map.set(s.employee_id, arr);
    }
    return map;
  }, [shifts]);

  // Conflits par employé|date
  const conflictIndex = useMemo(() => {
    const idx = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      for (const empId of c.employee_ids) {
        const key = `${empId}|${c.date}`;
        const arr = idx.get(key) || [];
        arr.push(c);
        idx.set(key, arr);
      }
    }
    return idx;
  }, [conflicts]);

  // Vérifier si un employé a au moins un shift dans les jours visibles
  const employeeHasShifts = useCallback((empId: string): boolean => {
    return workDays.some(date => {
      const key = `${empId}|${date}`;
      return (shiftIndex.get(key) || []).length > 0;
    });
  }, [workDays, shiftIndex]);

  // Day stats for header
  const dayStatsMap = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const date of workDays) {
      map.set(date, calculateDayStats(date, shifts));
    }
    return map;
  }, [workDays, shifts]);

  // Grid columns
  const empColWidth = showEmployeeColumn ? '190px' : '0px';
  const headerGridCols = showEmployeeColumn
    ? '190px repeat(6, 1fr) 90px'
    : 'repeat(6, 1fr) 90px';
  const rowGridCols = headerGridCols;

  return (
    <>
      <div className="sv-container">
        <div className="sv-scroll">
          <div className="sv-grid">
            {/* ═══ Header ═══ */}
            <div className="sv-header" style={{ gridTemplateColumns: headerGridCols }}>
              {showEmployeeColumn && <div className="sv-header-emp">EMPLOYÉ</div>}
              {workDays.map((dateStr, dayIdx) => {
                const date = parseISODate(dateStr);
                const isToday = dateStr === todayStr;
                const stats = dayStatsMap.get(dateStr);
                return (
                  <div
                    key={dateStr}
                    className={`sv-header-day ${isToday ? 'sv-header-day--today' : ''} ${stats?.hasGaps ? 'sv-header-day--gaps' : ''} ${stats?.hasConflicts ? 'sv-header-day--conflicts' : ''}`}
                    onClick={() => onDayClick(dayIdx)}
                    title={`${getDayShortFr(date)} ${date.getDate()} — ${stats?.uniqueWorkers ?? 0} employés, ${stats?.totalHours ?? 0}h, couverture ${stats?.coverage ?? 0}%`}
                  >
                    <div className="sv-day-name">{getDayShortFr(date)}</div>
                    <div className="sv-day-num">{date.getDate()}</div>
                    <div className="sv-timeline-marks">
                      {TIMELINE_TICKS_COMPACT.map(h => (
                        <span key={h} className="sv-hour-mark">{h}h</span>
                      ))}
                    </div>
                    {/* Day stats */}
                    {stats && (
                      <div className="sv-day-stats">
                        <span className="sv-day-stat-workers">{stats.uniqueWorkers} pers.</span>
                        <span className={`sv-day-stat-coverage ${stats.coverage < 80 ? 'sv-day-stat-coverage--low' : ''}`}>
                          {stats.coverage}%
                        </span>
                      </div>
                    )}
                    {/* Gap / Conflict indicators */}
                    {stats?.hasGaps && (
                      <div className="sv-day-indicator sv-day-indicator--gap">⚠️ Lacune</div>
                    )}
                    {stats?.hasConflicts && (
                      <div className="sv-day-indicator sv-day-indicator--conflict">⚠️ Conflit</div>
                    )}
                  </div>
                );
              })}
              <div className="sv-header-total">TOTAL</div>
            </div>

            {/* ═══ Body ═══ */}
            <div className="sv-body">
              {Array.from(employeesByCategory.entries()).map(([category, catEmps]) => {
                const config = CATEGORY_CONFIG[category];
                const isCollapsed = collapsedCats.has(category);

                const visibleEmps = hideEmpty
                  ? catEmps.filter(e => employeeHasShifts(e.id))
                  : catEmps;

                if (hideEmpty && visibleEmps.length === 0) return null;

                return (
                  <div key={category} className="sv-cat-section">
                    {/* Category header */}
                    <div
                      className="sv-cat-header"
                      onClick={() => onToggleCategory(category)}
                    >
                      <div className="sv-cat-title">
                        <span className="sv-cat-chevron">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                        <span className="sv-cat-dot" style={{ backgroundColor: config.color }} />
                        <span className="sv-cat-icon">{config.icon}</span>
                        <span className="sv-cat-name">{config.label}</span>
                        <span className="sv-cat-count">
                          {hideEmpty ? `${visibleEmps.length}/${catEmps.length}` : catEmps.length}
                        </span>
                      </div>
                    </div>

                    {/* Employee rows */}
                    {!isCollapsed && visibleEmps.map(emp => (
                      <SemaineViewRow
                        key={emp.id}
                        employee={emp}
                        workDays={workDays}
                        shiftIndex={shiftIndex}
                        conflictIndex={conflictIndex}
                        weeklyShifts={shiftsByEmployee.get(emp.id) || []}
                        disponibilites={disponibilites}
                        todayStr={todayStr}
                        showDispos={showDispos}
                        showZones={showZones}
                        showEmployeeColumn={showEmployeeColumn}
                        gridCols={rowGridCols}
                        onCellClick={onCellClick}
                        onShiftDrop={onShiftDrop}
                        onDayClick={onDayClick}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════ */
        /* SemaineView V2 — BaggPlanning-style week grid  */
        /* ═══════════════════════════════════════════════ */

        .sv-container {
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: white;
        }

        .sv-scroll {
          overflow: auto;
          max-height: calc(100vh - 260px);
        }

        .sv-grid {
          min-width: 1000px;
        }

        /* ─── Header ─── */
        .sv-header {
          display: grid;
          position: sticky;
          top: 0;
          z-index: ${Z_LAYERS.stickyHeader};
          border-bottom: 2px solid var(--color-neutral-300);
          background: var(--color-neutral-50);
        }

        .sv-header-emp {
          padding: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-neutral-500);
          border-right: 1px solid var(--color-neutral-200);
          display: flex;
          align-items: flex-end;
        }

        .sv-header-day {
          padding: 6px 8px;
          text-align: center;
          border-right: 1px solid var(--color-neutral-200);
          cursor: pointer;
          transition: background 0.1s;
        }

        .sv-header-day:hover { background: var(--color-neutral-100); transform: translateY(-1px); }
        .sv-header-day--today { background: var(--color-primary-50); }
        .sv-header-day--today:hover { background: var(--color-primary-100); }

        .sv-header-day--gaps:not(.sv-header-day--today) {
          background: rgba(245, 158, 11, 0.06);
        }

        .sv-header-day--conflicts:not(.sv-header-day--today) {
          background: rgba(239, 68, 68, 0.04);
        }

        .sv-day-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-800);
          text-transform: capitalize;
        }

        .sv-day-num {
          font-size: 11px;
          color: var(--color-neutral-500);
          margin-top: 1px;
        }

        .sv-header-day--today .sv-day-num {
          color: var(--color-primary-600);
          font-weight: 700;
        }

        .sv-timeline-marks {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          padding: 0 2px;
        }

        .sv-hour-mark {
          font-size: 9px;
          color: var(--color-neutral-400);
          font-weight: 500;
        }

        /* Day stats in header */
        .sv-day-stats {
          display: flex;
          gap: 6px;
          justify-content: center;
          margin-top: 3px;
          font-size: 10px;
        }

        .sv-day-stat-workers {
          color: var(--color-neutral-500);
          font-weight: 600;
        }

        .sv-day-stat-coverage {
          font-weight: 700;
          color: #10b981;
        }

        .sv-day-stat-coverage--low {
          color: #f59e0b;
        }

        /* Day gap/conflict indicators */
        .sv-day-indicator {
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 3px;
          margin-top: 3px;
          text-align: center;
        }

        .sv-day-indicator--gap {
          background: rgba(245, 158, 11, 0.12);
          color: #92400e;
        }

        .sv-day-indicator--conflict {
          background: rgba(239, 68, 68, 0.1);
          color: #991b1b;
        }

        .sv-header-total {
          padding: 12px 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-neutral-500);
          text-align: center;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          border-left: 1px solid var(--color-neutral-200);
        }

        /* ─── Category header ─── */
        .sv-cat-section {
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .sv-cat-header {
          display: grid;
          grid-template-columns: 1fr;
          background: var(--color-neutral-100);
          cursor: pointer;
          border-bottom: 1px solid var(--color-neutral-200);
          transition: background 0.1s;
        }

        .sv-cat-header:hover { background: var(--color-neutral-200); }

        .sv-cat-title {
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sv-cat-chevron {
          font-size: 9px;
          color: var(--color-neutral-500);
          width: 12px;
          text-align: center;
          flex-shrink: 0;
        }

        .sv-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .sv-cat-icon { font-size: 13px; }

        .sv-cat-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .sv-cat-count {
          font-size: 10px;
          color: var(--color-neutral-400);
          font-weight: 500;
          margin-left: auto;
          padding: 1px 8px;
          background: white;
          border: 1px solid var(--color-neutral-300);
          border-radius: 10px;
        }

        /* ─── Employee row ─── */
        .sv-emp-row {
          display: grid;
          min-height: 52px;
          border-bottom: 1px solid var(--color-neutral-100);
          transition: background 0.1s;
        }

        .sv-emp-row:hover { background: var(--color-neutral-50); }
        .sv-emp-row--conflict { background: var(--color-danger-50); }
        .sv-emp-row--conflict:hover { background: var(--color-danger-100); }
        .sv-emp-row--no-dispo { opacity: 0.5; }

        /* Employee info cell */
        .sv-emp-cell {
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-right: 1px solid var(--color-neutral-200);
        }

        .sv-emp-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 11px;
          flex-shrink: 0;
          letter-spacing: 0.02em;
          position: relative;
        }

        .sv-dispo-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
        }

        .sv-dispo-badge--full { background: #22c55e; }
        .sv-dispo-badge--partial { background: #f59e0b; }
        .sv-dispo-badge--preferred { background: #3b82f6; }
        .sv-dispo-badge--unavailable { background: #ef4444; }
        .sv-dispo-badge--none { background: #94a3b8; }

        .sv-emp-info {
          min-width: 0;
          flex: 1;
        }

        .sv-emp-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .sv-emp-meta {
          font-size: 10px;
          color: var(--color-neutral-400);
        }

        /* ─── Day cell (timeline) ─── */
        .sv-day-cell {
          position: relative;
          border-right: 1px solid var(--color-neutral-100);
          min-height: 52px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .sv-day-cell:hover { background: var(--color-primary-50); }
        .sv-day-cell--today { background: rgba(59, 130, 246, 0.03); }
        .sv-day-cell--dragover {
          background: var(--color-secondary-50);
          outline: 2px dashed var(--color-secondary-400);
          outline-offset: -2px;
        }

        /* Zone bg in day cell */
        .sv-zone-bg {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: ${Z_LAYERS.zones};
          pointer-events: none;
        }

        /* Dispo layer in day cell */
        .sv-dispo-bar {
          position: absolute;
          top: 3px;
          bottom: 3px;
          border-radius: 3px;
          z-index: ${Z_LAYERS.disponibilites};
          pointer-events: none;
        }

        .sv-dispo-bar--available {
          background: ${COLORS.dispoAvailable};
          border: 1px solid ${COLORS.dispoBorder};
        }

        .sv-dispo-bar--preferred {
          background: ${COLORS.dispoPreferred};
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        /* Grid lines */
        .sv-grid-lines {
          position: absolute;
          inset: 0;
          display: flex;
          pointer-events: none;
          z-index: ${Z_LAYERS.gridlines};
        }

        .sv-grid-line {
          flex: 1;
          border-right: 1px solid var(--color-neutral-50);
        }

        .sv-grid-line:nth-child(even) {
          border-right-color: var(--color-neutral-100);
        }

        /* ─── Shift bars ─── */
        .sv-slot {
          position: absolute;
          top: 5px;
          bottom: 5px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          color: white;
          cursor: grab;
          z-index: ${Z_LAYERS.work};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          transition: transform 0.1s, box-shadow 0.1s;
          overflow: hidden;
          padding: 0 4px;
        }

        .sv-slot:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
          z-index: ${Z_LAYERS.work + 1};
        }

        .sv-slot:active { cursor: grabbing; }

        .sv-slot-time {
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          letter-spacing: -0.02em;
        }

        .sv-slot--leave {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 10px;
          cursor: default;
          background: repeating-linear-gradient(
            45deg, #fee2e2, #fee2e2 4px, #fecaca 4px, #fecaca 8px
          ) !important;
          color: #991b1b;
          border: 1px dashed #ef4444;
          font-weight: 600;
          z-index: ${Z_LAYERS.conges};
        }

        .sv-slot--special {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 10px;
          cursor: default;
          z-index: ${Z_LAYERS.conges};
          font-weight: 600;
        }

        /* Unused dispo indicator */
        .sv-dispo-unused {
          position: absolute;
          top: 3px;
          right: 3px;
          font-size: 11px;
          z-index: ${Z_LAYERS.cta};
          opacity: 0.7;
          pointer-events: none;
        }

        /* Conflict indicator on slot */
        .sv-cell-conflicts {
          position: absolute;
          top: 1px;
          right: 2px;
          display: flex;
          gap: 1px;
          z-index: ${Z_LAYERS.conflicts};
        }

        /* ─── Total cell ─── */
        .sv-total-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px 8px;
          border-left: 1px solid var(--color-neutral-200);
          gap: 0;
        }

        .sv-total-hours {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .sv-total-diff {
          font-size: 10px;
          font-weight: 500;
        }

        .sv-total-diff--over { color: var(--color-warning-600); }
        .sv-total-diff--under { color: var(--color-secondary-600); }
        .sv-total-diff--ok { color: var(--color-neutral-400); }

        .sv-total-contract {
          font-size: 9px;
          color: var(--color-neutral-400);
        }

        /* ─── Responsive ─── */
        @media (max-width: 1280px) {
          .sv-emp-avatar {
            width: 28px;
            height: 28px;
            font-size: 10px;
          }
          .sv-slot-time { font-size: 8px; }
        }

        /* ─── Print ─── */
        @media print {
          .sv-container { border: none; border-radius: 0; }
          .sv-scroll { max-height: none; overflow: visible; }
          .sv-cat-header:hover { background: var(--color-neutral-100); }
          .sv-emp-row:hover, .sv-day-cell:hover { background: transparent; }
          .sv-slot:hover { transform: none; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// SemaineViewRow — Single employee row
// ═══════════════════════════════════════════════════════

function SemaineViewRow({
  employee,
  workDays,
  shiftIndex,
  conflictIndex,
  weeklyShifts,
  disponibilites,
  todayStr,
  showDispos,
  showZones,
  showEmployeeColumn,
  gridCols,
  onCellClick,
  onShiftDrop,
  onDayClick,
}: {
  employee: Employee;
  workDays: string[];
  shiftIndex: Map<string, Shift[]>;
  conflictIndex: Map<string, Conflict[]>;
  weeklyShifts: Shift[];
  disponibilites: Disponibilite[];
  todayStr: string;
  showDispos: boolean;
  showZones: boolean;
  showEmployeeColumn: boolean;
  gridCols: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
  onDayClick: (dayIndex: number) => void;
}) {
  const weeklyTotal = weeklyShifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const hoursDiff = weeklyTotal - employee.contract_hours;
  const hasRowConflict = weeklyShifts.some(s => {
    const key = `${employee.id}|${s.date}`;
    return (conflictIndex.get(key) || []).some(c => c.severity === 'error');
  });

  const initials = getInitials(employee.first_name, employee.last_name);
  const avatarColor = getSlotColor(employee.category);

  // Overall dispo indicator for the week (based on first work day with dispo)
  const weeklyDispoIndicator = useMemo(() => {
    if (!showDispos) return null;
    // Combine all days: if any day has dispo → show the "best" indicator
    let best: ReturnType<typeof getDispoIndicator> = 'none';
    for (const date of workDays) {
      const ind = getDispoIndicator(disponibilites, employee.id, date);
      if (ind === 'full' || ind === 'preferred') { best = ind; break; }
      if (ind === 'partial' && best === 'none') best = 'partial';
      if (ind === 'unavailable' && best === 'none') best = 'unavailable';
    }
    return best;
  }, [showDispos, disponibilites, employee.id, workDays]);

  const isNoDispo = showDispos && weeklyDispoIndicator === 'none';

  return (
    <div
      className={`sv-emp-row ${hasRowConflict ? 'sv-emp-row--conflict' : ''} ${isNoDispo ? 'sv-emp-row--no-dispo' : ''}`}
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Employee info */}
      {showEmployeeColumn && (
        <div className="sv-emp-cell">
          <div className="sv-emp-avatar" style={{ backgroundColor: avatarColor }}>
            {initials}
            {showDispos && weeklyDispoIndicator && (
              <span className={`sv-dispo-badge sv-dispo-badge--${weeklyDispoIndicator}`} />
            )}
          </div>
          <div className="sv-emp-info">
            <span className="sv-emp-name">{employee.first_name} {employee.last_name}</span>
            <span className="sv-emp-meta">{employee.contract_hours}h/sem</span>
          </div>
        </div>
      )}

      {/* Day cells */}
      {workDays.map((date, dayIdx) => (
        <SemaineViewDayCell
          key={date}
          employee={employee}
          date={date}
          dayIndex={dayIdx}
          shifts={shiftIndex.get(`${employee.id}|${date}`) || []}
          conflicts={conflictIndex.get(`${employee.id}|${date}`) || []}
          disponibilites={disponibilites}
          isToday={date === todayStr}
          showDispos={showDispos}
          showZones={showZones}
          onCellClick={onCellClick}
          onShiftDrop={onShiftDrop}
          onDayClick={onDayClick}
        />
      ))}

      {/* Total */}
      <div className="sv-total-cell">
        <span className="sv-total-hours">{formatHours(weeklyTotal)}</span>
        <span className={`sv-total-diff ${hoursDiff > 0 ? 'sv-total-diff--over' : hoursDiff < 0 ? 'sv-total-diff--under' : 'sv-total-diff--ok'}`}>
          {hoursDiff > 0 ? '+' : ''}{formatHours(hoursDiff)}
        </span>
        <span className="sv-total-contract">{employee.contract_hours}h</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SemaineViewDayCell — Single day cell with timeline bars
// ═══════════════════════════════════════════════════════

function SemaineViewDayCell({
  employee,
  date,
  dayIndex,
  shifts: dayShifts,
  conflicts: dayConflicts,
  disponibilites,
  isToday,
  showDispos,
  showZones,
  onCellClick,
  onShiftDrop,
  onDayClick,
}: {
  employee: Employee;
  date: string;
  dayIndex: number;
  shifts: Shift[];
  conflicts: Conflict[];
  disponibilites: Disponibilite[];
  isToday: boolean;
  showDispos: boolean;
  showZones: boolean;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
  onDayClick: (dayIndex: number) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const slotColor = getSlotColor(employee.category);

  // Separate shift types
  const workShifts = dayShifts.filter(s =>
    s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
  );
  const leaveShift = dayShifts.find(s =>
    s.type === 'conge' || s.type === 'maladie' || s.type === 'rtt'
  );
  const gardeShift = dayShifts.find(s => s.type === 'garde' || s.type === 'astreinte');
  const formationShift = dayShifts.find(s => s.type === 'formation');

  // Dispo items for this cell
  const dispoItems = useMemo(() => {
    if (!showDispos) return [];
    return enrichDisposWithUsage(disponibilites, dayShifts, employee.id, date);
  }, [showDispos, disponibilites, dayShifts, employee.id, date]);

  const handleClick = useCallback(() => {
    onCellClick(employee.id, date, dayShifts.length > 0 ? dayShifts[0] : null);
  }, [employee.id, date, dayShifts, onCellClick]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, shift: Shift) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      shiftId: shift.id,
      employeeId: shift.employee_id,
      fromDate: shift.date,
    }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!data.shiftId || !data.employeeId) return;
      if (data.employeeId !== employee.id) return;
      if (data.fromDate === date) return;
      onShiftDrop(data.shiftId, data.employeeId, date);
    } catch { /* invalid data */ }
  }, [employee.id, date, onShiftDrop]);

  return (
    <div
      className={`sv-day-cell ${isToday ? 'sv-day-cell--today' : ''} ${isDragOver ? 'sv-day-cell--dragover' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Zone backgrounds */}
      {showZones && PLANNING_ZONES.map(zone => {
        const pos = getZonePosition(zone);
        return (
          <div
            key={zone.id}
            className="sv-zone-bg"
            style={{
              left: `${pos.left}%`,
              width: `${pos.width}%`,
              background: zone.color,
              borderLeft: `1px dashed ${zone.borderColor}`,
              borderRight: `1px dashed ${zone.borderColor}`,
            }}
          />
        );
      })}

      {/* Dispo layer */}
      {showDispos && dispoItems.map(item => {
        const pos = getSlotPosition(item.start_time, item.end_time);
        return (
          <div
            key={item.id}
            className={`sv-dispo-bar sv-dispo-bar--${item.type === 'preferred' ? 'preferred' : 'available'}`}
            style={{
              left: `${pos.left}%`,
              width: `${pos.width}%`,
            }}
          />
        );
      })}

      {/* Grid lines */}
      <div className="sv-grid-lines">
        {Array.from({ length: TIMELINE_SPAN }).map((_, i) => (
          <div key={i} className="sv-grid-line" />
        ))}
      </div>

      {/* Leave */}
      {leaveShift && (
        <div className="sv-slot sv-slot--leave">
          {leaveShift.type === 'maladie' ? '🏥' : leaveShift.type === 'rtt' ? '🔵' : '🏖️'}
        </div>
      )}

      {/* Formation */}
      {formationShift && !leaveShift && (
        <div className="sv-slot sv-slot--special" style={{ background: COLORS.formation }}>
          📖
        </div>
      )}

      {/* Garde / Astreinte */}
      {gardeShift && !leaveShift && !formationShift && (
        <div
          className="sv-slot sv-slot--special"
          style={{ background: gardeShift.type === 'garde' ? COLORS.garde : COLORS.astreinte }}
        >
          {gardeShift.type === 'garde' ? '🔴' : '🟡'}
        </div>
      )}

      {/* Work shifts as timeline bars */}
      {!leaveShift && !formationShift && !gardeShift && workShifts.map(shift => {
        const pos = getSlotPosition(shift.start_time, shift.end_time);
        return (
          <div
            key={shift.id}
            className="sv-slot"
            style={{
              left: `${pos.left}%`,
              width: `${pos.width}%`,
              backgroundColor: slotColor,
            }}
            draggable
            onDragStart={e => handleDragStart(e, shift)}
            onClick={e => {
              e.stopPropagation();
              onCellClick(employee.id, date, shift);
            }}
            title={`${formatTime(shift.start_time)} - ${formatTime(shift.end_time)} (${formatHours(shift.effective_hours)})`}
          >
            {pos.width > 15 && (
              <span className="sv-slot-time">
                {formatTime(shift.start_time)}-{formatTime(shift.end_time)}
              </span>
            )}
          </div>
        );
      })}

      {/* Unused dispo indicator */}
      {showDispos && dispoItems.length > 0 && workShifts.length === 0 && !leaveShift && (
        <div className="sv-dispo-unused" title="Disponible mais non assigné">
          ⚠️
        </div>
      )}

      {/* Conflict badges */}
      {dayConflicts.length > 0 && (
        <div className="sv-cell-conflicts">
          {dayConflicts.map(c => (
            <ConflictBadge key={c.id} severity={c.severity} message={c.message} compact />
          ))}
        </div>
      )}
    </div>
  );
}
