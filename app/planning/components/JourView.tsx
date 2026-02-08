'use client';

import { useMemo, memo, useCallback, useState } from 'react';
import type { Employee, Shift, Conflict, EmployeeCategory } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import ConflictBadge from './ConflictBadge';

/** Plage horaire de la timeline (8h - 21h) — style BaggPlanning */
const HOUR_START = 8;
const HOUR_END = 21;
const HOURS_SPAN = HOUR_END - HOUR_START;

/** Couleurs uniformes BaggPlanning */
const SLOT_COLOR = '#6366f1';
const STUDENT_COLOR = '#a78bfa';
const CONGE_COLOR = '#ef4444';

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

interface JourViewProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  date: string;
  filter: 'all' | EmployeeCategory;
  hideEmpty: boolean;
  collapsedCats: Set<EmployeeCategory>;
  onToggleCategory: (cat: EmployeeCategory) => void;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
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

/** Formate plage "8h30-19h30" */
function formatSlotTime(start: string, end: string): string {
  return `${formatTime(start)}-${formatTime(end)}`;
}

/** Calcule la position d'un shift dans la timeline */
function getSlotPosition(startTime: string, endTime: string): { left: number; width: number } {
  const startDec = timeToDecimal(startTime);
  const endDec = timeToDecimal(endTime);

  const left = ((Math.max(startDec, HOUR_START) - HOUR_START) / HOURS_SPAN) * 100;
  const right = ((Math.min(endDec, HOUR_END) - HOUR_START) / HOURS_SPAN) * 100;
  const width = Math.max(right - left, 3);

  return { left, width };
}

