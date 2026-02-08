'use client';

import { useMemo, useState, useCallback } from 'react';
import type { Employee, Shift, Conflict, EmployeeCategory } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import { getDayShortFr, parseISODate } from '@/lib/utils/dateUtils';
import ConflictBadge from './ConflictBadge';

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
const CATEGORY_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pharmacien_titulaire: { label: 'Pharmaciens Titulaires', color: '#2563eb', icon: '💊' },
  pharmacien_adjoint: { label: 'Pharmaciens Adjoints', color: '#3b82f6', icon: '💊' },
  preparateur: { label: 'Préparateurs', color: '#10b981', icon: '⚗️' },
  rayonniste: { label: 'Rayonnistes', color: '#f59e0b', icon: '📦' },
  apprenti: { label: 'Apprentis', color: '#8b5cf6', icon: '🎓' },
  etudiant: { label: 'Étudiants', color: '#ec4899', icon: '📚' },
};

/** Config timeline */
const HOUR_START = 8;
const HOUR_END = 20;
const HOURS_SPAN = HOUR_END - HOUR_START;
const TIMELINE_MARKS = [8, 10, 12, 14, 16, 18, 20];

interface WeekViewProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  weekDates: string[];
  todayStr: string;
  filter: 'all' | EmployeeCategory;
  hideEmpty: boolean;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
}

/** Obtient les initiales d'un employé (max 2 lettres) */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Convertit "HH:MM" en nombre décimal d'heures */
function timeToDecimal(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

/** Formate "HH:MM" → "8h30" ou "8h" */
function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  return min === 0 ? `${hour}h` : `${hour}h${m}`;
}

/** Calcule la position d'un shift dans la timeline */
function getSlotPosition(startTime: string, endTime: string): { left: number; width: number } {
  const startDec = timeToDecimal(startTime);
  const endDec = timeToDecimal(endTime);

  const left = ((Math.max(startDec, HOUR_START) - HOUR_START) / HOURS_SPAN) * 100;
  const right = ((Math.min(endDec, HOUR_END) - HOUR_START) / HOURS_SPAN) * 100;
  const width = Math.max(right - left, 2);

  return { left, width };
}

