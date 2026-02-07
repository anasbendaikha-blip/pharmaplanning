/**
 * Utilitaires de gestion des heures pour PharmaPlanning
 * Convention : heures en format décimal (7.75 = 7h45) et format HH:MM
 */

/**
 * Convertit des heures décimales en format lisible "Xh YY"
 * Ex: 7.75 → "7h45", 8 → "8h00", 0.5 → "0h30"
 */
export function formatHours(decimalHours: number): string {
  const hours = Math.floor(Math.abs(decimalHours));
  const minutes = Math.round((Math.abs(decimalHours) - hours) * 60);
  const sign = decimalHours < 0 ? '-' : '';
  return `${sign}${hours}h${String(minutes).padStart(2, '0')}`;
}

/**
 * Parse un format "Xh YY" ou "X:YY" en heures décimales
 * Ex: "7h45" → 7.75, "8h00" → 8, "7:30" → 7.5
 */
export function parseHours(timeStr: string): number {
  // Format "Xh YY" ou "XhYY"
  const hMatch = timeStr.match(/^(-?)(\d+)h\s?(\d{1,2})$/);
  if (hMatch) {
    const sign = hMatch[1] === '-' ? -1 : 1;
    const hours = parseInt(hMatch[2], 10);
    const minutes = parseInt(hMatch[3], 10);
    return sign * (hours + minutes / 60);
  }

  // Format "HH:MM"
  const colonMatch = timeStr.match(/^(-?)(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const sign = colonMatch[1] === '-' ? -1 : 1;
    const hours = parseInt(colonMatch[2], 10);
    const minutes = parseInt(colonMatch[3], 10);
    return sign * (hours + minutes / 60);
  }

  // Format décimal simple
  const num = parseFloat(timeStr);
  if (!isNaN(num)) return num;

  return 0;
}

/**
 * Arrondit au quart d'heure le plus proche
 * Ex: 7.83 → 7.75 (7h45), 8.1 → 8.0 (8h00)
 */
export function roundToQuarterHour(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/**
 * Calcule la durée entre deux horaires "HH:MM" en heures décimales
 * Gère le passage de minuit (ex: 22:00 → 06:00 = 8h)
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  let durationMinutes = endMinutes - startMinutes;
  if (durationMinutes < 0) {
    // Passage de minuit
    durationMinutes += 24 * 60;
  }

  return durationMinutes / 60;
}

/**
 * Calcule les heures effectives (durée totale - pause)
 */
export function calculateEffectiveHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const totalHours = calculateDuration(startTime, endTime);
  const breakHours = breakMinutes / 60;
  return Math.max(0, totalHours - breakHours);
}

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
  const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Vérifie si un horaire est dans une plage
 */
export function isTimeInRange(time: string, rangeStart: string, rangeEnd: string): boolean {
  const t = timeToMinutes(time);
  const start = timeToMinutes(rangeStart);
  const end = timeToMinutes(rangeEnd);

  if (start <= end) {
    return t >= start && t <= end;
  }
  // Passage de minuit
  return t >= start || t <= end;
}

/**
 * Formate des heures décimales en format compact pour le planning
 * Ex: 7.75 → "7h45", -1.5 → "-1h30"
 */
export function formatHoursCompact(decimalHours: number): string {
  if (decimalHours === 0) return '—';
  return formatHours(decimalHours);
}

/**
 * Calcule le pourcentage d'heures travaillées vs contractuelles
 */
export function hoursPercentage(worked: number, contractual: number): number {
  if (contractual === 0) return 0;
  return Math.round((worked / contractual) * 100);
}
