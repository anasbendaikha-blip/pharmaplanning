/**
 * Service de gestion des disponibilités
 * Fournit les fonctions pour filtrer, analyser et enrichir les disponibilités
 */

import type { Disponibilite, DispoTimelineItem, Shift, Employee } from '@/lib/types';
import { timeToDecimal } from '@/lib/planning-config';

/**
 * Filtre les disponibilités pour un employé et une date
 */
export function getDisposForEmployeeDate(
  dispos: Disponibilite[],
  employeeId: string,
  date: string,
): Disponibilite[] {
  return dispos.filter(d => d.employee_id === employeeId && d.date === date && d.status === 'active');
}

/**
 * Filtre les disponibilités pour une date donnée
 */
export function getDisposForDate(
  dispos: Disponibilite[],
  date: string,
): Disponibilite[] {
  return dispos.filter(d => d.date === date && d.status === 'active');
}

/**
 * Vérifie si deux créneaux se chevauchent
 */
function timeSlotsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = timeToDecimal(aStart);
  const aE = timeToDecimal(aEnd);
  const bS = timeToDecimal(bStart);
  const bE = timeToDecimal(bEnd);
  return aS < bE && bS < aE;
}

/**
 * Calcule le chevauchement en heures entre deux créneaux
 */
function overlapHours(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const aS = timeToDecimal(aStart);
  const aE = timeToDecimal(aEnd);
  const bS = timeToDecimal(bStart);
  const bE = timeToDecimal(bEnd);

  const overlapStart = Math.max(aS, bS);
  const overlapEnd = Math.min(aE, bE);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Enrichit les disponibilités avec les informations d'utilisation
 * (chevauchement avec les shifts)
 */
export function enrichDisposWithUsage(
  dispos: Disponibilite[],
  shifts: Shift[],
  employeeId: string,
  date: string,
): DispoTimelineItem[] {
  const empDispos = getDisposForEmployeeDate(dispos, employeeId, date);
  const empShifts = shifts.filter(s =>
    s.employee_id === employeeId &&
    s.date === date &&
    (s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
  );

  return empDispos
    .filter(d => d.type !== 'unavailable')
    .map(d => {
      const dispoHours = timeToDecimal(d.end_time) - timeToDecimal(d.start_time);
      let usedHours = 0;

      for (const shift of empShifts) {
        usedHours += overlapHours(d.start_time, d.end_time, shift.start_time, shift.end_time);
      }

      const usagePercent = dispoHours > 0 ? Math.round((usedHours / dispoHours) * 100) : 0;

      return {
        id: d.id,
        employee_id: d.employee_id,
        start_time: d.start_time,
        end_time: d.end_time,
        type: d.type,
        is_used: usedHours > 0,
        usage_percent: usagePercent,
        note: d.note,
      };
    });
}

/**
 * Détermine l'indicateur de disponibilité d'un employé pour une date
 * @returns 'full' | 'partial' | 'unavailable' | 'none' | 'preferred'
 */
export function getDispoIndicator(
  dispos: Disponibilite[],
  employeeId: string,
  date: string,
): 'full' | 'partial' | 'unavailable' | 'none' | 'preferred' {
  const empDispos = getDisposForEmployeeDate(dispos, employeeId, date);

  if (empDispos.length === 0) return 'none';

  // Si une dispo couvre tout le créneau d'ouverture
  const hasUnavailable = empDispos.some(d => d.type === 'unavailable');
  if (hasUnavailable && empDispos.every(d => d.type === 'unavailable')) return 'unavailable';

  const hasPreferred = empDispos.some(d => d.type === 'preferred');
  const hasAvailable = empDispos.some(d => d.type === 'available');

  // Si disponible toute la journée (8h-19h30 au moins)
  const fullDay = empDispos.some(d => {
    const start = timeToDecimal(d.start_time);
    const end = timeToDecimal(d.end_time);
    return start <= 8.5 && end >= 19.5 && (d.type === 'available' || d.type === 'preferred');
  });

  if (fullDay) {
    return hasPreferred ? 'preferred' : 'full';
  }

  if (hasAvailable || hasPreferred) return 'partial';

  return 'none';
}

/**
 * Vérifie si un employé a des disponibilités pour au moins un jour de la semaine
 */
export function employeeHasDispos(
  dispos: Disponibilite[],
  employeeId: string,
  weekDates: string[],
): boolean {
  return weekDates.some(date => {
    const empDispos = getDisposForEmployeeDate(dispos, employeeId, date);
    return empDispos.some(d => d.type !== 'unavailable');
  });
}

/**
 * Obtient un résumé textuel de la dispo d'un employé pour un jour
 */
export function getDispoTooltip(
  dispos: Disponibilite[],
  employee: Employee,
  date: string,
): string {
  const empDispos = getDisposForEmployeeDate(dispos, employee.id, date);

  if (empDispos.length === 0) {
    return `${employee.first_name} ${employee.last_name} — Aucune disponibilité déclarée`;
  }

  const lines = [`${employee.first_name} ${employee.last_name}`];

  for (const d of empDispos) {
    const typeLabel =
      d.type === 'available' ? '✅ Disponible' :
      d.type === 'preferred' ? '⭐ Préféré' :
      d.type === 'unavailable' ? '❌ Indisponible' :
      '⏰ Partiel';

    const timeStr = `${d.start_time}–${d.end_time}`;
    const line = `${typeLabel} ${timeStr}${d.note ? ` (${d.note})` : ''}`;
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Détecte les disponibilités non utilisées pour un employé/date
 */
export function findUnusedDispos(
  dispos: Disponibilite[],
  shifts: Shift[],
  employeeId: string,
  date: string,
): Disponibilite[] {
  const empDispos = getDisposForEmployeeDate(dispos, employeeId, date)
    .filter(d => d.type !== 'unavailable');

  const empShifts = shifts.filter(s =>
    s.employee_id === employeeId &&
    s.date === date &&
    (s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
  );

  if (empShifts.length === 0) return empDispos;

  return empDispos.filter(d => {
    const hasOverlap = empShifts.some(s =>
      timeSlotsOverlap(d.start_time, d.end_time, s.start_time, s.end_time)
    );
    return !hasOverlap;
  });
}
