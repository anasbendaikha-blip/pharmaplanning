/**
 * Orchestration des contraintes pharmaceutiques
 *
 * Point d'entrée unique pour valider un planning complet
 * contre toutes les contraintes légales et réglementaires
 */

import type { Shift, Conflict, Employee, WeeklyOpeningHours } from '@/lib/types';
import { validateRestPeriod } from './restPeriod';
import { validateDailyLimit } from './dailyLimit';
import { validatePharmacistCoverage } from './pharmacistCoverage';

export { validateRestPeriod } from './restPeriod';
export { validateDailyLimit } from './dailyLimit';
export { validatePharmacistCoverage, validateWeeklyPharmacistCoverage } from './pharmacistCoverage';

/** Résultat complet de la validation du planning */
export interface PlanningValidationResult {
  /** Planning globalement valide (aucune erreur critique) */
  valid: boolean;
  /** Tous les conflits détectés */
  conflicts: Conflict[];
  /** Nombre d'erreurs critiques */
  errorCount: number;
  /** Nombre d'avertissements */
  warningCount: number;
  /** Résumé par employé */
  employeeResults: Map<string, EmployeeValidationSummary>;
  /** Couverture pharmacien (%) */
  pharmacistCoveragePercent: number;
}

interface EmployeeValidationSummary {
  employeeId: string;
  /** Repos hebdomadaire respecté */
  restPeriodValid: boolean;
  /** Limites journalières respectées */
  dailyLimitValid: boolean;
  /** Heures totales de la semaine */
  totalWeeklyHours: number;
  /** Conflits de cet employé */
  conflicts: Conflict[];
}

/**
 * Valide un planning hebdomadaire complet contre toutes les contraintes
 */
export function validateWeeklyPlanning(
  shifts: Shift[],
  employees: Employee[],
  weekDates: string[],
  openingHours: WeeklyOpeningHours,
  organizationId: string,
  options?: {
    maxDailyHours?: number;
    minRestHours?: number;
    minPharmacists?: number;
  }
): PlanningValidationResult {
  const allConflicts: Conflict[] = [];
  const employeeResults = new Map<string, EmployeeValidationSummary>();

  const maxDailyHours = options?.maxDailyHours ?? 10;
  const minRestHours = options?.minRestHours ?? 35;
  const minPharmacists = options?.minPharmacists ?? 1;

  // Pour chaque employé actif
  for (const employee of employees.filter(e => e.is_active)) {
    const employeeShifts = shifts.filter(s => s.employee_id === employee.id);

    // 1. Validation repos hebdomadaire (35h)
    const restResult = validateRestPeriod(
      employee.id, employeeShifts, organizationId, minRestHours
    );

    // 2. Validation limites journalières (10h)
    const dailyResult = validateDailyLimit(
      employee.id, employeeShifts, organizationId, maxDailyHours
    );

    // Calculer les heures totales
    const totalWeeklyHours = Object.values(dailyResult.dailyHours).reduce(
      (sum, h) => sum + h, 0
    );

    // Collecter les conflits de cet employé
    const employeeConflicts = [...restResult.conflicts, ...dailyResult.conflicts];
    allConflicts.push(...employeeConflicts);

    employeeResults.set(employee.id, {
      employeeId: employee.id,
      restPeriodValid: restResult.valid,
      dailyLimitValid: dailyResult.valid,
      totalWeeklyHours,
      conflicts: employeeConflicts,
    });
  }

  // 3. Validation couverture pharmacien par jour
  let totalCoverage = 0;
  let openDays = 0;

  for (let i = 0; i < weekDates.length; i++) {
    const date = weekDates[i];
    const dayOpeningHours = openingHours[i];

    if (!dayOpeningHours || !dayOpeningHours.is_open) continue;

    openDays++;
    const dayShifts = shifts.filter(s => s.date === date);
    const coverageResult = validatePharmacistCoverage(
      date, dayShifts, employees, dayOpeningHours, organizationId, minPharmacists
    );

    totalCoverage += coverageResult.coveragePercent;
    allConflicts.push(...coverageResult.conflicts);
  }

  const pharmacistCoveragePercent = openDays > 0
    ? Math.round(totalCoverage / openDays)
    : 100;

  const errorCount = allConflicts.filter(c => c.severity === 'error').length;
  const warningCount = allConflicts.filter(c => c.severity === 'warning').length;

  return {
    valid: errorCount === 0,
    conflicts: allConflicts,
    errorCount,
    warningCount,
    employeeResults,
    pharmacistCoveragePercent,
  };
}
