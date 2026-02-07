/**
 * Générateur de récapitulatif hebdomadaire
 *
 * Fonctions PURES : prennent des Shift[] et Employee[] typés depuis @/lib/types,
 * retournent des WeekSummary.
 *
 * Réutilise les utilitaires de dateUtils.ts existants :
 *  - getISOWeekNumber, getDayOfWeekFr, toISODateString, addDays, parseISODate
 */

import type { Shift, Employee } from '@/lib/types';
import type { WeekSummary, EmployeeWeekSummary, DailySummary, ShiftInfo } from './types';
import {
  getISOWeekNumber,
  getDayOfWeekFr,
  toISODateString,
  addDays,
  parseISODate,
} from '@/lib/utils/dateUtils';

// ─── Helpers internes ───

/** Nom complet d'un employé */
function fullName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`.trim();
}

/** Label lisible pour une catégorie */
const CATEGORY_LABELS: Record<string, string> = {
  pharmacien_titulaire: 'Pharmacien titulaire',
  pharmacien_adjoint: 'Pharmacien adjoint',
  preparateur: 'Préparateur',
  rayonniste: 'Conditionneur',
  apprenti: 'Apprenti',
  etudiant: 'Étudiant',
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

// ─── Génération du résumé semaine ───

/**
 * Génère un récapitulatif complet de la semaine.
 *
 * @param weekStartDate - Date du lundi (YYYY-MM-DD)
 * @param shifts - Tous les shifts de la semaine (déjà filtrés par getShiftsForWeek)
 * @param employees - Tous les employés actifs
 */
export function generateWeekSummary(
  weekStartDate: string,
  shifts: Shift[],
  employees: Employee[],
): WeekSummary {
  const monday = parseISODate(weekStartDate);
  const sunday = addDays(monday, 6);

  const weekNumber = getISOWeekNumber(monday);
  const year = monday.getFullYear();

  // Totaux
  const totalHours = shifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const totalShifts = shifts.length;
  const employeeIds = new Set(shifts.map(s => s.employee_id));

  // Index des employés
  const empMap = new Map<string, Employee>();
  for (const emp of employees) {
    empMap.set(emp.id, emp);
  }

  // Résumés employés
  const employeeSummaries = generateEmployeeSummaries(shifts, employees);

  // Résumés journaliers
  const dailySummaries = generateDailySummaries(monday, shifts, empMap);

  return {
    weekNumber,
    year,
    startDate: weekStartDate,
    endDate: toISODateString(sunday),
    totalHours: Math.round(totalHours * 10) / 10,
    totalShifts,
    employeeCount: employeeIds.size,
    employeeSummaries,
    dailySummaries,
  };
}

// ─── Résumés par employé ───

function generateEmployeeSummaries(
  shifts: Shift[],
  employees: Employee[],
): EmployeeWeekSummary[] {
  const summaries: EmployeeWeekSummary[] = [];

  // Grouper par employé
  const shiftsByEmp = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = shiftsByEmp.get(shift.employee_id) || [];
    existing.push(shift);
    shiftsByEmp.set(shift.employee_id, existing);
  }

  for (const emp of employees) {
    const empShifts = shiftsByEmp.get(emp.id);
    if (!empShifts || empShifts.length === 0) continue;

    const totalHours = empShifts.reduce((sum, s) => sum + s.effective_hours, 0);
    const roundedHours = Math.round(totalHours * 10) / 10;

    // Heures par jour
    const dailyHours: Record<string, number> = {};
    for (const shift of empShifts) {
      dailyHours[shift.date] = (dailyHours[shift.date] || 0) + shift.effective_hours;
    }
    // Arrondir chaque jour
    for (const date of Object.keys(dailyHours)) {
      dailyHours[date] = Math.round(dailyHours[date] * 10) / 10;
    }

    const weeklyTarget = emp.contract_hours || 35;
    const hoursDelta = Math.round((roundedHours - weeklyTarget) * 10) / 10;

    summaries.push({
      employeeId: emp.id,
      employeeName: fullName(emp),
      category: categoryLabel(emp.category),
      totalHours: roundedHours,
      shiftsCount: empShifts.length,
      dailyHours,
      isCompliant: totalHours <= 48,
      weeklyTarget,
      hoursDelta,
    });
  }

  // Trier par nom
  summaries.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'fr'));

  return summaries;
}

// ─── Résumés par jour ───

function generateDailySummaries(
  monday: Date,
  shifts: Shift[],
  empMap: Map<string, Employee>,
): DailySummary[] {
  const summaries: DailySummary[] = [];

  // Grouper par date
  const shiftsByDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = shiftsByDate.get(shift.date) || [];
    existing.push(shift);
    shiftsByDate.set(shift.date, existing);
  }

  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const dateStr = toISODateString(day);
    const dayShifts = shiftsByDate.get(dateStr) || [];

    // Transformer en ShiftInfo
    const shiftInfos: ShiftInfo[] = dayShifts.map(shift => {
      const emp = empMap.get(shift.employee_id);
      return {
        id: shift.id,
        employeeId: shift.employee_id,
        employeeName: emp ? fullName(emp) : 'Inconnu',
        category: emp ? categoryLabel(emp.category) : '',
        startTime: shift.start_time,
        endTime: shift.end_time,
        hours: Math.round(shift.effective_hours * 10) / 10,
      };
    });

    // Trier par heure de début
    shiftInfos.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const totalHours = dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);
    const employeeIds = new Set(dayShifts.map(s => s.employee_id));

    summaries.push({
      date: dateStr,
      dayName: getDayOfWeekFr(day),
      totalHours: Math.round(totalHours * 10) / 10,
      shiftsCount: dayShifts.length,
      employeesCount: employeeIds.size,
      shifts: shiftInfos,
    });
  }

  return summaries;
}