export default function JourView({
  employees,
  shifts,
  conflicts,
  date,
  filter,
  hideEmpty,
  collapsedCats,
  onToggleCategory,
  onCellClick,
}: JourViewProps) {
  // Shifts du jour uniquement
  const dayShifts = useMemo(() => shifts.filter(s => s.date === date), [shifts, date]);

  // Employés groupés par catégorie
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

  // Shifts indexés par employé
  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of dayShifts) {
      const arr = map.get(s.employee_id) || [];
      arr.push(s);
      map.set(s.employee_id, arr);
    }
    return map;
  }, [dayShifts]);

  // Label du jour
  const dateLabel = useMemo(() => {
    const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${DAY_NAMES[dt.getDay()]} ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
  }, [date]);

  // Stats du jour
  const dayStats = useMemo(() => {
    const workShifts = dayShifts.filter(s =>
      s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
    );
    const presentIds = new Set(workShifts.map(s => s.employee_id));
    const totalHours = dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);
    return { present: presentIds.size, totalSlots: workShifts.length, totalHours };
  }, [dayShifts]);

  // Timeline heures
  const timelineHours = useMemo(() => {
    return Array.from({ length: HOURS_SPAN + 1 }, (_, i) => HOUR_START + i);
  }, []);

  return (
    <>
      <div className="jv-container">
        {/* En-tête jour */}
        <div className="jv-header-bar">
          <h3 className="jv-date">{dateLabel}</h3>
          <div className="jv-stats">
            <span className="jv-stat">{dayStats.present} présents</span>
            <span className="jv-stat-dot">&middot;</span>
            <span className="jv-stat">{dayStats.totalSlots} créneaux</span>
            <span className="jv-stat-dot">&middot;</span>
            <span className="jv-stat">{formatHours(dayStats.totalHours)} planifiées</span>
          </div>
        </div>

        {/* Timeline header */}
        <div className="jv-timeline-wrap">
          <div className="jv-emp-header">EMPLOYÉ</div>
          <div className="jv-timeline-header">
            {timelineHours.map(h => (
              <div key={h} className="jv-hour-mark">
                <span className="jv-hour-label">{h}h</span>
              </div>
            ))}
          </div>
          <div className="jv-total-header">Total</div>
        </div>

        {/* Body */}
        <div className="jv-body">
          {Array.from(employeesByCategory.entries()).map(([category, catEmps]) => {
            const info = CATEGORY_INFO[category] || { label: category, color: '#666', icon: '' };
            const isCollapsed = collapsedCats.has(category);

            // Filter out empty employees
            const visibleEmps = hideEmpty
              ? catEmps.filter(e => (shiftsByEmployee.get(e.id) || []).length > 0)
              : catEmps;

            if (hideEmpty && visibleEmps.length === 0) return null;

            return (
              <div key={category} className="jv-cat-section">
                {/* Category header */}
                <div
                  className="jv-cat-header"
                  onClick={() => onToggleCategory(category)}
                >
                  <span className="jv-cat-chevron">{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                  <span className="jv-cat-icon">{info.icon}</span>
                  <span className="jv-cat-name">{info.label} ({visibleEmps.length})</span>
                </div>

                {/* Employee rows */}
                {!isCollapsed && visibleEmps.map(emp => (
                  <JourViewRow
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

      <style jsx global>{`
        /* ═══════════════════════════════════════════════ */
        /* JourView — BaggPlanning-style day timeline     */
        /* ═══════════════════════════════════════════════ */

        .jv-container {
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: white;
        }

        .jv-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
        }

        .jv-date {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .jv-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--color-neutral-500);
        }

        .jv-stat {
          font-weight: 500;
        }

        .jv-stat-dot {
          color: var(--color-neutral-300);
        }

        /* Timeline header */
        .jv-timeline-wrap {
          display: grid;
          grid-template-columns: 190px 1fr 80px;
          position: sticky;
          top: 0;
          z-index: 5;
          background: var(--color-neutral-50);
          border-bottom: 2px solid var(--color-neutral-300);
        }

        .jv-emp-header {
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-neutral-500);
          border-right: 2px solid var(--color-neutral-300);
          display: flex;
          align-items: flex-end;
        }

        .jv-timeline-header {
          display: flex;
          position: relative;
        }

        .jv-hour-mark {
          flex: 1;
          padding: 8px 0 8px 4px;
          border-left: 1px solid var(--color-neutral-200);
        }

        .jv-hour-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-400);
        }

        .jv-total-header {
          padding: 10px 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-neutral-500);
          text-align: center;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          border-left: 2px solid var(--color-neutral-300);
        }

        /* Body */
        .jv-body {
          max-height: calc(100vh - 360px);
          overflow-y: auto;
        }

        /* Category section */
        .jv-cat-section {
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .jv-cat-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--color-neutral-100);
          cursor: pointer;
          border-bottom: 1px solid var(--color-neutral-200);
          transition: background 0.1s;
        }

        .jv-cat-header:hover {
          background: var(--color-neutral-200);
        }

        .jv-cat-chevron {
          font-size: 9px;
          color: var(--color-neutral-500);
          width: 12px;
          text-align: center;
        }

        .jv-cat-icon {
          font-size: 14px;
        }

        .jv-cat-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* Employee row */
        .jv-emp-row {
          display: grid;
          grid-template-columns: 190px 1fr 80px;
          min-height: 52px;
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: pointer;
          transition: background 0.1s;
        }

        .jv-emp-row:hover {
          background: var(--color-neutral-50);
        }

        .jv-emp-row--conflict {
          background: var(--color-danger-50);
        }

        .jv-emp-row--conflict:hover {
          background: var(--color-danger-100);
        }

        /* Employee info cell */
        .jv-emp-cell {
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-right: 2px solid var(--color-neutral-300);
        }

        .jv-emp-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }

        .jv-emp-info {
          min-width: 0;
          flex: 1;
        }

        .jv-emp-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .jv-emp-subtitle {
          font-size: 11px;
          color: var(--color-neutral-400);
          font-weight: 500;
        }

        /* Timeline cell */
        .jv-timeline-cell {
          position: relative;
          padding: 6px 0;
        }

        .jv-gridlines {
          position: absolute;
          inset: 0;
          display: flex;
          pointer-events: none;
        }

        .jv-gridline {
          flex: 1;
          border-right: 1px solid var(--color-neutral-50);
        }

        .jv-gridline:nth-child(even) {
          border-right-color: var(--color-neutral-100);
        }

        /* Shift slots */
        .jv-slot {
          position: absolute;
          top: 6px;
          bottom: 6px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          z-index: 2;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          transition: transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
          padding: 0 6px;
        }

        .jv-slot:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
          z-index: 3;
        }

        .jv-slot-time {
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          letter-spacing: -0.01em;
        }

        .jv-slot-break {
          font-size: 9px;
          opacity: 0.8;
          white-space: nowrap;
          margin-left: 4px;
        }

        .jv-slot--leave {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
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
          font-size: 12px;
        }

        .jv-slot--special {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 11px;
          cursor: default;
          z-index: 5;
          font-weight: 600;
        }

        /* Conflict badges */
        .jv-conflicts {
          position: absolute;
          top: 2px;
          right: 4px;
          display: flex;
          gap: 2px;
          z-index: 6;
        }

        /* Total cell */
        .jv-total-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          border-left: 2px solid var(--color-neutral-300);
          padding: 4px 8px;
        }

        .jv-total-val {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .jv-total-empty {
          font-size: 13px;
          color: var(--color-neutral-300);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .jv-timeline-wrap,
          .jv-emp-row {
            grid-template-columns: 160px 1fr 70px;
          }

          .jv-emp-avatar {
            width: 32px;
            height: 32px;
            font-size: 11px;
          }

          .jv-slot-time {
            font-size: 10px;
          }
        }

        /* Print */
        @media print {
          .jv-container {
            border: none;
            border-radius: 0;
          }

          .jv-body {
            max-height: none;
            overflow: visible;
          }

          .jv-emp-row:hover,
          .jv-cat-header:hover {
            background: transparent;
          }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// JourViewRow — Single employee row with BaggPlanning style
// ═══════════════════════════════════════════════════════

interface JourViewRowProps {
  employee: Employee;
  shifts: Shift[];
  conflicts: Conflict[];
  date: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
}

const JourViewRow = memo(function JourViewRow({
  employee,
  shifts: empShifts,
  conflicts,
  date,
  onCellClick,
}: JourViewRowProps) {
  const totalHours = empShifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const hasConflicts = conflicts.some(c => c.severity === 'error');

  // Categorize shifts
  const workShifts = empShifts.filter(s =>
    s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
  );
  const leaveShift = empShifts.find(s =>
    s.type === 'conge' || s.type === 'maladie' || s.type === 'rtt'
  );
  const gardeShift = empShifts.find(s => s.type === 'garde' || s.type === 'astreinte');
  const formationShift = empShifts.find(s => s.type === 'formation');

  const initials = getInitials(employee.first_name, employee.last_name);
  const isStudent = employee.category === 'etudiant' || employee.category === 'apprenti';
  const slotColor = isStudent ? STUDENT_COLOR : SLOT_COLOR;

  // Subtitle: either time range or status
  const subtitle = useMemo(() => {
    if (leaveShift) {
      return leaveShift.type === 'maladie' ? 'Maladie' : leaveShift.type === 'rtt' ? 'RTT' : 'Congé';
    }
    if (formationShift) return 'Formation';
    if (gardeShift) return gardeShift.type === 'garde' ? 'Garde' : 'Astreinte';
    if (workShifts.length > 1) return `${workShifts.length} créneaux`;
    if (workShifts.length === 1) return formatSlotTime(workShifts[0].start_time, workShifts[0].end_time);
    return '—';
  }, [leaveShift, formationShift, gardeShift, workShifts]);

  const handleClick = useCallback(() => {
    onCellClick(employee.id, date, empShifts.length > 0 ? empShifts[0] : null);
  }, [employee.id, date, empShifts, onCellClick]);

  return (
    <div
      className={`jv-emp-row ${hasConflicts ? 'jv-emp-row--conflict' : ''}`}
      onClick={handleClick}
    >
      {/* Employee info */}
      <div className="jv-emp-cell">
        <div
          className="jv-emp-avatar"
          style={{ background: workShifts.length > 0 || gardeShift ? slotColor : '#cbd5e1' }}
        >
          {initials}
        </div>
        <div className="jv-emp-info">
          <span className="jv-emp-name">{employee.first_name} {employee.last_name}</span>
          <span className="jv-emp-subtitle">{subtitle}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="jv-timeline-cell">
        {/* Grid lines */}
        <div className="jv-gridlines">
          {Array.from({ length: HOURS_SPAN }).map((_, i) => (
            <div key={i} className="jv-gridline" />
          ))}
        </div>

        {/* Leave */}
        {leaveShift && (
          <div className="jv-slot jv-slot--leave">
            {leaveShift.type === 'maladie' ? '🏥 Maladie' : leaveShift.type === 'rtt' ? '🔵 RTT' : '🏖️ Congé'}
          </div>
        )}

        {/* Formation */}
        {formationShift && !leaveShift && (
          <div className="jv-slot jv-slot--special" style={{ background: '#3b82f6' }}>
            📖 Formation {formatSlotTime(formationShift.start_time, formationShift.end_time)}
          </div>
        )}

        {/* Garde / Astreinte */}
        {gardeShift && !leaveShift && !formationShift && (
          <div
            className="jv-slot jv-slot--special"
            style={{ background: gardeShift.type === 'garde' ? '#ef4444' : '#f59e0b' }}
          >
            {gardeShift.type === 'garde' ? '🔴 Garde' : '🟡 Astreinte'} {formatSlotTime(gardeShift.start_time, gardeShift.end_time)}
          </div>
        )}

        {/* Work shifts as bars */}
        {!leaveShift && !formationShift && !gardeShift && workShifts.map(shift => {
          const pos = getSlotPosition(shift.start_time, shift.end_time);
          return (
            <div
              key={shift.id}
              className="jv-slot"
              style={{
                left: `${pos.left}%`,
                width: `${pos.width}%`,
                backgroundColor: slotColor,
              }}
              title={`${formatTime(shift.start_time)} - ${formatTime(shift.end_time)} (${formatHours(shift.effective_hours)})${shift.break_duration > 0 ? ` P:${shift.break_duration}min` : ''}`}
              onClick={e => {
                e.stopPropagation();
                onCellClick(employee.id, date, shift);
              }}
            >
              <span className="jv-slot-time">
                {formatSlotTime(shift.start_time, shift.end_time)}
              </span>
              {shift.break_duration > 0 && pos.width > 20 && (
                <span className="jv-slot-break">P:{shift.break_duration}min</span>
              )}
            </div>
          );
        })}

        {/* Conflict badges */}
        {conflicts.length > 0 && (
          <div className="jv-conflicts">
            {conflicts.map(c => (
              <ConflictBadge key={c.id} severity={c.severity} message={c.message} compact />
            ))}
          </div>
        )}
      </div>

      {/* Total */}
      <div className="jv-total-cell">
        {totalHours > 0 ? (
          <span className="jv-total-val">{formatHours(totalHours)}</span>
        ) : (
          <span className="jv-total-empty">—</span>
        )}
      </div>
    </div>
  );
});
