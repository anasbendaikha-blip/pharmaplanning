'use client';

import { memo, useState, useCallback } from 'react';
import type { Shift, Conflict } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import ConflictBadge from './ConflictBadge';

interface ShiftCellProps {
  shifts: Shift[];
  conflicts: Conflict[];
  employeeColor: string;
  employeeId: string;
  date: string;
  isToday: boolean;
  onCellClick: (date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, fromEmployeeId: string, toDate: string) => void;
}

/**
 * Cellule du planning (intersection employé × jour)
 * - Click → ouvre modal création/édition
 * - Drag & Drop → déplace un shift vers un autre jour
 */
function ShiftCellComponent({
  shifts,
  conflicts,
  employeeColor,
  employeeId,
  date,
  isToday,
  onCellClick,
  onShiftDrop,
}: ShiftCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const hasShifts = shifts.length > 0;
  const hasConflicts = conflicts.length > 0;
  const worstSeverity = hasConflicts
    ? conflicts.some(c => c.severity === 'error') ? 'error'
      : conflicts.some(c => c.severity === 'warning') ? 'warning'
      : 'info'
    : null;

  const totalHours = shifts.reduce((sum, s) => sum + s.effective_hours, 0);

  // --- Click handler ---
  const handleClick = useCallback(() => {
    onCellClick(date, hasShifts ? shifts[0] : null);
  }, [date, hasShifts, shifts, onCellClick]);

  // --- Drag: commence le drag d'un shift ---
  const handleDragStart = useCallback((e: React.DragEvent, shift: Shift) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      shiftId: shift.id,
      employeeId: shift.employee_id,
      fromDate: shift.date,
    }));
    // Image de drag semi-transparente
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
    setTimeout(() => { el.style.opacity = ''; }, 0);
  }, []);

  // --- Drop zone ---
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

      // Vérifier même employé
      if (data.employeeId !== employeeId) return; // silencieusement ignoré ici, erreur gérée en haut

      // Même jour → rien à faire
      if (data.fromDate === date) return;

      onShiftDrop(data.shiftId, data.employeeId, date);
    } catch {
      // Données invalides
    }
  }, [employeeId, date, onShiftDrop]);

  return (
    <>
      <td
        className={`shift-cell ${hasShifts ? 'shift-cell--filled' : 'shift-cell--empty'} ${isToday ? 'shift-cell--today' : ''} ${worstSeverity ? `shift-cell--${worstSeverity}` : ''} ${isDragOver ? 'shift-cell--dragover' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasShifts ? (
          <div className="shift-content">
            {shifts.map(shift => (
              <div
                key={shift.id}
                className="shift-block"
                draggable
                onDragStart={e => handleDragStart(e, shift)}
              >
                <span className="shift-color-dot" style={{ backgroundColor: employeeColor }} />
                <span className="shift-time">
                  {formatTimeRange(shift.start_time, shift.end_time)}
                </span>
              </div>
            ))}
            <span className="shift-total">{formatHours(totalHours)}</span>
            {hasConflicts && (
              <div className="shift-conflicts">
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
        ) : (
          <div className="shift-empty">
            <span className="shift-empty-label">+</span>
          </div>
        )}
      </td>

      <style jsx>{`
        .shift-cell {
          padding: var(--spacing-1);
          border-right: 1px solid var(--color-neutral-200);
          border-bottom: 1px solid var(--color-neutral-200);
          vertical-align: top;
          min-width: var(--planning-cell-min-width);
          height: var(--planning-row-height);
          position: relative;
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .shift-cell--empty:hover {
          background-color: var(--color-primary-50);
        }
        .shift-cell--empty:hover .shift-empty-label {
          color: var(--color-primary-500);
          font-weight: var(--font-weight-bold);
        }

        .shift-cell--filled:hover {
          outline: 2px solid var(--color-primary-400);
          outline-offset: -2px;
          border-radius: 2px;
        }

        .shift-cell--today {
          background-color: var(--color-primary-50);
        }

        .shift-cell--error {
          background-color: var(--color-danger-50);
        }

        .shift-cell--warning {
          background-color: var(--color-warning-50);
        }

        .shift-cell--dragover {
          background-color: var(--color-secondary-50);
          outline: 2px dashed var(--color-secondary-400);
          outline-offset: -2px;
        }

        .shift-content {
          display: flex;
          flex-direction: column;
          gap: 1px;
          height: 100%;
          justify-content: center;
          padding: 0 var(--spacing-1);
        }

        .shift-block {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: grab;
        }
        .shift-block:active {
          cursor: grabbing;
        }

        .shift-color-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .shift-time {
          font-size: 11px;
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-800);
          white-space: nowrap;
        }

        .shift-total {
          font-size: 10px;
          color: var(--color-neutral-500);
          font-weight: var(--font-weight-medium);
        }

        .shift-conflicts {
          display: flex;
          gap: 2px;
          position: absolute;
          top: 2px;
          right: 2px;
        }

        .shift-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .shift-empty-label {
          color: var(--color-neutral-300);
          font-size: var(--font-size-md);
          transition: all var(--transition-fast);
        }
      `}</style>
    </>
  );
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)}-${formatTime(end)}`;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  return min === 0 ? `${hour}h` : `${hour}h${m}`;
}

export default memo(ShiftCellComponent);
