/**
 * pdfGenerator — Genere un PDF du planning semaine
 *
 * Format : 2 pages, 3 jours par page (Lun-Mer, Jeu-Sam).
 * Chaque bloc = jour complet avec employes + creneaux + legende.
 * Utilise jsPDF + jspdf-autotable.
 *
 * Conventions : pas d'emojis, ASCII uniquement.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Shift, Employee, EmployeeCategory } from '@/lib/types';

// --- Constants ---

const ROLE_COLORS: Record<EmployeeCategory, [number, number, number]> = {
  pharmacien_titulaire: [220, 38, 38],
  pharmacien_adjoint: [234, 88, 12],
  preparateur: [22, 163, 74],
  rayonniste: [245, 158, 11],
  apprenti: [124, 58, 237],
  etudiant: [37, 99, 235],
};

const ROLE_LABELS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: 'Ph. Titulaire',
  pharmacien_adjoint: 'Ph. Adjoint',
  preparateur: 'Preparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti',
  etudiant: 'Etudiant',
};

const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTH_NAMES = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

// --- Helpers ---

function formatDateTitle(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()].toUpperCase()} ${d} ${MONTH_NAMES[m - 1].toUpperCase()} ${y}`;
}

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

function formatHoursCompact(h: number): string {
  if (h === 0) return '0h';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h${String(mins).padStart(2, '0')}`;
}

// --- PDF Generation ---

export function generatePlanningPDF(
  weekDates: string[], // 7 ISO dates (Lun-Dim)
  shifts: Shift[],
  employees: Employee[],
  pharmacyName: string = 'Pharmacie des Coquelicots'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const sorted = sortEmployees(employees);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Page 1 : Lun, Mar, Mer (indices 0, 1, 2)
  renderDayBlocks(doc, weekDates.slice(0, 3), shifts, sorted, margin, pageWidth, pageHeight, pharmacyName);

  // Page 2 : Jeu, Ven, Sam (indices 3, 4, 5)
  doc.addPage();
  renderDayBlocks(doc, weekDates.slice(3, 6), shifts, sorted, margin, pageWidth, pageHeight, pharmacyName);

  return doc;
}

function renderDayBlocks(
  doc: jsPDF,
  dates: string[],
  shifts: Shift[],
  employees: Employee[],
  margin: number,
  pageWidth: number,
  pageHeight: number,
  pharmacyName: string
) {
  // Header
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(pharmacyName, margin, margin);
  doc.text('Planning hebdomadaire', pageWidth - margin, margin, { align: 'right' });

  const usableHeight = pageHeight - margin * 2 - 10; // 10mm for header
  const blockHeight = Math.floor(usableHeight / 3) - 4; // 3 blocks with spacing
  let startY = margin + 8;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const dayShifts = shifts.filter(s => s.date === date);

    renderDayBlock(doc, date, dayShifts, employees, margin, pageWidth, startY, blockHeight);
    startY += blockHeight + 4;
  }

  // Legend at bottom
  renderLegend(doc, margin, pageHeight - margin - 2, pageWidth);
}

function renderDayBlock(
  doc: jsPDF,
  date: string,
  dayShifts: Shift[],
  employees: Employee[],
  marginX: number,
  pageWidth: number,
  startY: number,
  blockHeight: number
) {
  const title = formatDateTitle(date);
  const blockWidth = pageWidth - marginX * 2;

  // Title bar
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, startY, blockWidth, 7, 'F');
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text(title, marginX + 3, startY + 5);

  // Table data
  const tableStartY = startY + 8;
  const rows: (string | { content: string; styles: Record<string, unknown> })[][] = [];

  for (const emp of employees) {
    const empShifts = dayShifts.filter(s => s.employee_id === emp.id);
    const [r, g, b] = ROLE_COLORS[emp.category] || [100, 100, 100];

    const name = `${emp.first_name} ${emp.last_name.charAt(0)}.`;
    const shiftsText = empShifts.length > 0
      ? empShifts.map(s => `${s.start_time}-${s.end_time}`).join(' | ')
      : '-';
    const hoursText = empShifts.length > 0
      ? formatHoursCompact(empShifts.reduce((sum, s) => sum + shiftEffectiveHours(s), 0))
      : '-';
    const pauseText = empShifts
      .filter(s => s.break_duration > 0)
      .map(s => `${s.break_duration}min`)
      .join(', ') || '-';

    rows.push([
      { content: name, styles: { textColor: [r, g, b] as unknown as string } },
      shiftsText,
      hoursText,
      pauseText,
    ]);
  }

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginX, right: marginX },
    head: [['Employe', 'Creneaux', 'Heures', 'Pause']],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineWidth: 0.1,
      lineColor: [220, 220, 220],
    },
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
    },
    tableWidth: blockWidth,
  });
}

function renderLegend(doc: jsPDF, x: number, y: number, pageWidth: number) {
  doc.setFontSize(7);
  doc.setTextColor(120);
  let currentX = x;

  const items = [
    { label: 'Ph. Titulaire', color: ROLE_COLORS.pharmacien_titulaire },
    { label: 'Ph. Adjoint', color: ROLE_COLORS.pharmacien_adjoint },
    { label: 'Preparateur', color: ROLE_COLORS.preparateur },
    { label: 'Apprenti', color: ROLE_COLORS.apprenti },
    { label: 'Etudiant', color: ROLE_COLORS.etudiant },
  ];

  for (const item of items) {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(currentX + 2, y, 1.5, 'F');
    doc.text(item.label, currentX + 5, y + 1);
    currentX += 35;
  }
}

export function downloadPlanningPDF(
  weekDates: string[],
  shifts: Shift[],
  employees: Employee[],
  pharmacyName?: string
) {
  const doc = generatePlanningPDF(weekDates, shifts, employees, pharmacyName);
  const weekLabel = weekDates[0]?.replace(/-/g, '') || 'semaine';
  doc.save(`planning-${weekLabel}.pdf`);
}
