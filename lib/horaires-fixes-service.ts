/**
 * Service Horaires Fixes — Planning V2 Phase 5
 * Génère et fusionne les shifts récurrents pour une semaine
 */

import type { Shift } from '@/lib/types';
import type { HoraireFixes, HorairesFixesResult } from '@/lib/types/horaires-fixes';

/**
 * Calcule la parité de la semaine ISO (pair/impair)
 * On utilise le numéro de semaine ISO pour déterminer si c'est une semaine paire ou impaire
 */
function getWeekParity(mondayDateStr: string): 'even' | 'odd' {
  const [y, m, d] = mondayDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Calculer numéro de semaine ISO
  const janFirst = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - janFirst.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return weekNum % 2 === 0 ? 'even' : 'odd';
}

/**
 * Génère les shifts fixes pour une semaine donnée
 *
 * @param horairesFixes - Liste des horaires fixes récurrents
 * @param weekDates - Dates de la semaine (ISO strings, Lun-Dim = index 0-6)
 * @param existingShifts - Shifts déjà existants pour cette semaine
 * @param overwrite - Si true, ignore les conflits avec les shifts existants
 */
export function generateFixedSlots(
  horairesFixes: HoraireFixes[],
  weekDates: string[],
  existingShifts: Shift[],
  overwrite: boolean = false,
): HorairesFixesResult {
  const shiftsToCreate: HorairesFixesResult['shifts_to_create'] = [];
  let skippedCount = 0;
  let conflictCount = 0;

  // Parité de la semaine (basée sur le lundi)
  const weekParity = getWeekParity(weekDates[0]);

  // Indexer les shifts existants par employee_id|date
  const existingIndex = new Map<string, Shift[]>();
  for (const s of existingShifts) {
    const key = `${s.employee_id}|${s.date}`;
    const arr = existingIndex.get(key) || [];
    arr.push(s);
    existingIndex.set(key, arr);
  }

  for (const hf of horairesFixes) {
    if (!hf.is_active) continue;

    // Vérifier la parité de la semaine
    if (hf.alternate_weeks !== null && hf.alternate_weeks !== weekParity) {
      continue;
    }

    // day_of_week 0=lundi → weekDates[0], 5=samedi → weekDates[5]
    if (hf.day_of_week < 0 || hf.day_of_week > 6) continue;
    const dateStr = weekDates[hf.day_of_week];
    if (!dateStr) continue;

    // Vérifier si un shift existe déjà pour cet employé ce jour
    const key = `${hf.employee_id}|${dateStr}`;
    const existing = existingIndex.get(key) || [];

    if (existing.length > 0 && !overwrite) {
      skippedCount++;
      continue;
    }

    // Vérifier chevauchement si overwrite n'est pas activé
    if (existing.length > 0) {
      const hasOverlap = existing.some(s => {
        return s.start_time < hf.end_time && s.end_time > hf.start_time;
      });
      if (hasOverlap) {
        conflictCount++;
        if (!overwrite) continue;
      }
    }

    shiftsToCreate.push({
      employee_id: hf.employee_id,
      date: dateStr,
      start_time: hf.start_time,
      end_time: hf.end_time,
      break_duration: hf.break_duration,
      shift_type: hf.shift_type,
      label: hf.label,
    });
  }

  return {
    shifts_to_create: shiftsToCreate,
    skipped_count: skippedCount,
    conflict_count: conflictCount,
  };
}

/**
 * Fusionne les shifts fixes avec les shifts existants
 * Retourne uniquement les shifts à créer (pas de doublons)
 */
export function mergeFixedSlots(
  horairesFixes: HoraireFixes[],
  weekDates: string[],
  existingShifts: Shift[],
): HorairesFixesResult {
  return generateFixedSlots(horairesFixes, weekDates, existingShifts, false);
}

/**
 * Compte le nombre d'horaires fixes actifs par jour
 */
export function countFixedByDay(horairesFixes: HoraireFixes[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const hf of horairesFixes) {
    if (!hf.is_active) continue;
    counts.set(hf.day_of_week, (counts.get(hf.day_of_week) || 0) + 1);
  }
  return counts;
}

/**
 * Obtient les horaires fixes d'un employé
 */
export function getFixedForEmployee(
  horairesFixes: HoraireFixes[],
  employeeId: string,
): HoraireFixes[] {
  return horairesFixes.filter(hf => hf.employee_id === employeeId && hf.is_active);
}

/**
 * Vérifie si un employé a des horaires fixes pour un jour donné
 */
export function hasFixedForDay(
  horairesFixes: HoraireFixes[],
  employeeId: string,
  dayOfWeek: number,
): boolean {
  return horairesFixes.some(
    hf => hf.employee_id === employeeId && hf.day_of_week === dayOfWeek && hf.is_active,
  );
}
