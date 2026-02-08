/**
 * Slot Validation — Planning V2 Phase 3
 * Valide les créneaux avant création et suggère des pauses
 */

import type { Shift } from '@/lib/types';
import type { ValidationResult, ValidationMessage } from '@/lib/types/quick-assign';
import {
  timeToMinutes,
  calculateDuration,
  slotsOverlap,
  isWithinDispo,
  formatDuration,
} from '@/lib/time-utils';

/**
 * Valide un créneau proposé
 */
export function validateSlot(
  startTime: string,
  endTime: string,
  dispoStart: string,
  dispoEnd: string,
  existingShifts: Shift[],
  breakDuration: number = 0,
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const duration = endMin - startMin;

  // ═══ ERREURS BLOQUANTES ═══

  // 1. Créneau inversé ou nul
  if (duration <= 0) {
    errors.push({
      code: 'invalid_range',
      message: 'L\'heure de fin doit être après l\'heure de début',
      icon: '❌',
    });
  }

  // 2. Créneau trop court (< 30 min)
  if (duration > 0 && duration < 30) {
    errors.push({
      code: 'too_short',
      message: 'Le créneau doit durer au moins 30 minutes',
      icon: '⏱️',
    });
  }

  // 3. Dépasse la disponibilité
  if (!isWithinDispo(startTime, endTime, dispoStart, dispoEnd) && duration > 0) {
    errors.push({
      code: 'outside_dispo',
      message: `Le créneau dépasse la disponibilité (${dispoStart}–${dispoEnd})`,
      icon: '📋',
    });
  }

  // 4. Chevauchement avec un shift existant
  const workShifts = existingShifts.filter(s =>
    s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
  );

  for (const shift of workShifts) {
    if (slotsOverlap(startTime, endTime, shift.start_time, shift.end_time)) {
      errors.push({
        code: 'overlap',
        message: `Chevauchement avec le shift ${shift.start_time}–${shift.end_time}`,
        icon: '🔄',
      });
      break; // Une seule erreur de chevauchement suffit
    }
  }

  // 5. Dépassement 10h journalières
  const existingHours = existingShifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const newEffective = (duration - breakDuration) / 60;
  const totalDailyHours = existingHours + newEffective;

  if (totalDailyHours > 10) {
    errors.push({
      code: 'daily_limit',
      message: `Total journalier (${formatDuration(Math.round(totalDailyHours * 60))}) dépasse 10h`,
      icon: '⚖️',
    });
  }

  // ═══ AVERTISSEMENTS ═══

  // 1. Plus de 6h sans pause
  if (duration >= 360 && breakDuration === 0) {
    warnings.push({
      code: 'needs_break',
      message: 'Un créneau de plus de 6h nécessite une pause (minimum 20 min)',
      icon: '☕',
    });
  }

  // 2. Créneau long (> 8h)
  if (duration > 480) {
    warnings.push({
      code: 'long_shift',
      message: 'Créneau de plus de 8h — vérifiez la conformité',
      icon: '⏰',
    });
  }

  // 3. Total approche 10h
  if (totalDailyHours > 9 && totalDailyHours <= 10) {
    warnings.push({
      code: 'near_daily_limit',
      message: `Total journalier proche de 10h (${formatDuration(Math.round(totalDailyHours * 60))})`,
      icon: '⚠️',
    });
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Suggère une pause automatique pour un créneau ≥ 6h
 */
export function suggestPause(
  startTime: string,
  endTime: string,
): { shouldSuggest: boolean; breakDuration: number; breakStart: string; breakEnd: string } {
  const duration = calculateDuration(startTime, endTime);

  if (duration < 360) {
    return { shouldSuggest: false, breakDuration: 0, breakStart: '', breakEnd: '' };
  }

  // Pause de 30 min au milieu du créneau
  const startMin = timeToMinutes(startTime);
  const midpoint = startMin + Math.floor(duration / 2);
  const breakStartMin = Math.floor(midpoint / 15) * 15; // Arrondi au quart d'heure
  const breakDuration = duration >= 480 ? 60 : 30; // 1h si ≥8h, sinon 30min
  const breakEndMin = breakStartMin + breakDuration;

  return {
    shouldSuggest: true,
    breakDuration,
    breakStart: minutesToTimeLocal(breakStartMin),
    breakEnd: minutesToTimeLocal(breakEndMin),
  };
}

// Local helper to avoid circular import
function minutesToTimeLocal(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
