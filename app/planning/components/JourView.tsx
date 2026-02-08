'use client';

import { useMemo, memo, useCallback } from 'react';
import type { Employee, Shift, Conflict, EmployeeCategory, Disponibilite } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import {
  TIMELINE_START,
  TIMELINE_END,
  TIMELINE_SPAN,
  TIMELINE_TICKS,
  PLANNING_ZONES,
  COLORS,
  CATEGORY_ORDER,
  CATEGORY_CONFIG,
  Z_LAYERS,
  getSlotPosition,
  getZonePosition,
  formatTime,
  formatTimeRange,
  getInitials,
  getSlotColor,
} from '@/lib/planning-config';
import {
  enrichDisposWithUsage,
  getDispoIndicator,
  getDispoTooltip,
} from '@/lib/disponibilites-service';
import ConflictBadge from './ConflictBadge';

interface JourViewProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  disponibilites: Disponibilite[];
  date: string;
  filter: 'all' | EmployeeCategory;
  hideEmpty: boolean;
  showDispos: boolean;
  showZones: boolean;
  showEmployeeColumn: boolean;
  collapsedCats: Set<EmployeeCategory>;
  onToggleCategory: (cat: EmployeeCategory) => void;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
}

export default function JourView({
  employees,
  shifts,
  conflicts,
  disponibilites,
  date,
  filter,
  hideEmpty,
  showDispos,
  showZones,
  showEmployeeColumn,
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

  // Grid columns depend on showEmployeeColumn
  const gridCols = showEmployeeColumn ? '190px 1fr 80px' : '1fr 80px';

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
        <div className="jv-timeline-wrap" style={{ gridTemplateColumns: gridCols }}>
          {showEmployeeColumn && <div className="jv-emp-header">EMPLOYÉ</div>}
          <div className="jv-timeline-header">
            {/* Zones in header */}
            {showZones && PLANNING_ZONES.map(zone => {
              const pos = getZonePosition(zone);
              return (
                <div
                  key={zone.id}
                  className="jv-zone-header"
                  style={{
                    left: `${pos.left}%`,
                    width: `${pos.width}%`,
                    background: zone.color,
                    borderLeft: `1px solid ${zone.borderColor}`,
                    borderRight: `1px solid ${zone.borderColor}`,
                  }}
                >
                  <span className="jv-zone-label" style={{ color: zone.textColor }}>{zone.label}</span>
                </div>
              );
            })}
            {/* Hour tick marks */}
            {TIMELINE_TICKS.map(h => {
              const pct = ((h - TIMELINE_START) / TIMELINE_SPAN) * 100;
              return (
                <div key={h} className="jv-tick" style={{ left: `${pct}%` }}>
                  <span className="jv-tick-label">{h}h</span>
                  <span className="jv-tick-line" />
                </div>
              );
            })}
          </div>
          <div className="jv-total-header">Total</div>
        </div>

        {/* Body */}
        <div className="jv-body">
          {Array.from(employeesByCategory.entries()).map(([category, catEmps]) => {
            const config = CATEGORY_CONFIG[category];
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
                  <span className="jv-cat-dot" style={{ backgroundColor: config.color }} />
                  <span className="jv-cat-icon">{config.icon}</span>
                  <span className="jv-cat-name">{config.label} ({visibleEmps.length})</span>
                </div>

                {/* Employee rows */}
                {!isCollapsed && visibleEmps.map(emp => (
                  <JourViewRow
                    key={emp.id}
                    employee={emp}
                    shifts={shiftsByEmployee.get(emp.id) || []}
                    conflicts={conflicts.filter(c => c.employee_ids.includes(emp.id) && c.date === date)}
                    disponibilites={disponibilites}
                    date={date}
                    showDispos={showDispos}
                    showZones={showZones}
                    showEmployeeColumn={showEmployeeColumn}
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
        /* JourView V2 — BaggPlanning-style day timeline  */
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

        .jv-stat { font-weight: 500; }
        .jv-stat-dot { color: var(--color-neutral-300); }

        /* ─── Timeline header ─── */
        .jv-timeline-wrap {
          display: grid;
          position: sticky;
          top: 0;
          z-index: ${Z_LAYERS.stickyHeader};
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
          position: relative;
          height: 44px;
        }

        /* Zone labels in header */
        .jv-zone-header {
          position: absolute;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: ${Z_LAYERS.zones};
        }

        .jv-zone-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* Tick marks */
        .jv-tick {
          position: absolute;
          top: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 0;
          z-index: 1;
        }

        .jv-tick-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-neutral-400);
          padding-top: 4px;
          white-space: nowrap;
          transform: translateX(-50%);
        }

        .jv-tick-line {
          flex: 1;
          width: 1px;
          background: var(--color-neutral-200);
          margin-top: 2px;
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

        /* ─── Body ─── */
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

        .jv-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .jv-cat-icon { font-size: 14px; }

        .jv-cat-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-600);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* ─── Employee row ─── */
        .jv-emp-row {
          display: grid;
          min-height: 52px;
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: pointer;
          transition: background 0.1s;
        }

        .jv-emp-row:hover { background: var(--color-neutral-50); }

        .jv-emp-row--conflict { background: var(--color-danger-50); }
        .jv-emp-row--conflict:hover { background: var(--color-danger-100); }

        .jv-emp-row--no-dispo {
          opacity: 0.5;
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
          position: relative;
        }

        .jv-dispo-indicator {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid white;
          font-size: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .jv-dispo-indicator--full { background: #22c55e; }
        .jv-dispo-indicator--partial { background: #f59e0b; }
        .jv-dispo-indicator--preferred { background: #3b82f6; }
        .jv-dispo-indicator--unavailable { background: #ef4444; }
        .jv-dispo-indicator--none { background: #94a3b8; }

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

        /* ─── Timeline cell ─── */
        .jv-timeline-cell {
          position: relative;
          padding: 6px 0;
        }

        /* Zone backgrounds in rows */
        .jv-zone-bg {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: ${Z_LAYERS.zones};
          pointer-events: none;
        }

        /* Disponibilité layer */
        .jv-dispo-layer {
          position: absolute;
          top: 4px;
          bottom: 4px;
          border-radius: 4px;
          z-index: ${Z_LAYERS.disponibilites};
          pointer-events: none;
        }

        .jv-dispo-layer--available {
          background: ${COLORS.dispoAvailable};
          border: 1px solid ${COLORS.dispoBorder};
        }

        .jv-dispo-layer--preferred {
          background: ${COLORS.dispoPreferred};
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        /* Grid lines */
        .jv-gridlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: ${Z_LAYERS.gridlines};
        }

        .jv-gridline-tick {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--color-neutral-100);
        }

        .jv-gridline-tick--major {
          background: var(--color-neutral-200);
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
          z-index: ${Z_LAYERS.work};
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
          transition: transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
          padding: 0 6px;
        }

        .jv-slot:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
          z-index: ${Z_LAYERS.work + 1};
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
            45deg, #fee2e2, #fee2e2 4px, #fecaca 4px, #fecaca 8px
          ) !important;
          color: #991b1b;
          border: 1px dashed #ef4444;
          font-weight: 600;
          z-index: ${Z_LAYERS.conges};
          font-size: 12px;
        }

        .jv-slot--special {
          left: 4px !important;
          right: 4px !important;
          width: auto !important;
          font-size: 11px;
          cursor: default;
          z-index: ${Z_LAYERS.conges};
          font-weight: 600;
        }

        /* Conflict badges */
        .jv-conflicts {
          position: absolute;
          top: 2px;
          right: 4px;
          display: flex;
          gap: 2px;
          z-index: ${Z_LAYERS.conflicts};
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

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .jv-emp-avatar {
            width: 32px;
            height: 32px;
            font-size: 11px;
          }
          .jv-slot-time { font-size: 10px; }
        }

        /* ─── Print ─── */
        @media print {
          .jv-container { border: none; border-radius: 0; }
          .jv-body { max-height: none; overflow: visible; }
          .jv-emp-row:hover, .jv-cat-header:hover { background: transparent; }
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
  disponibilites: Disponibilite[];
  date: string;
  showDispos: boolean;
  showZones: boolean;
  showEmployeeColumn: boolean;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
}

const JourViewRow = memo(function JourViewRow({
  employee,
  shifts: empShifts,
  conflicts,
  disponibilites,
  date,
  showDispos,
  showZones,
  showEmployeeColumn,
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
  const slotColor = getSlotColor(employee.category);

  // Disponibilité items
  const dispoItems = useMemo(() => {
    if (!showDispos) return [];
    return enrichDisposWithUsage(disponibilites, empShifts, employee.id, date);
  }, [showDispos, disponibilites, empShifts, employee.id, date]);

  // Dispo indicator
  const dispoIndicator = useMemo(() => {
    if (!showDispos) return null;
    return getDispoIndicator(disponibilites, employee.id, date);
  }, [showDispos, disponibilites, employee.id, date]);

  // Tooltip
  const dispoTitle = useMemo(() => {
    if (!showDispos) return undefined;
    return getDispoTooltip(disponibilites, employee, date);
  }, [showDispos, disponibilites, employee, date]);

  // Subtitle
  const subtitle = useMemo(() => {
    if (leaveShift) {
      return leaveShift.type === 'maladie' ? 'Maladie' : leaveShift.type === 'rtt' ? 'RTT' : 'Congé';
    }
    if (formationShift) return 'Formation';
    if (gardeShift) return gardeShift.type === 'garde' ? 'Garde' : 'Astreinte';
    if (workShifts.length > 1) return `${workShifts.length} créneaux`;
    if (workShifts.length === 1) return formatTimeRange(workShifts[0].start_time, workShifts[0].end_time);
    return '—';
  }, [leaveShift, formationShift, gardeShift, workShifts]);

  const handleClick = useCallback(() => {
    onCellClick(employee.id, date, empShifts.length > 0 ? empShifts[0] : null);
  }, [employee.id, date, empShifts, onCellClick]);

  const gridCols = showEmployeeColumn ? '190px 1fr 80px' : '1fr 80px';
  const isNoDispo = showDispos && dispoIndicator === 'none';

  return (
    <div
      className={`jv-emp-row ${hasConflicts ? 'jv-emp-row--conflict' : ''} ${isNoDispo ? 'jv-emp-row--no-dispo' : ''}`}
      style={{ gridTemplateColumns: gridCols }}
      onClick={handleClick}
      title={dispoTitle}
    >
      {/* Employee info */}
      {showEmployeeColumn && (
        <div className="jv-emp-cell">
          <div
            className="jv-emp-avatar"
            style={{ background: workShifts.length > 0 || gardeShift ? slotColor : '#cbd5e1' }}
          >
            {initials}
            {showDispos && dispoIndicator && (
              <span className={`jv-dispo-indicator jv-dispo-indicator--${dispoIndicator}`} />
            )}
          </div>
          <div className="jv-emp-info">
            <span className="jv-emp-name">{employee.first_name} {employee.last_name}</span>
            <span className="jv-emp-subtitle">{subtitle}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="jv-timeline-cell">
        {/* Zone backgrounds */}
        {showZones && PLANNING_ZONES.map(zone => {
          const pos = getZonePosition(zone);
          return (
            <div
              key={zone.id}
              className="jv-zone-bg"
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

        {/* Disponibilité layer */}
        {showDispos && dispoItems.map(item => {
          const pos = getSlotPosition(item.start_time, item.end_time);
          return (
            <div
              key={item.id}
              className={`jv-dispo-layer jv-dispo-layer--${item.type === 'preferred' ? 'preferred' : 'available'}`}
              style={{
                left: `${pos.left}%`,
                width: `${pos.width}%`,
              }}
            />
          );
        })}

        {/* Grid lines */}
        <div className="jv-gridlines">
          {TIMELINE_TICKS.map(h => {
            const pct = ((h - TIMELINE_START) / TIMELINE_SPAN) * 100;
            const isMajor = h % 4 === 0;
            return (
              <div
                key={h}
                className={`jv-gridline-tick ${isMajor ? 'jv-gridline-tick--major' : ''}`}
                style={{ left: `${pct}%` }}
              />
            );
          })}
        </div>

        {/* Leave */}
        {leaveShift && (
          <div className="jv-slot jv-slot--leave">
            {leaveShift.type === 'maladie' ? '🏥 Maladie' : leaveShift.type === 'rtt' ? '🔵 RTT' : '🏖️ Congé'}
          </div>
        )}

        {/* Formation */}
        {formationShift && !leaveShift && (
          <div className="jv-slot jv-slot--special" style={{ background: COLORS.formation }}>
            📖 Formation {formatTimeRange(formationShift.start_time, formationShift.end_time)}
          </div>
        )}

        {/* Garde / Astreinte */}
        {gardeShift && !leaveShift && !formationShift && (
          <div
            className="jv-slot jv-slot--special"
            style={{ background: gardeShift.type === 'garde' ? COLORS.garde : COLORS.astreinte }}
          >
            {gardeShift.type === 'garde' ? '🔴 Garde' : '🟡 Astreinte'} {formatTimeRange(gardeShift.start_time, gardeShift.end_time)}
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
                {formatTimeRange(shift.start_time, shift.end_time)}
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
