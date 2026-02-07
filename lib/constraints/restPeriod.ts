/**
 * Contrainte : Repos hebdomadaire obligatoire (35h minimum)
 *
 * Réglementation pharmaceutique :
 * - Repos hebdomadaire de 35 heures consécutives minimum
 * - Comprend obligatoirement le dimanche (sauf garde)
 * - Le repos commence après la fin du dernier shift de la période de travail
 *
 * Algorithme :
 * 1. Pour chaque employé, récupérer tous les shifts de la semaine
 * 2. Identifier la plus longue période sans travail
 * 3. Vérifier que cette période >= 35h
 */

import type { Shift } from '@/lib/types';
import type { Conflict, ConflictSeverity } from '@/lib/types';
import { timeToMinutes } from '@/lib/utils/hourUtils';

/** Durée minimale de repos hebdomadaire en heures */
const MIN_WEEKLY_REST_HOURS = 35;

interface RestPeriodResult {
  valid: boolean;
  longestRestHours: number;
  conflicts: Conflict[];
}

/**
 * Valide le repos hebdomadaire pour un employé sur une semaine donnée
 *
 * @param employeeId - ID de l'employé
 * @param shifts - Shifts de l'employé pour la semaine (triés par date/heure)
 * @param organizationId - ID de l'organisation
 * @param minRestHours - Minimum de repos en heures (défaut: 35)
 */
export function validateRestPeriod(
  employeeId: string,
  shifts: Shift[],
  organizationId: string,
  minRestHours: number = MIN_WEEKLY_REST_HOURS
): RestPeriodResult {
  // Pas de shifts = repos complet, toujours valide
  if (shifts.length === 0) {
    return { valid: true, longestRestHours: 168, conflicts: [] }; // 7 jours * 24h
  }

  // Trier les shifts par date puis heure de début
  const sortedShifts = [...shifts]
    .filter(s => s.type !== 'conge' && s.type !== 'maladie' && s.type !== 'rtt')
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    });

  if (sortedShifts.length === 0) {
    return { valid: true, longestRestHours: 168, conflicts: [] };
  }

  // Convertir chaque shift en timestamps (minutes depuis lundi 00:00)
  const monday = sortedShifts[0].date; // Supposé être la semaine en cours
  const shiftPeriods = sortedShifts.map(shift => {
    const dayOffset = getDayOffset(monday, shift.date);
    const startMinutes = dayOffset * 24 * 60 + timeToMinutes(shift.start_time);
    const endMinutes = dayOffset * 24 * 60 + timeToMinutes(shift.end_time);
    return { start: startMinutes, end: endMinutes, shift };
  });

  // Calculer les périodes de repos entre les shifts
  let longestRestMinutes = 0;

  // Repos avant le premier shift (depuis lundi 00:00)
  const firstStart = shiftPeriods[0].start;
  if (firstStart > 0) {
    longestRestMinutes = firstStart;
  }

  // Repos entre les shifts
  for (let i = 0; i < shiftPeriods.length - 1; i++) {
    const currentEnd = shiftPeriods[i].end;
    const nextStart = shiftPeriods[i + 1].start;
    const restMinutes = nextStart - currentEnd;
    if (restMinutes > longestRestMinutes) {
      longestRestMinutes = restMinutes;
    }
  }

  // Repos après le dernier shift (jusqu'à dimanche 23:59)
  const lastEnd = shiftPeriods[shiftPeriods.length - 1].end;
  const weekEndMinutes = 7 * 24 * 60; // Fin dimanche
  const restAfterLast = weekEndMinutes - lastEnd;
  if (restAfterLast > longestRestMinutes) {
    longestRestMinutes = restAfterLast;
  }

  const longestRestHours = longestRestMinutes / 60;
  const valid = longestRestHours >= minRestHours;

  const conflicts: Conflict[] = [];
  if (!valid) {
    conflicts.push({
      id: `rest-${employeeId}-${monday}`,
      organization_id: organizationId,
      type: 'insufficient_rest',
      severity: 'error' as ConflictSeverity,
      employee_ids: [employeeId],
      shift_ids: sortedShifts.map(s => s.id),
      message: `Repos hebdomadaire insuffisant : ${longestRestHours.toFixed(1)}h (minimum ${minRestHours}h requises)`,
      date: monday,
      is_resolved: false,
      resolution: null,
    });
  }

  return { valid, longestRestHours, conflicts };
}

/**
 * Calcule le décalage en jours entre deux dates ISO
 */
function getDayOffset(baseDate: string, targetDate: string): number {
  const base = new Date(baseDate);
  const target = new Date(targetDate);
  const diffMs = target.getTime() - base.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}
