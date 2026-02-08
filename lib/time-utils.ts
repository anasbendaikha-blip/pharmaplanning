/**
 * Time Utilities — Planning V2 Phase 3
 * Fonctions de manipulation et calcul de créneaux horaires
 */

/**
 * Convertit "HH:MM" en minutes depuis minuit
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convertit des minutes depuis minuit en "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, minutes)); // 0..23:59
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Ajuste un horaire de +/- N minutes
 * Clamp entre 00:00 et 23:59
 */
export function adjustTime(time: string, deltaMinutes: number): string {
  const mins = timeToMinutes(time) + deltaMinutes;
  return minutesToTime(mins);
}

/**
 * Arrondit un horaire au quart d'heure le plus proche
 * mode: 'round' (défaut), 'floor', 'ceil'
 */
export function roundToQuarter(time: string, mode: 'round' | 'floor' | 'ceil' = 'round'): string {
  const mins = timeToMinutes(time);
  let rounded: number;
  if (mode === 'floor') {
    rounded = Math.floor(mins / 15) * 15;
  } else if (mode === 'ceil') {
    rounded = Math.ceil(mins / 15) * 15;
  } else {
    rounded = Math.round(mins / 15) * 15;
  }
  return minutesToTime(rounded);
}

/**
 * Calcule la durée en minutes entre deux horaires
 */
export function calculateDuration(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

/**
 * Formate une durée en minutes → "Xh" ou "XhYY"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}

/**
 * Formate une durée en minutes → "X heures" ou "X heures Y minutes"
 */
export function formatDurationLong(minutes: number): string {
  if (minutes <= 0) return '0 heure';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hStr = h > 0 ? `${h} heure${h > 1 ? 's' : ''}` : '';
  const mStr = m > 0 ? `${m} minute${m > 1 ? 's' : ''}` : '';
  if (h > 0 && m > 0) return `${hStr} ${mStr}`;
  return hStr || mStr;
}

/**
 * Vérifie si un créneau est compris dans une disponibilité
 * startTime/endTime doivent être dans [dispoStart, dispoEnd]
 */
export function isWithinDispo(
  startTime: string,
  endTime: string,
  dispoStart: string,
  dispoEnd: string,
): boolean {
  const sMin = timeToMinutes(startTime);
  const eMin = timeToMinutes(endTime);
  const dStartMin = timeToMinutes(dispoStart);
  const dEndMin = timeToMinutes(dispoEnd);
  return sMin >= dStartMin && eMin <= dEndMin;
}

/**
 * Calcule le point milieu entre deux horaires
 */
export function getMidpoint(startTime: string, endTime: string): string {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const mid = Math.round((start + end) / 2);
  return roundToQuarter(minutesToTime(mid));
}

/**
 * Suggère les créneaux possibles en fonction de la durée de dispo
 */
export interface SlotSuggestion {
  id: string;
  label: string;
  icon: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export function generateSlotSuggestions(
  dispoStart: string,
  dispoEnd: string,
): SlotSuggestion[] {
  const dStart = timeToMinutes(dispoStart);
  const dEnd = timeToMinutes(dispoEnd);
  const totalDuration = dEnd - dStart;
  const suggestions: SlotSuggestion[] = [];

  if (totalDuration <= 0) return suggestions;

  // ── Matinée : du début de dispo jusqu'à 13h (ou fin dispo si avant)
  const matinEnd = Math.min(dEnd, timeToMinutes('13:00'));
  if (matinEnd - dStart >= 120 && dStart < timeToMinutes('13:00')) {
    suggestions.push({
      id: 'morning',
      label: 'Matinée',
      icon: '🌅',
      start_time: minutesToTime(dStart),
      end_time: minutesToTime(matinEnd),
      duration_minutes: matinEnd - dStart,
    });
  }

  // ── Après-midi : de 13h (ou début dispo si après) jusqu'à fin dispo
  const apremStart = Math.max(dStart, timeToMinutes('13:00'));
  if (dEnd - apremStart >= 120 && dEnd > timeToMinutes('13:00')) {
    suggestions.push({
      id: 'afternoon',
      label: 'Après-midi',
      icon: '☀️',
      start_time: minutesToTime(apremStart),
      end_time: minutesToTime(dEnd),
      duration_minutes: dEnd - apremStart,
    });
  }

  // ── Journée complète : uniquement si la dispo fait >= 6h
  if (totalDuration >= 360) {
    suggestions.push({
      id: 'fullday',
      label: 'Journée',
      icon: '📋',
      start_time: dispoStart,
      end_time: dispoEnd,
      duration_minutes: totalDuration,
    });
  }

  return suggestions;
}

/**
 * Vérifie si deux créneaux se chevauchent
 */
export function slotsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && bS < aE;
}

/**
 * Calcule le chevauchement en minutes entre deux créneaux
 */
export function overlapMinutes(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));
}
