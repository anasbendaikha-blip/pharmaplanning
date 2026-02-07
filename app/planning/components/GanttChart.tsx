'use client';

import { useMemo } from 'react';
import type { Employee, Shift, Conflict, EmployeeCategory } from '@/lib/types';
import TimelineHeader from './TimelineHeader';
import EmployeeRow from './EmployeeRow';
import CategorySeparator from './CategorySeparator';

/** Ordre d'affichage des catégories */
const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

interface GanttChartProps {
  employees: Employee[];
  shifts: Shift[];
  conflicts: Conflict[];
  weekDates: string[];
  todayStr: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
}

export default function GanttChart({
  employees,
  shifts,
  conflicts,
  weekDates,
  todayStr,
  onCellClick,
  onShiftDrop,
}: GanttChartProps) {
  // Employés groupés par catégorie dans l'ordre défini
  const employeesByCategory = useMemo(() => {
    const groups = new Map<EmployeeCategory, Employee[]>();
    for (const cat of CATEGORY_ORDER) {
      const catEmployees = employees
        .filter(e => e.category === cat && e.is_active)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));
      if (catEmployees.length > 0) {
        groups.set(cat, catEmployees);
      }
    }
    return groups;
  }, [employees]);

  // Shifts par employé
  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const existing = map.get(shift.employee_id) || [];
      existing.push(shift);
      map.set(shift.employee_id, existing);
    }
    return map;
  }, [shifts]);

  // Nombre d'employés planifiés par jour
  const dailyEmployeeCounts = useMemo(() => {
    const counts: Record<string, Set<string>> = {};
    for (const date of weekDates) {
      counts[date] = new Set();
    }
    for (const shift of shifts) {
      if (counts[shift.date]) {
        counts[shift.date].add(shift.employee_id);
      }
    }
    const result: Record<string, number> = {};
    for (const date of weekDates) {
      result[date] = counts[date].size;
    }
    return result;
  }, [shifts, weekDates]);

  // Heures totales par jour
  const dailyTotalHours = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const date of weekDates) {
      totals[date] = 0;
    }
    for (const shift of shifts) {
      if (totals[shift.date] !== undefined) {
        totals[shift.date] += shift.effective_hours;
      }
    }
    return totals;
  }, [shifts, weekDates]);

  return (
    <>
      <div className="gantt-container">
        <div className="gantt-scroll">
          <table className="gantt-table">
            <TimelineHeader
              weekDates={weekDates}
              todayStr={todayStr}
              dailyEmployeeCounts={dailyEmployeeCounts}
              dailyTotalHours={dailyTotalHours}
            />
            <tbody>
              {Array.from(employeesByCategory.entries()).map(([category, catEmployees]) => (
                <CategoryGroup
                  key={category}
                  category={category}
                  employees={catEmployees}
                  shiftsByEmployee={shiftsByEmployee}
                  conflicts={conflicts}
                  weekDates={weekDates}
                  todayStr={todayStr}
                  onCellClick={onCellClick}
                  onShiftDrop={onShiftDrop}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .gantt-container {
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background-color: white;
        }

        .gantt-scroll {
          overflow: auto;
          max-height: calc(100vh - 240px);
        }

        .gantt-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
      `}</style>
    </>
  );
}

/** Sous-composant : groupe de catégorie avec séparateur */
function CategoryGroup({
  category,
  employees,
  shiftsByEmployee,
  conflicts,
  weekDates,
  todayStr,
  onCellClick,
  onShiftDrop,
}: {
  category: EmployeeCategory;
  employees: Employee[];
  shiftsByEmployee: Map<string, Shift[]>;
  conflicts: Conflict[];
  weekDates: string[];
  todayStr: string;
  onCellClick: (employeeId: string, date: string, shift: Shift | null) => void;
  onShiftDrop: (shiftId: string, employeeId: string, toDate: string) => void;
}) {
  return (
    <>
      <CategorySeparator
        category={category}
        employeeCount={employees.length}
        totalColumns={8}
      />
      {employees.map(employee => (
        <EmployeeRow
          key={employee.id}
          employee={employee}
          weekDates={weekDates}
          shifts={shiftsByEmployee.get(employee.id) || []}
          conflicts={conflicts}
          todayStr={todayStr}
          onCellClick={onCellClick}
          onShiftDrop={onShiftDrop}
        />
      ))}
    </>
  );
}
