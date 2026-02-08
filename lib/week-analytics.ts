/**
 * Week Analytics — Planning V2 Phase 4
 * Calcul des statistiques par jour et par semaine (couverture, lacunes, conflits)
 */

import type { Shift, Employee } from '@/lib/types';
import { timeToMinutes, slotsOverlap } from '@/lib/time-utils';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** Stats pour un jour */
export interface DayStats {
  /** Date ISO "YYYY-MM-DD" */
  date: string;
  /** Nombre de créneaux de travail */
  totalSlots: number;
  /** Nombre d'employés différents avec un créneau */
  uniqueWorkers: number;
  /** Heures totales planifiées */
  totalHours: number;
  /** Couverture en % (heures travaillées / heures ouverture attendues) */
  coverage: number;
  /** True si couverture <80% → lacune détectée */
  hasGaps: boolean;
  /** True si chevauchements entre shifts d'un même employé */
  hasConflicts: boolean;
  /** True si c'est un samedi (horaires réduits) */
  isSaturday: boolean;
}

/** Stats globales semaine */
export interface WeekStats {
  /** Total créneaux semaine */
  totalSlots: number;
  /** Nombre d'employés différents sur la semaine */
  uniqueWorkers: number;
  /** Heures totales semaine */
  totalHours: number;
  /** Couverture moyenne sur la semaine */
  averageCoverage: number;
  /** Stats par jour (Lun-Sam) */
  dayStats: DayStats[];
  /** Nombre de jours avec lacunes */
  daysWithGaps: number;
  /** Nombre de jours avec conflits */
  daysWithConflicts: number;
}

// ═══════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════

/** Heures d'ouverture attendues par jour */
const EXPECTED_HOURS_WEEKDAY = 11; // 8h30–19h30 = 11h
const EXPECTED_HOURS_SATURDAY = 11; // 8h30–19h30 = 11h (même horaire)

/** Seuil de couverture pour considérer une lacune */
const GAP_THRESHOLD_PERCENT = 80;

// ═══════════════════════════════════════════════════════
// Functions
// ═══════════════════════════════════════════════════════

/**
 * Calcule les stats pour un jour donné
 */
export function calculateDayStats(
  date: string,
  shifts: Shift[],
): DayStats {
  // Work shifts only
  const workShifts = shifts.filter(s =>
    s.date === date &&
    (s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
  );

  // Unique workers
  const workerIds = new Set(workShifts.map(s => s.employee_id));

  // Total hours
  const totalHours = workShifts.reduce((sum, s) => sum + s.effective_hours, 0);

  // Determine if Saturday
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const isSaturday = dt.getDay() === 6;

  // Expected hours
  const expectedHours = isSaturday ? EXPECTED_HOURS_SATURDAY : EXPECTED_HOURS_WEEKDAY;

  // Coverage (capped at 100%)
  const coverage = expectedHours > 0
    ? Math.min(100, Math.round((totalHours / expectedHours) * 100))
    : 0;

  // Gap detection
  const hasGaps = coverage < GAP_THRESHOLD_PERCENT;

  // Conflict detection (overlap within same employee)
  const hasConflicts = detectConflictsForDay(workShifts);

  return {
    date,
    totalSlots: workShifts.length,
    uniqueWorkers: workerIds.size,
    totalHours: Math.round(totalHours * 10) / 10,
    coverage,
    hasGaps,
    hasConflicts,
    isSaturday,
  };
}

/**
 * Calcule les stats pour toute la semaine
 */
export function calculateWeekStats(
  weekDates: string[],
  shifts: Shift[],
): WeekStats {
  // Stats per day (Lun-Sam = first 6 dates)
  const dayStats = weekDates.slice(0, 6).map(date =>
    calculateDayStats(date, shifts)
  );

  // Unique workers for the whole week
  const allWorkerIds = new Set(
    shifts
      .filter(s => s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
      .map(s => s.employee_id)
  );

  // Totals
  const totalSlots = dayStats.reduce((sum, d) => sum + d.totalSlots, 0);
  const totalHours = Math.round(dayStats.reduce((sum, d) => sum + d.totalHours, 0) * 10) / 10;
  const averageCoverage = dayStats.length > 0
    ? Math.round(dayStats.reduce((sum, d) => sum + d.coverage, 0) / dayStats.length)
    : 0;

  const daysWithGaps = dayStats.filter(d => d.hasGaps).length;
  const daysWithConflicts = dayStats.filter(d => d.hasConflicts).length;

  return {
    totalSlots,
    uniqueWorkers: allWorkerIds.size,
    totalHours,
    averageCoverage,
    dayStats,
    daysWithGaps,
    daysWithConflicts,
  };
}

/**
 * Calcule les heures totales d'un employé sur la semaine
 */
export function calculateEmployeeWeekHours(
  employeeId: string,
  shifts: Shift[],
): number {
  return shifts
    .filter(s =>
      s.employee_id === employeeId &&
      (s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
    )
    .reduce((sum, s) => sum + s.effective_hours, 0);
}

/**
 * Détecte les chevauchements entre shifts d'un même employé pour un jour
 */
function detectConflictsForDay(workShifts: Shift[]): boolean {
  // Group by employee
  const byEmployee = new Map<string, Shift[]>();
  for (const s of workShifts) {
    const arr = byEmployee.get(s.employee_id) || [];
    arr.push(s);
    byEmployee.set(s.employee_id, arr);
  }

  // Check overlaps per employee
  for (const [, empShifts] of byEmployee) {
    if (empShifts.length < 2) continue;
    for (let i = 0; i < empShifts.length; i++) {
      for (let j = i + 1; j < empShifts.length; j++) {
        if (slotsOverlap(
          empShifts[i].start_time, empShifts[i].end_time,
          empShifts[j].start_time, empShifts[j].end_time,
        )) {
          return true;
        }
      }
    }
  }

  return false;
}