export default function WeekView({
  employees,
  shifts,
  conflicts,
  weekDates,
  todayStr,
  filter,
  hideEmpty,
  onCellClick,
  onShiftDrop,
}: WeekViewProps) {
  const [collapsedCats, setCollapsedCats] = useState<Set<EmployeeCategory>>(new Set());

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

  // Toggle collapse catégorie
  const toggleCategory = useCallback((cat: EmployeeCategory) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  return (
    <>
      <div className="wv-container">
        <div className="wv-scroll">
          <div className="wv-grid">
            {/* ═══ Header ═══ */}
            <div className="wv-header">
              <div className="wv-header-emp">EMPLOYÉ</div>
              {workDays.map(dateStr => {
                const date = parseISODate(dateStr);
                const isToday = dateStr === todayStr;
                return (
                  <div key={dateStr} className={`wv-header-day ${isToday ? 'wv-header-day--today' : ''}`}>
                    <div className="wv-day-name">{getDayShortFr(date)}</div>
                    <div className="wv-day-num">{date.getDate()}</div>
                    <div className="wv-timeline-marks">
                      {TIMELINE_MARKS.map(h => (
                        <span key={h} className="wv-hour-mark">{h}h</span>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="wv-header-total">TOTAL</div>
            </div>

            {/* ═══ Body ═══ */}
            <div className="wv-body">
              {Array.from(employeesByCategory.entries()).map(([category, catEmps]) => {
                const info = CATEGORY_INFO[category];
                const isCollapsed = collapsedCats.has(category);

                // Filter out employees with no shifts if hideEmpty
                const visibleEmps = hideEmpty
                  ? catEmps.filter(e => employeeHasShifts(e.id))
                  : catEmps;

                if (hideEmpty && visibleEmps.length === 0) return null;

                return (
                  <div key={category} className="wv-cat-section">
                    {/* Category header */}
                    <div
                      className="wv-cat-header"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="wv-cat-title">
                        <span className="wv-cat-chevron">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                        <span className="wv-cat-dot" style={{ backgroundColor: info.color }} />
                        <span className="wv-cat-icon">{info.icon}</span>
                        <span className="wv-cat-name">{info.label}</span>
                        <span className="wv-cat-count">
                          {hideEmpty ? `${visibleEmps.length}/${catEmps.length}` : catEmps.length}
                        </span>
                      </div>
                    </div>

                    {/* Employee rows */}
                    {!isCollapsed && visibleEmps.map(emp => (
                      <WeekViewRow
                        key={emp.id}
                        employee={emp}
                        workDays={workDays}
                        shiftIndex={shiftIndex}
                        conflictIndex={conflictIndex}
                        weeklyShifts={shiftsByEmployee.get(emp.id) || []}
                        todayStr={todayStr}
                        onCellClick={onCellClick}
                        onShiftDrop={onShiftDrop}
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
        /* WeekView — BaggPlanning-style dense grid       */
        /* ═══════════════════════════════════════════════ */

        .wv-container {
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: white;
        }

        .wv-scroll {
          overflow: auto;
          max-height: calc(100vh - 260px);
        }

        .wv-grid {
          min-width: 1200px;
        }

        /* ─── Header ─── */
        .wv-header {
          display: grid;
          grid-template-columns: 190px repeat(6, 1fr) 90px;
          position: sticky;
          top: 0;
          z-index: 10;
          border-bottom: 2px solid var(--color-neutral-300);
          background: var(--color-neutral-50);
        }

        .wv-header-emp {
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

        .wv-header-day {
          padding: 6px 8px;
          text-align: center;
          border-right: 1px solid var(--color-neutral-200);
        }

        .wv-header-day--today {
          background: var(--color-primary-50);
        }

        .wv-day-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-800);
          text-transform: capitalize;
        }

        .wv-day-num {
          font-size: 11px;
          color: var(--color-neutral-500);
          margin-top: 1px;
        }

        .wv-header-day--today .wv-day-num {
          color: var(--color-primary-600);
          font-weight: 700;
        }

        .wv-timeline-marks {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          padding: 0 2px;
        }

        .wv-hour-mark {
          font-size: 9px;
          color: var(--color-neutral-400);
          font-weight: 500;
        }

        .wv-header-total {
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
        .wv-cat-section {
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .wv-cat-header {
          display: grid;
          grid-template-columns: 1fr;
          background: var(--color-neutral-100);
          cursor: pointer;
          border-bottom: 1px solid var(--color-neutral-200);
          transition: background 0.1s;
        }

        .wv-cat-header:hover {
          background: var(--color-neutral-200);
        }

        .wv-cat-title {
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wv-cat-chevron {
          font-size: 9px;
          color: var(--color-neutral-500);
          width: 12px;
          text-align: center;
          flex-shrink: 0;
        }

        .wv-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .wv-cat-icon {
          font-size: 13px;
        }

        .wv-cat-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .wv-cat-count {
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
        .wv-emp-row {
          display: grid;
          grid-template-columns: 190px repeat(6, 1fr) 90px;
          min-height: 52px;
          border-bottom: 1px solid var(--color-neutral-100);
          transition: background 0.1s;
        }

        .wv-emp-row:hover {
          background: var(--color-neutral-50);
        }

        .wv-emp-row--conflict {
          background: var(--color-danger-50);
        }

        .wv-emp-row--conflict:hover {
          background: var(--color-danger-100);
        }

        /* Employee info cell */
        .wv-emp-cell {
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-right: 1px solid var(--color-neutral-200);
        }

        .wv-emp-avatar {
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
        }

        .wv-emp-info {
          min-width: 0;
          flex: 1;
        }

        .wv-emp-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .wv-emp-meta {
          font-size: 10px;
          color: var(--color-neutral-400);
        }

        /* ─── Day cell (timeline) ─── */
        .wv-day-cell {
          position: relative;
          border-right: 1px solid var(--color-neutral-100);
          min-height: 52px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .wv-day-cell:hover {
          background: var(--color-primary-50);
        }

        .wv-day-cell--today {
          background: rgba(59, 130, 246, 0.03);
        }

        .wv-day-cell--dragover {
          background: var(--color-secondary-50);
          outline: 2px dashed var(--color-secondary-400);
          outline-offset: -2px;
        }

        /* Grid lines */
        .wv-grid-lines {
          position: absolute;
          inset: 0;
          display: flex;
          pointer-events: none;
        }

        .wv-grid-line {
          flex: 1;
          border-right: 1px solid var(--color-neutral-50);
        }

        .wv-grid-line:nth-child(even) {
          border-right-color: var(--color-neutral-100);
        }

        /* ─── Shift bars ─── */
        .wv-slot {
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
          z-index: 2;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          transition: transform 0.1s, box-shadow 0.1s;
          overflow: hidden;
          padding: 0 4px;
        }

        .wv-slot:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
          z-index: 3;
        }

        .wv-slot:active {
          cursor: grabbing;
        }

        .wv-slot-time {
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          letter-spacing: -0.02em;
        }

        .wv-slot--pause {
          z-index: 4;
          font-size: 12px;
          cursor: default;
        }

        .wv-slot--leave {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 10px;
          cursor: default;
          background: repeating-linear-gradient(
            45deg,
            #fee2e2,
            #fee2e2 4px,
            #fecaca 4px,
            #fecaca 8px
          ) !important;
          color: #991b1b;
          border: 1px dashed #ef4444;
          font-weight: 600;
          z-index: 5;
        }

        .wv-slot--special {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 10px;
          cursor: default;
          z-index: 5;
          font-weight: 600;
        }

        /* Conflict indicator on slot */
        .wv-cell-conflicts {
          position: absolute;
          top: 1px;
          right: 2px;
          display: flex;
          gap: 1px;
          z-index: 6;
        }

        /* ─── Total cell ─── */
        .wv-total-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px 8px;
          border-left: 1px solid var(--color-neutral-200);
          gap: 0;
        }

        .wv-total-hours {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .wv-total-diff {
          font-size: 10px;
          font-weight: 500;
        }

        .wv-total-diff--over {
          color: var(--color-warning-600);
        }

        .wv-total-diff--under {
          color: var(--color-secondary-600);
        }

        .wv-total-diff--ok {
          color: var(--color-neutral-400);
        }

        .wv-total-contract {
          font-size: 9px;
          color: var(--color-neutral-400);
        }

        /* ─── Responsive ─── */
        @media (max-width: 1280px) {
          .wv-grid {
            min-width: 1000px;
          }

          .wv-header,
          .wv-emp-row {
            grid-template-columns: 160px repeat(6, 1fr) 80px;
          }

          .wv-emp-avatar {
            width: 28px;
            height: 28px;
            font-size: 10px;
          }

          .wv-slot-time {
            font-size: 8px;
          }
        }

        /* ─── Print ─── */
        @media print {
          .wv-container {
            border: none;
            border-radius: 0;
          }

          .wv-scroll {
            max-height: none;
            overflow: visible;
          }

          .wv-cat-header:hover {
            background: var(--color-neutral-100);
          }

          .wv-emp-row:hover,
          .wv-day-cell:hover {
            background: transparent;
          }

          .wv-slot:hover {
            transform: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// WeekViewRow — Single employee row
// ═══════════════════════════════════════════════════════

function WeekViewRow({
  employee,
  workDays,
  shiftIndex,
  conflictIndex,
  weeklyShifts,
  todayStr,
  onCellClick,
  onShiftDrop,
}: {
  employee: Employee;
  workDays: string[];
  shiftIndex: Map<string, Shift[]>;
  conflictIndex: Map<string, Conflict[]>;
  weeklyShifts: Shift[];
  todayStr: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
}) {
  const weeklyTotal = weeklyShifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const hoursDiff = weeklyTotal - employee.contract_hours;
  const hasRowConflict = weeklyShifts.some(s => {
    const key = `${employee.id}|${s.date}`;
    return (conflictIndex.get(key) || []).some(c => c.severity === 'error');
  });

  const initials = getInitials(employee.first_name, employee.last_name);

  return (
    <div className={`wv-emp-row ${hasRowConflict ? 'wv-emp-row--conflict' : ''}`}>
      {/* Employee info */}
      <div className="wv-emp-cell">
        <div className="wv-emp-avatar" style={{ backgroundColor: employee.display_color }}>
          {initials}
        </div>
        <div className="wv-emp-info">
          <span className="wv-emp-name">{employee.first_name} {employee.last_name}</span>
          <span className="wv-emp-meta">{employee.contract_hours}h/sem</span>
        </div>
      </div>

      {/* Day cells */}
      {workDays.map(date => (
        <WeekViewDayCell
          key={date}
          employee={employee}
          date={date}
          shifts={shiftIndex.get(`${employee.id}|${date}`) || []}
          conflicts={conflictIndex.get(`${employee.id}|${date}`) || []}
          isToday={date === todayStr}
          onCellClick={onCellClick}
          onShiftDrop={onShiftDrop}
        />
      ))}

      {/* Total */}
      <div className="wv-total-cell">
        <span className="wv-total-hours">{formatHours(weeklyTotal)}</span>
        <span className={`wv-total-diff ${hoursDiff > 0 ? 'wv-total-diff--over' : hoursDiff < 0 ? 'wv-total-diff--under' : 'wv-total-diff--ok'}`}>
          {hoursDiff > 0 ? '+' : ''}{formatHours(hoursDiff)}
        </span>
        <span className="wv-total-contract">{employee.contract_hours}h</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WeekViewDayCell — Single day cell with timeline bars
// ═══════════════════════════════════════════════════════

function WeekViewDayCell({
  employee,
  date,
  shifts: dayShifts,
  conflicts: dayConflicts,
  isToday,
  onCellClick,
  onShiftDrop,
}: {
  employee: Employee;
  date: string;
  shifts: Shift[];
  conflicts: Conflict[];
  isToday: boolean;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  // Separate shift types
  const workShifts = dayShifts.filter(s =>
    s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
  );
  const leaveShift = dayShifts.find(s =>
    s.type === 'conge' || s.type === 'maladie' || s.type === 'rtt'
  );
  const gardeShift = dayShifts.find(s => s.type === 'garde' || s.type === 'astreinte');
  const formationShift = dayShifts.find(s => s.type === 'formation');

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
      className={`wv-day-cell ${isToday ? 'wv-day-cell--today' : ''} ${isDragOver ? 'wv-day-cell--dragover' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Grid lines */}
      <div className="wv-grid-lines">
        {Array.from({ length: HOURS_SPAN }).map((_, i) => (
          <div key={i} className="wv-grid-line" />
        ))}
      </div>

      {/* Leave */}
      {leaveShift && (
        <div className="wv-slot wv-slot--leave">
          {leaveShift.type === 'maladie' ? '🏥 Maladie' : leaveShift.type === 'rtt' ? '🔵 RTT' : '🏖️ Congé'}
        </div>
      )}

      {/* Formation */}
      {formationShift && !leaveShift && (
        <div
          className="wv-slot wv-slot--special"
          style={{ background: '#3b82f6' }}
        >
          📖 Formation
        </div>
      )}

      {/* Garde / Astreinte */}
      {gardeShift && !leaveShift && !formationShift && (
        <div
          className="wv-slot wv-slot--special"
          style={{ background: gardeShift.type === 'garde' ? '#ef4444' : '#f59e0b' }}
        >
          {gardeShift.type === 'garde' ? '🔴' : '🟡'} {formatTime(gardeShift.start_time)}-{formatTime(gardeShift.end_time)}
        </div>
      )}

      {/* Work shifts as timeline bars */}
      {!leaveShift && !formationShift && !gardeShift && workShifts.map(shift => {
        const pos = getSlotPosition(shift.start_time, shift.end_time);
        return (
          <div
            key={shift.id}
            className="wv-slot"
            style={{
              left: `${pos.left}%`,
              width: `${pos.width}%`,
              backgroundColor: employee.display_color,
            }}
            draggable
            onDragStart={e => handleDragStart(e, shift)}
            onClick={e => {
              e.stopPropagation();
              onCellClick(employee.id, date, shift);
            }}
            title={`${formatTime(shift.start_time)} - ${formatTime(shift.end_time)} (${formatHours(shift.effective_hours)})${shift.break_duration > 0 ? ` P:${shift.break_duration}min` : ''}`}
          >
            <span className="wv-slot-time">
              {formatTime(shift.start_time)}-{formatTime(shift.end_time)}
            </span>
          </div>
        );
      })}

      {/* Conflict badges */}
      {dayConflicts.length > 0 && (
        <div className="wv-cell-conflicts">
          {dayConflicts.map(c => (
            <ConflictBadge key={c.id} severity={c.severity} message={c.message} compact />
          ))}
        </div>
      )}
    </div>
  );
}
