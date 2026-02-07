/**
 * Générateur Excel — xlsx (SheetJS)
 *
 * Export récapitulatif hebdomadaire avec 2 feuilles :
 *  - Récapitulatif par employé
 *  - Détail par jour
 */

import * as XLSX from 'xlsx';
import type { WeekSummary } from '@/lib/recap/types';


export function exportRecapExcel(summary: WeekSummary, organizationName: string): void {
  const workbook = XLSX.utils.book_new();

  // ─── Feuille 1 : Récapitulatif par employé ───

  const summaryRows: (string | number)[][] = [
    ['Recapitulatif Hebdomadaire'],
    [organizationName],
    [],
    ['Semaine', summary.weekNumber, '', 'Annee', summary.year],
    ['Periode', `${summary.startDate} au ${summary.endDate}`],
    [],
    ['Total heures', summary.totalHours, '', 'Total shifts', summary.totalShifts, '', 'Employes actifs', summary.employeeCount],
    [],
    ['Employe', 'Categorie', 'Heures', 'Shifts', 'Objectif (h)', 'Ecart', 'Conforme'],
  ];

  for (const emp of summary.employeeSummaries) {
    summaryRows.push([
      emp.employeeName,
      emp.category,
      emp.totalHours,
      emp.shiftsCount,
      emp.weeklyTarget,
      emp.hoursDelta,
      emp.isCompliant ? 'Oui' : 'Non',
    ]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);

  // Largeur colonnes
  ws1['!cols'] = [
    { wch: 22 }, // Employe
    { wch: 22 }, // Categorie
    { wch: 10 }, // Heures
    { wch: 8 },  // Shifts
    { wch: 12 }, // Objectif
    { wch: 10 }, // Ecart
    { wch: 10 }, // Conforme
    { wch: 16 }, // (extra col for stats)
  ];

  XLSX.utils.book_append_sheet(workbook, ws1, 'Par Employe');

  // ─── Feuille 2 : Détail par jour ───

  const dailyRows: (string | number)[][] = [
    ['Detail par jour'],
    [],
    ['Date', 'Jour', 'Heures totales', 'Employes', 'Shifts'],
  ];

  for (const day of summary.dailySummaries) {
    dailyRows.push([
      day.date,
      day.dayName,
      day.totalHours,
      day.employeesCount,
      day.shiftsCount,
    ]);
  }

  dailyRows.push([]);
  dailyRows.push(['Detail des shifts']);
  dailyRows.push(['Date', 'Employe', 'Categorie', 'Horaires', 'Heures']);

  for (const day of summary.dailySummaries) {
    for (const shift of day.shifts) {
      dailyRows.push([
        day.date,
        shift.employeeName,
        shift.category,
        `${shift.startTime} - ${shift.endTime}`,
        shift.hours,
      ]);
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(dailyRows);
  ws2['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(workbook, ws2, 'Par Jour');

  // Télécharger
  XLSX.writeFile(workbook, `recap-semaine-${summary.weekNumber}-${summary.year}.xlsx`);
}
