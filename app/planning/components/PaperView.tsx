'use client';

import { useMemo } from 'react';
import type { Employee, Shift, EmployeeCategory } from '@/lib/types';

/** Infos de catégorie pour l'affichage */
const CATEGORY_INFO: Record<EmployeeCategory, { label: string; color: string; icon: string }> = {
  pharmacien_titulaire: { label: 'Pharmaciens Titulaires', color: '#2563eb', icon: '💊' },
  pharmacien_adjoint: { label: 'Pharmaciens Adjoints', color: '#3b82f6', icon: '💊' },
  preparateur: { label: 'Préparateurs', color: '#10b981', icon: '⚗️' },
  rayonniste: { label: 'Rayonnistes', color: '#f59e0b', icon: '📦' },
  apprenti: { label: 'Apprentis', color: '#8b5cf6', icon: '🎓' },
  etudiant: { label: 'Étudiants', color: '#ec4899', icon: '📚' },
};

/** Ordre d'affichage des catégories */
const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

interface PaperViewProps {
  employees: Employee[];
  shifts: Shift[];
  /** Les 7 dates de la semaine au format ISO (Lun-Dim) */
  weekDates: string[];
  /** Nombre de jours à afficher (3, 5 ou 6) */
  visibleDays: number;
}

/**
 * Format time "HH:MM" → "8h30" ou "8h" si minutes = 00
 */
function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  return min === 0 ? `${hour}h` : `${hour}h${m}`;
}

/**
 * Nom court du jour depuis une date ISO
 */
function getDayLabel(isoDate: string): { dayName: string; dayNum: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return {
    dayName: days[date.getDay()],
    dayNum: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
  };
}

