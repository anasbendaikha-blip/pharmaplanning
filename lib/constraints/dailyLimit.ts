/**
 * Contrainte : Durée maximale de travail journalier (10h)
 *
 * Réglementation :
 * - Maximum 10 heures de travail effectif par jour
 * - Pause obligatoire de 20 minutes après 6 heures consécutives
 * - Repos quotidien de 11 heures minimum entre deux journées de travail
 *
 * Algorithme :
 * 1. Regrouper les shifts par date pour chaque employé
 * 2. Calculer le total d'heures effectives par jour
 * 3. Vérifier que le total <= 10h
 * 4. Vérifier que la pause est respectée si > 6h
 * 5. Vérifier le repos inter-journées de 11h
 */

import type { Shift, Conflict, ConflictSeverity } from '@/lib/types';
import { calculateEffectiveHours, timeToMinutes } from '@/lib/utils/hourUtils';

/** Limites légales */
const MAX_DAILY_HOURS = 10;
const BREAK_THRESHOLD_HOURS = 6;
const MIN_BREAK_MINUTES = 20;
const MIN_DAILY_REST_HOURS = 11;

interface DailyLimitResult {
  valid: boolean;
  /** Heures par jour { "2026-02-06": 8.5, ... } */
  dailyHours: Record<string, number>;
  conflicts: Conflict[];
}

/**
 * Valide les limites journalières pour un employé sur une période
 */
export function validateDailyLimit(
  employeeId: string,
  shifts: Shift[],
  organizationId: string,
  maxDailyHours: number = MAX_DAILY_HOURS
): DailyLimitResult {
  const conflicts: Conflict[] = [];
  const dailyHours: Record<string, number> = {};

  // Filtrer les shifts de travail effectif
  const workShifts = shifts.filter(
    s => s.type !== 'conge' && s.type !== 'maladie' && s.type !== 'rtt'
  );

  // Regrouper par date
  const shiftsByDate = new Map<string, Shift[]>();
  for (const shift of workShifts) {
    const existing = shiftsByDate.get(shift.date) || [];
    existing.push(shift);
    shiftsByDate.set(shift.date, existing);
  }

  // Vérifier chaque jour
  for (const [date, dayShifts] of shiftsByDate) {
    // Calculer les heures effectives totales
    let totalEffectiveHours = 0;
    for (const shift of dayShifts) {
      totalEffectiveHours += calculateEffectiveHours(
        shift.start_time,
        shift.end_time,
        shift.break_duration
      );
    }

    dailyHours[date] = totalEffectiveHours;

    // Vérification 1 : Dépassement des heures maximales
    if (totalEffectiveHours > maxDailyHours) {
      conflicts.push({
        id: `daily-limit-${employeeId}-${date}`,
        organization_id: organizationId,
        type: 'daily_limit_exceeded',
        severity: 'error' as ConflictSeverity,
        employee_ids: [employeeId],
        shift_ids: dayShifts.map(s => s.id),
        message: `Dépassement horaire journalier : ${totalEffectiveHours.toFixed(1)}h / ${maxDailyHours}h maximum`,
        date,
        is_resolved: false,
        resolution: null,
      });
    }

    // Vérification 2 : Pause obligatoire si > 6h
    if (totalEffectiveHours > BREAK_THRESHOLD_HOURS) {
      const hasAdequateBreak = checkBreakCompliance(dayShifts);
      if (!hasAdequateBreak) {
        conflicts.push({
          id: `missing-break-${employeeId}-${date}`,
          organization_id: organizationId,
          type: 'missing_break',
          severity: 'warning' as ConflictSeverity,
          employee_ids: [employeeId],
          shift_ids: dayShifts.map(s => s.id),
          message: `Pause de ${MIN_BREAK_MINUTES} min obligatoire après ${BREAK_THRESHOLD_HOURS}h de travail consécutif`,
          date,
          is_resolved: false,
          resolution: null,
        });
      }
    }
  }

  // Vérification 3 : Repos inter-journées (11h entre deux jours de travail)
  const sortedDates = Array.from(shiftsByDate.keys()).sort();
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const currentDate = sortedDates[i];
    const nextDate = sortedDates[i + 1];
    const currentShifts = shiftsByDate.get(currentDate)!;
    const nextShifts = shiftsByDate.get(nextDate)!;

    const restHours = calculateInterDayRest(currentShifts, nextShifts, currentDate, nextDate);

    if (restHours < MIN_DAILY_REST_HOURS) {
      conflicts.push({
        id: `daily-rest-${employeeId}-${currentDate}`,
        organization_id: organizationId,
        type: 'insufficient_rest',
        severity: 'error' as ConflictSeverity,
        employee_ids: [employeeId],
        shift_ids: [
          ...currentShifts.map(s => s.id),
          ...nextShifts.map(s => s.id),
        ],
        message: `Repos entre journées insuffisant : ${restHours.toFixed(1)}h entre le ${currentDate} et le ${nextDate} (minimum ${MIN_DAILY_REST_HOURS}h)`,
        date: currentDate,
        is_resolved: false,
        resolution: null,
      });
    }
  }

  return {
    valid: conflicts.filter(c => c.severity === 'error').length === 0,
    dailyHours,
    conflicts,
  };
}

/**
 * Vérifie si la pause obligatoire est respectée pour les shifts d'une journée
 */
function checkBreakCompliance(dayShifts: Shift[]): boolean {
  // Si au moins un shift a une pause >= 20 min, c'est OK
  for (const shift of dayShifts) {
    if (shift.break_duration >= MIN_BREAK_MINUTES) {
      return true;
    }
  }

  // Si plusieurs shifts, vérifier l'espace entre eux
  if (dayShifts.length > 1) {
    const sorted = [...dayShifts].sort(
      (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = timeToMinutes(sorted[i + 1].start_time) - timeToMinutes(sorted[i].end_time);
      if (gap >= MIN_BREAK_MINUTES) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcule les heures de repos entre la fin de travail d'un jour
 * et le début de travail du jour suivant
 */
function calculateInterDayRest(
  currentDayShifts: Shift[],
  nextDayShifts: Shift[],
  currentDate: string,
  nextDate: string
): number {
  // Trouver la fin la plus tardive du jour courant
  const latestEnd = Math.max(
    ...currentDayShifts.map(s => timeToMinutes(s.end_time))
  );

  // Trouver le début le plus tôt du jour suivant
  const earliestStart = Math.min(
    ...nextDayShifts.map(s => timeToMinutes(s.start_time))
  );

  // Calculer le nombre de jours entre les deux dates
  const dayDiff = Math.round(
    (new Date(nextDate).getTime() - new Date(currentDate).getTime()) / (24 * 60 * 60 * 1000)
  );

  // Repos = (jours entiers entre les dates * 24h) + temps restant du jour courant + temps avant début du jour suivant
  const minutesRest = (dayDiff - 1) * 24 * 60 + (24 * 60 - latestEnd) + earliestStart;

  return minutesRest / 60;
}
