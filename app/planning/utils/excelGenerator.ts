/**
 * excelGenerator — Genere un fichier Excel du planning semaine
 *
 * Export simple tableau : employe | jour | creneaux | heures
 * Utilise xlsx (SheetJS).
 *
 * Conventions : pas d'emojis, ASCII uniquement.
 */
import * as XLSX from 'xlsx';
import type { Shift, Employee, EmployeeCategory } from '@/lib/types';

// --- Constants ---

const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

const ROLE_LABELS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: 'Pharmacien Titulaire',
  pharmacien_adjoint: 'Pharmacien Adjoint',
  preparateur: 'Preparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti',
  etudiant: 'Etudiant',
};

const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// --- Helpers ---

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function shiftEffectiveHours(shift: Shift): number {
  const startMin = timeToMinutes(shift.start_time);
  const endMin = timeToMinutes(shift.end_time);
  const totalMin = endMin - startMin - (shift.break_duration || 0);
  return Math.max(0, totalMin / 60);
}

function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].filter(e => e.is_active).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.last_name.localeCompare(b.last_name);
  });
}

function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES_SHORT[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function formatHoursDecimal(h: number): string {
  return h.toFixed(1);
}

// --- Excel Generation ---

export function downloadPlanningExcel(
  weekDates: string[], // 7 ISO dates (Lun-Dim)
  shifts: Shift[],
  employees: Employee[]
) {
  const sorted = sortEmployees(employees);

  // Build header row
  const header = [
    'Employe',
    'Role',
    ...weekDates.slice(0, 6).map(d => formatDayLabel(d)), // Lun-Sam
    'Total semaine (h)',
  ];

  // Build data rows
  const dataRows: (string | number)[][] = [];

  for (const emp of sorted) {
    const row: (string | number)[] = [
      `${emp.first_name} ${emp.last_name}`,
      ROLE_LABELS[emp.category] || emp.category,
    ];

    let weekTotal = 0;

    // For each day Mon-Sat
    for (let i = 0; i < 6; i++) {
      const date = weekDates[i];
      const dayShifts = shifts.filter(s => s.employee_id === emp.id && s.date === date);

      if (dayShifts.length === 0) {
        row.push('-');
      } else {
        const creneaux = dayShifts.map(s => `${s.start_time}-${s.end_time}`).join(' | ');
        const dayHours = dayShifts.reduce((sum, s) => sum + shiftEffectiveHours(s), 0);
        weekTotal += dayHours;
        row.push(`${creneaux} (${formatHoursDecimal(dayHours)}h)`);
      }
    }

    row.push(parseFloat(formatHoursDecimal(weekTotal)));
    dataRows.push(row);
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Employe
    { wch: 18 },  // Role
    { wch: 25 },  // Lun
    { wch: 25 },  // Mar
    { wch: 25 },  // Mer
    { wch: 25 },  // Jeu
    { wch: 25 },  // Ven
    { wch: 25 },  // Sam
    { wch: 15 },  // Total
  ];

  const weekLabel = weekDates[0] ? `Sem_${weekDates[0]}` : 'Planning';
  XLSX.utils.book_append_sheet(wb, ws, weekLabel.slice(0, 31));

  // Download
  const fileName = `planning-${weekDates[0]?.replace(/-/g, '') || 'semaine'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
