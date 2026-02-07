'use client';

import { memo, useMemo, useCallback } from 'react';
import type { Employee, Shift, Conflict } from '@/lib/types';
import { formatHours } from '@/lib/utils/hourUtils';
import ShiftCell from './ShiftCell';

/** Labels des catégories en français */
const CATEGORY_LABELS: Record<string, string> = {
  pharmacien_titulaire: 'Titulaire',
  pharmacien_adjoint: 'Adjoint(e)',
  preparateur: 'Préparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti(e)',
  etudiant: 'Étudiant(e)',
};

interface EmployeeRowProps {
  employee: Employee;
  weekDates: string[];
  shifts: Shift[];
  conflicts: Conflict[];
  todayStr: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
}

function EmployeeRowComponent({
  employee,
  weekDates,
  shifts,
  conflicts,
  todayStr,
  onCellClick,
  onShiftDrop,
}: EmployeeRowProps) {
  // Shifts groupés par date pour cet employé
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const existing = map.get(shift.date) || [];
      existing.push(shift);
      map.set(shift.date, existing);
    }
    return map;
  }, [shifts]);

  // Conflits concernant cet employé, groupés par date
  const conflictsByDate = useMemo(() => {
    const map = new Map<string, Conflict[]>();
    for (const conflict of conflicts) {
      if (conflict.employee_ids.includes(employee.id)) {
        const existing = map.get(conflict.date) || [];
        existing.push(conflict);
        map.set(conflict.date, existing);
      }
    }
    return map;
  }, [conflicts, employee.id]);

  // Total heures de la semaine
  const weeklyTotal = useMemo(() => {
    return shifts.reduce((sum, s) => sum + s.effective_hours, 0);
  }, [shifts]);

  const hoursDiff = weeklyTotal - employee.contract_hours;
  const hasRowConflicts = conflicts.some(c => c.employee_ids.includes(employee.id) && c.severity === 'error');

  // Wrap le callback pour inclure l'employeeId
  const handleCellClick = useCallback(
    (date: string, shift: Shift | null) => {
      onCellClick(employee.id, date, shift);
    },
    [employee.id, onCellClick]
  );

  return (
    <>
      <tr className={`employee-row ${hasRowConflicts ? 'employee-row--conflict' : ''}`}>
        {/* Colonne employé (fixe) */}
        <td className="employee-cell">
          <div className="employee-info">
            <span className="employee-color" style={{ backgroundColor: employee.display_color }} />
            <div className="employee-details">
              <span className="employee-name">
                {employee.first_name} {employee.last_name}
              </span>
              <span className="employee-category">
                {CATEGORY_LABELS[employee.category] || employee.category}
              </span>
            </div>
          </div>
        </td>

        {/* Cellules par jour */}
        {weekDates.map(date => (
          <ShiftCell
            key={date}
            shifts={shiftsByDate.get(date) || []}
            conflicts={conflictsByDate.get(date) || []}
            employeeColor={employee.display_color}
            employeeId={employee.id}
            date={date}
            isToday={date === todayStr}
            onCellClick={handleCellClick}
            onShiftDrop={onShiftDrop}
          />
        ))}

        {/* Colonne total heures */}
        <td className="total-cell">
          <div className="total-content">
            <span className="total-hours">{formatHours(weeklyTotal)}</span>
            <span className={`total-diff ${hoursDiff > 0 ? 'total-diff--over' : hoursDiff < 0 ? 'total-diff--under' : ''}`}>
              {hoursDiff > 0 ? '+' : ''}{formatHours(hoursDiff)}
            </span>
            <span className="total-contract">{formatHours(employee.contract_hours)}</span>
          </div>
        </td>
      </tr>

      <style jsx>{`
        .employee-row {
          transition: background-color var(--transition-fast);
        }
        .employee-row:hover {
          background-color: var(--color-neutral-50);
        }
        .employee-row--conflict {
          background-color: var(--color-danger-50);
        }
        .employee-row--conflict:hover {
          background-color: var(--color-danger-100);
        }

        .employee-cell {
          position: sticky;
          left: 0;
          z-index: 2;
          background-color: white;
          border-right: 2px solid var(--color-neutral-300);
          border-bottom: 1px solid var(--color-neutral-200);
          padding: var(--spacing-1) var(--spacing-2);
          min-width: 180px;
          max-width: 180px;
        }
        .employee-row:hover .employee-cell {
          background-color: var(--color-neutral-50);
        }
        .employee-row--conflict .employee-cell {
          background-color: var(--color-danger-50);
        }

        .employee-info {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .employee-color {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .employee-details {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .employee-name {
          font-size: 12px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employee-category {
          font-size: 10px;
          color: var(--color-neutral-500);
          white-space: nowrap;
        }

        .total-cell {
          position: sticky;
          right: 0;
          z-index: 2;
          background-color: white;
          border-left: 2px solid var(--color-neutral-300);
          border-bottom: 1px solid var(--color-neutral-200);
          padding: var(--spacing-1) var(--spacing-2);
          min-width: 90px;
        }
        .employee-row:hover .total-cell {
          background-color: var(--color-neutral-50);
        }

        .total-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }

        .total-hours {
          font-size: 12px;
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .total-diff {
          font-size: 10px;
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
        }
        .total-diff--over {
          color: var(--color-warning-600);
        }
        .total-diff--under {
          color: var(--color-secondary-600);
        }

        .total-contract {
          font-size: 9px;
          color: var(--color-neutral-400);
        }
      `}</style>
    </>
  );
}

export default memo(EmployeeRowComponent);
