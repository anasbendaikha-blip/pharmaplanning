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

/** Couleurs uniformes BaggPlanning */
const SLOT_COLOR = '#6366f1';
const STUDENT_COLOR = '#a78bfa';

/** Config timeline */
const HOUR_START = 8;
const HOUR_END = 21;
const HOURS_SPAN = HOUR_END - HOUR_START;
const TIMELINE_MARKS = [8, 12, 16, 20];

interface SemaineViewProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  weekDates: string[];
  todayStr: string;
  filter: 'all' | EmployeeCategory;
  hideEmpty: boolean;
  collapsedCats: Set<EmployeeCategory>;
  onToggleCategory: (cat: EmployeeCategory) => void;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
  onDayClick: (dayIndex: number) => void;
}

/** Obtient les initiales d'un employé */
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

export default function SemaineView({
  employees,
  shifts,
  conflicts,
  weekDates,
  todayStr,
  filter,
  hideEmpty,
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

  return (
    <>
      <div className="sv-container">
        <div className="sv-scroll">
          <div className="sv-grid">
            {/* ═══ Header ═══ */}
            <div className="sv-header">
              <div className="sv-header-emp">EMPLOYÉ</div>
              {workDays.map((dateStr, dayIdx) => {
                const date = parseISODate(dateStr);
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    className={`sv-header-day ${isToday ? 'sv-header-day--today' : ''}`}
                    onClick={() => onDayClick(dayIdx)}
                  >
                    <div className="sv-day-name">{getDayShortFr(date)}</div>
                    <div className="sv-day-num">{date.getDate()}</div>
                    <div className="sv-timeline-marks">
                      {TIMELINE_MARKS.map(h => (
                        <span key={h} className="sv-hour-mark">{h}h</span>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="sv-header-total">TOTAL</div>
            </div>

            {/* ═══ Body ═══ */}
            <div className="sv-body">
              {Array.from(employeesByCategory.entries()).map(([category, catEmps]) => {
                const info = CATEGORY_INFO[category];
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
                        <span className="sv-cat-dot" style={{ backgroundColor: info.color }} />
                        <span className="sv-cat-icon">{info.icon}</span>
                        <span className="sv-cat-name">{info.label}</span>
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
                        todayStr={todayStr}
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
        /* SemaineView — BaggPlanning-style week grid     */
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
          min-width: 1200px;
        }

        /* ─── Header ─── */
        .sv-header {
          display: grid;
          grid-template-columns: 190px repeat(6, 1fr) 90px;
          position: sticky;
          top: 0;
          z-index: 10;
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

        .sv-header-day:hover {
          background: var(--color-neutral-100);
        }

        .sv-header-day--today {
          background: var(--color-primary-50);
        }

        .sv-header-day--today:hover {
          background: var(--color-primary-100);
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

        .sv-cat-header:hover {
          background: var(--color-neutral-200);
        }

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

        .sv-cat-icon {
          font-size: 13px;
        }

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
          grid-template-columns: 190px repeat(6, 1fr) 90px;
          min-height: 52px;
          border-bottom: 1px solid var(--color-neutral-100);
          transition: background 0.1s;
        }

        .sv-emp-row:hover {
          background: var(--color-neutral-50);
        }

        .sv-emp-row--conflict {
          background: var(--color-danger-50);
        }

        .sv-emp-row--conflict:hover {
          background: var(--color-danger-100);
        }

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
        }

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

        .sv-day-cell:hover {
          background: var(--color-primary-50);
        }

        .sv-day-cell--today {
          background: rgba(59, 130, 246, 0.03);
        }

        .sv-day-cell--dragover {
          background: var(--color-secondary-50);
          outline: 2px dashed var(--color-secondary-400);
          outline-offset: -2px;
        }

        /* Grid lines */
        .sv-grid-lines {
          position: absolute;
          inset: 0;
          display: flex;
          pointer-events: none;
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
          z-index: 2;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          transition: transform 0.1s, box-shadow 0.1s;
          overflow: hidden;
          padding: 0 4px;
        }

        .sv-slot:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
          z-index: 3;
        }

        .sv-slot:active {
          cursor: grabbing;
        }

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

        .sv-slot--special {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 10px;
          cursor: default;
          z-index: 5;
          font-weight: 600;
        }

        /* Conflict indicator on slot */
        .sv-cell-conflicts {
          position: absolute;
          top: 1px;
          right: 2px;
          display: flex;
          gap: 1px;
          z-index: 6;
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

        .sv-total-diff--over {
          color: var(--color-warning-600);
        }

        .sv-total-diff--under {
          color: var(--color-secondary-600);
        }

        .sv-total-diff--ok {
          color: var(--color-neutral-400);
        }

        .sv-total-contract {
          font-size: 9px;
          color: var(--color-neutral-400);
        }

        /* ─── Responsive ─── */
        @media (max-width: 1280px) {
          .sv-grid {
            min-width: 1000px;
          }

          .sv-header,
          .sv-emp-row {
            grid-template-columns: 160px repeat(6, 1fr) 80px;
          }

          .sv-emp-avatar {
            width: 28px;
            height: 28px;
            font-size: 10px;
          }

          .sv-slot-time {
            font-size: 8px;
          }
        }

        /* ─── Print ─── */
        @media print {
          .sv-container {
            border: none;
            border-radius: 0;
          }

          .sv-scroll {
            max-height: none;
            overflow: visible;
          }

          .sv-cat-header:hover {
            background: var(--color-neutral-100);
          }

          .sv-emp-row:hover,
          .sv-day-cell:hover {
            background: transparent;
          }

          .sv-slot:hover {
            transform: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          }
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
  todayStr,
  onCellClick,
  onShiftDrop,
  onDayClick,
}: {
  employee: Employee;
  workDays: string[];
  shiftIndex: Map<string, Shift[]>;
  conflictIndex: Map<string, Conflict[]>;
  weeklyShifts: Shift[];
  todayStr: string;
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
  const isStudent = employee.category === 'etudiant' || employee.category === 'apprenti';
  const avatarColor = isStudent ? STUDENT_COLOR : SLOT_COLOR;

  return (
    <div className={`sv-emp-row ${hasRowConflict ? 'sv-emp-row--conflict' : ''}`}>
      {/* Employee info */}
      <div className="sv-emp-cell">
        <div className="sv-emp-avatar" style={{ backgroundColor: avatarColor }}>
          {initials}
        </div>
        <div className="sv-emp-info">
          <span className="sv-emp-name">{employee.first_name} {employee.last_name}</span>
          <span className="sv-emp-meta">{employee.contract_hours}h/sem</span>
        </div>
      </div>

      {/* Day cells */}
      {workDays.map((date, dayIdx) => (
        <SemaineViewDayCell
          key={date}
          employee={employee}
          date={date}
          dayIndex={dayIdx}
          shifts={shiftIndex.get(`${employee.id}|${date}`) || []}
          conflicts={conflictIndex.get(`${employee.id}|${date}`) || []}
          isToday={date === todayStr}
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
  isToday,
  onCellClick,
  onShiftDrop,
  onDayClick,
}: {
  employee: Employee;
  date: string;
  dayIndex: number;
  shifts: Shift[];
  conflicts: Conflict[];
  isToday: boolean;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
  onDayClick: (dayIndex: number) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isStudent = employee.category === 'etudiant' || employee.category === 'apprenti';
  const slotColor = isStudent ? STUDENT_COLOR : SLOT_COLOR;

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
      className={`sv-day-cell ${isToday ? 'sv-day-cell--today' : ''} ${isDragOver ? 'sv-day-cell--dragover' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Grid lines */}
      <div className="sv-grid-lines">
        {Array.from({ length: HOURS_SPAN }).map((_, i) => (
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
        <div className="sv-slot sv-slot--special" style={{ background: '#3b82f6' }}>
          📖
        </div>
      )}

      {/* Garde / Astreinte */}
      {gardeShift && !leaveShift && !formationShift && (
        <div
          className="sv-slot sv-slot--special"
          style={{ background: gardeShift.type === 'garde' ? '#ef4444' : '#f59e0b' }}
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