export default function PaperView({
  employees,
  shifts,
  weekDates,
  visibleDays,
}: PaperViewProps) {
  // Dates visibles (couper à visibleDays, max 6 jours ouvrables Lun-Sam)
  const visibleDates = useMemo(
    () => weekDates.slice(0, Math.min(visibleDays, 6)),
    [weekDates, visibleDays]
  );

  // Shifts indexés par employeeId + date
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

  // Employés actifs groupés par catégorie
  const employeesByCategory = useMemo(() => {
    const groups = new Map<EmployeeCategory, Employee[]>();
    for (const cat of CATEGORY_ORDER) {
      const catEmps = employees
        .filter(e => e.category === cat && e.is_active)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));
      if (catEmps.length > 0) {
        groups.set(cat, catEmps);
      }
    }
    return groups;
  }, [employees]);

  /** Formater les horaires d'un employé pour un jour donné */
  const formatEmployeeDay = (empId: string, date: string): { text: string; className: string } => {
    const key = `${empId}|${date}`;
    const dayShifts = shiftIndex.get(key) || [];

    if (dayShifts.length === 0) {
      return { text: '—', className: 'pv-cell-rest' };
    }

    // Congé / maladie / RTT
    const leaveShift = dayShifts.find(s =>
      s.type === 'conge' || s.type === 'maladie' || s.type === 'rtt'
    );
    if (leaveShift) {
      if (leaveShift.type === 'maladie') return { text: '🏥 Maladie', className: 'pv-cell-leave' };
      if (leaveShift.type === 'rtt') return { text: '🔵 RTT', className: 'pv-cell-leave' };
      return { text: '🏖️ Congé', className: 'pv-cell-leave' };
    }

    // Formation
    const formationShift = dayShifts.find(s => s.type === 'formation');
    if (formationShift) {
      return { text: '📖 Formation', className: 'pv-cell-formation' };
    }

    // Garde / astreinte
    const gardeShift = dayShifts.find(s => s.type === 'garde' || s.type === 'astreinte');
    if (gardeShift) {
      const label = gardeShift.type === 'garde' ? '🔴 Garde' : '🟡 Astreinte';
      const time = `${formatTime(gardeShift.start_time)}-${formatTime(gardeShift.end_time)}`;
      return { text: `${label} ${time}`, className: 'pv-cell-garde' };
    }

    // Shifts de travail normaux
    const workShifts = dayShifts.filter(s =>
      s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
    );

    if (workShifts.length === 0) {
      return { text: '—', className: 'pv-cell-rest' };
    }

    const hasPause = workShifts.some(s => s.break_duration > 0);

    const formatted = workShifts
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map(s => `${formatTime(s.start_time)}-${formatTime(s.end_time)}`)
      .join(', ');

    const suffix = hasPause ? ' (P)' : '';
    return { text: `${formatted}${suffix}`, className: 'pv-cell-work' };
  };

  /** Compter le nombre d'employés avec au moins un shift dans les jours visibles */
  const countWithShifts = (emps: Employee[]): number => {
    return emps.filter(emp =>
      visibleDates.some(date => {
        const key = `${emp.id}|${date}`;
        return (shiftIndex.get(key) || []).length > 0;
      })
    ).length;
  };

  const colCount = visibleDates.length + 1; // +1 for employee name column

  return (
    <>
      <div className="pv-container">
        <table className="pv-table">
          {/* Header */}
          <thead>
            <tr>
              <th className="pv-th-emp">Employé</th>
              {visibleDates.map(date => {
                const { dayName, dayNum } = getDayLabel(date);
                return (
                  <th key={date} className="pv-th-day">
                    <div className="pv-day-name">{dayName}</div>
                    <div className="pv-day-num">{dayNum}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {Array.from(employeesByCategory.entries()).map(([category, catEmps]) => {
              const info = CATEGORY_INFO[category];
              const withShifts = countWithShifts(catEmps);

              return (
                <PaperCategoryGroup
                  key={category}
                  label={info.label}
                  icon={info.icon}
                  color={info.color}
                  totalCount={catEmps.length}
                  activeCount={withShifts}
                  colSpan={colCount}
                  employees={catEmps}
                  visibleDates={visibleDates}
                  formatEmployeeDay={formatEmployeeDay}
                />
              );
            })}
          </tbody>
        </table>

        {/* Légende */}
        <div className="pv-legend">
          <span className="pv-legend-title">Légende :</span>
          <span className="pv-legend-item">(P) = Pause</span>
          <span className="pv-legend-item">🏖️ = Congé</span>
          <span className="pv-legend-item">🏥 = Maladie</span>
          <span className="pv-legend-item">🔵 = RTT</span>
          <span className="pv-legend-item">🔴 = Garde</span>
          <span className="pv-legend-item">— = Repos</span>
        </div>
      </div>

      <style jsx global>{`
        /* ─── Paper View ─── */
        .pv-container {
          padding: 20px;
          background: white;
          overflow-x: auto;
        }

        .pv-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Courier New', 'Consolas', monospace;
          font-size: 13px;
        }

        /* Header */
        .pv-th-emp {
          padding: 12px;
          text-align: left;
          background: var(--color-neutral-50, #f8fafc);
          border: 1px solid var(--color-neutral-300, #cbd5e1);
          font-weight: 700;
          color: var(--color-neutral-800, #1e293b);
          min-width: 160px;
          font-family: var(--font-family-primary, sans-serif);
          font-size: var(--font-size-sm, 13px);
        }

        .pv-th-day {
          padding: 8px 12px;
          text-align: center;
          background: var(--color-neutral-50, #f8fafc);
          border: 1px solid var(--color-neutral-300, #cbd5e1);
          min-width: 130px;
          font-family: var(--font-family-primary, sans-serif);
        }

        .pv-day-name {
          font-weight: 700;
          color: var(--color-neutral-800, #1e293b);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pv-day-num {
          font-size: 11px;
          color: var(--color-neutral-500, #64748b);
          margin-top: 2px;
        }

        /* Category rows */
        .pv-cat-row td {
          background: var(--color-neutral-100, #f1f5f9);
          border: 1px solid var(--color-neutral-300, #cbd5e1);
          padding: 6px 12px;
        }

        .pv-cat-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pv-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .pv-cat-icon {
          font-size: 14px;
        }

        .pv-cat-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-neutral-600, #475569);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-family: var(--font-family-primary, sans-serif);
        }

        .pv-cat-count {
          margin-left: auto;
          padding: 2px 8px;
          background: white;
          border: 1px solid var(--color-neutral-300, #cbd5e1);
          border-radius: 8px;
          font-size: 10px;
          color: var(--color-neutral-500, #64748b);
          font-family: var(--font-family-primary, sans-serif);
        }

        /* Employee rows */
        .pv-emp-row {
          border-bottom: 1px solid var(--color-neutral-200, #e2e8f0);
        }

        .pv-emp-row:hover {
          background: var(--color-neutral-50, #f8fafc);
        }

        .pv-emp-name {
          padding: 10px 12px;
          border: 1px solid var(--color-neutral-200, #e2e8f0);
          font-weight: 600;
          color: var(--color-neutral-800, #1e293b);
          white-space: nowrap;
          font-family: var(--font-family-primary, sans-serif);
          font-size: var(--font-size-sm, 13px);
        }

        .pv-hours-cell {
          padding: 10px 12px;
          border: 1px solid var(--color-neutral-200, #e2e8f0);
          text-align: center;
          font-family: 'Courier New', 'Consolas', monospace;
          font-size: 12px;
          white-space: nowrap;
        }

        .pv-cell-rest {
          color: var(--color-neutral-400, #94a3b8);
        }

        .pv-cell-work {
          color: var(--color-neutral-700, #334155);
        }

        .pv-cell-leave {
          color: var(--color-warning-600, #d97706);
          font-family: var(--font-family-primary, sans-serif);
          font-size: 11px;
        }

        .pv-cell-formation {
          color: var(--color-primary-600, #2563eb);
          font-family: var(--font-family-primary, sans-serif);
          font-size: 11px;
        }

        .pv-cell-garde {
          color: var(--color-danger-600, #dc2626);
          font-family: var(--font-family-primary, sans-serif);
          font-size: 11px;
        }

        /* Légende */
        .pv-legend {
          margin-top: 16px;
          padding: 10px 16px;
          background: var(--color-neutral-50, #f8fafc);
          border: 1px solid var(--color-neutral-300, #cbd5e1);
          border-radius: var(--radius-md, 6px);
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--color-neutral-500, #64748b);
          font-family: var(--font-family-primary, sans-serif);
        }

        .pv-legend-title {
          font-weight: 700;
          color: var(--color-neutral-600, #475569);
        }

        .pv-legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ─── Print styles ─── */
        @media print {
          .pv-container {
            padding: 0;
          }

          .pv-table {
            font-size: 10px;
          }

          .pv-th-emp,
          .pv-th-day {
            padding: 6px 8px;
          }

          .pv-emp-name,
          .pv-hours-cell {
            padding: 5px 6px;
          }

          .pv-th-day {
            min-width: 80px;
          }

          .pv-th-emp {
            min-width: 110px;
          }

          .pv-legend {
            margin-top: 8px;
            padding: 6px 10px;
            font-size: 9px;
            gap: 10px;
          }

          .pv-emp-row:hover {
            background: transparent;
          }
        }

        /* ─── Mobile ─── */
        @media (max-width: 768px) {
          .pv-table {
            font-size: 11px;
          }

          .pv-th-day,
          .pv-hours-cell {
            min-width: 100px;
            font-size: 10px;
            padding: 8px 6px;
          }

          .pv-th-emp,
          .pv-emp-name {
            min-width: 110px;
            font-size: 11px;
            padding: 8px 6px;
          }
        }
      `}</style>
    </>
  );
}

/**
 * Sous-composant : groupe de catégorie (header + lignes employés)
 */
function PaperCategoryGroup({
  label,
  icon,
  color,
  totalCount,
  activeCount,
  colSpan,
  employees: catEmps,
  visibleDates,
  formatEmployeeDay,
}: {
  label: string;
  icon: string;
  color: string;
  totalCount: number;
  activeCount: number;
  colSpan: number;
  employees: Employee[];
  visibleDates: string[];
  formatEmployeeDay: (empId: string, date: string) => { text: string; className: string };
}) {
  return (
    <>
      {/* Category header row */}
      <tr className="pv-cat-row">
        <td colSpan={colSpan}>
          <div className="pv-cat-content">
            <span className="pv-cat-dot" style={{ backgroundColor: color }} />
            <span className="pv-cat-icon">{icon}</span>
            <span className="pv-cat-label">{label}</span>
            <span className="pv-cat-count">
              {activeCount}/{totalCount}
            </span>
          </div>
        </td>
      </tr>

      {/* Employee rows */}
      {catEmps.map(emp => (
        <tr key={emp.id} className="pv-emp-row">
          <td className="pv-emp-name">
            {emp.first_name} {emp.last_name}
          </td>
          {visibleDates.map(date => {
            const { text, className } = formatEmployeeDay(emp.id, date);
            return (
              <td key={date} className={`pv-hours-cell ${className}`}>
                {text}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
