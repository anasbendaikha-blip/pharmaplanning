/**
 * Utilitaires de gestion des dates pour PharmaPlanning
 * Convention : semaine commence le lundi (ISO 8601)
 */

const DAYS_FR = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche',
] as const;

const DAYS_SHORT_FR = [
  'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim',
] as const;

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

/**
 * Retourne le lundi de la semaine contenant la date donnée
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay() : 0=dimanche, 1=lundi, ...
  // On veut : 0=lundi, 1=mardi, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Retourne les 7 dates de la semaine (lundi à dimanche)
 */
export function getWeekDates(mondayDate: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Formate une date en format français
 * @param format - 'short' (06/02), 'medium' (6 fév.), 'long' (Jeudi 6 Février 2026), 'iso' (2026-02-06)
 */
export function formatDate(date: Date, format: 'short' | 'medium' | 'long' | 'iso' = 'medium'): string {
  switch (format) {
    case 'short':
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'medium': {
      const monthShort = MONTHS_FR[date.getMonth()].substring(0, 3).toLowerCase();
      return `${date.getDate()} ${monthShort}.`;
    }
    case 'long': {
      const dayOfWeek = getDayOfWeekFr(date);
      return `${dayOfWeek} ${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
    }
    case 'iso':
      return toISODateString(date);
  }
}

/**
 * Convertit une Date en string ISO sans timezone (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse une date ISO (YYYY-MM-DD) en Date locale
 */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Retourne le nom du jour en français (index 0 = lundi)
 */
export function getDayOfWeekFr(date: Date): string {
  const jsDay = date.getDay(); // 0=dim, 1=lun, ...
  const isoDay = jsDay === 0 ? 6 : jsDay - 1; // 0=lun, 6=dim
  return DAYS_FR[isoDay];
}

/**
 * Retourne le nom court du jour en français
 */
export function getDayShortFr(date: Date): string {
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 6 : jsDay - 1;
  return DAYS_SHORT_FR[isoDay];
}

/**
 * Retourne le nom du mois en français
 */
export function getMonthFr(date: Date): string {
  return MONTHS_FR[date.getMonth()];
}

/**
 * Vérifie si deux dates sont le même jour
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Ajoute des jours à une date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Retourne le numéro de semaine ISO
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Vérifie si la date est aujourd'hui
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Retourne le libellé de la semaine : "Semaine 6 - 3 au 9 Février 2026"
 */
export function getWeekLabel(mondayDate: Date): string {
  const weekNum = getISOWeekNumber(mondayDate);
  const sunday = addDays(mondayDate, 6);
  const startMonth = MONTHS_FR[mondayDate.getMonth()];
  const endMonth = MONTHS_FR[sunday.getMonth()];

  if (mondayDate.getMonth() === sunday.getMonth()) {
    return `Semaine ${weekNum} — ${mondayDate.getDate()} au ${sunday.getDate()} ${endMonth} ${sunday.getFullYear()}`;
  }
  return `Semaine ${weekNum} — ${mondayDate.getDate()} ${startMonth} au ${sunday.getDate()} ${endMonth} ${sunday.getFullYear()}`;
}
