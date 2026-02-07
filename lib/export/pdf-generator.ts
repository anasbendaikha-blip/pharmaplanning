/**
 * Générateur PDF — jsPDF + jspdf-autotable
 *
 * 3 exports :
 *  - exportRecapPDF     : récap hebdomadaire
 *  - exportGardesPDF    : planning gardes du mois
 *  - exportAssistantPDF : planning généré par l'assistant
 *
 * Toutes les fonctions déclenchent un téléchargement côté client.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WeekSummary } from '@/lib/recap/types';
import type { GardeAssignment } from '@/lib/gardes/types';
import { GARDE_TYPE_LABELS } from '@/lib/gardes/types';
import type { GeneratedSchedule, WizardConfig } from '@/lib/assistant/types';
import type { Employee } from '@/lib/types';
import { parseISODate, formatDate } from '@/lib/utils/dateUtils';
import { formatHours } from '@/lib/utils/hourUtils';

// ─── Helpers ───

const PRIMARY_RGB: [number, number, number] = [16, 185, 129];
const NEUTRAL_ALT_RGB: [number, number, number] = [248, 250, 252];

function headerBlock(doc: jsPDF, title: string, subtitle: string, orgName: string): number {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(orgName, 14, 28);
  doc.text(subtitle, 14, 34);
  doc.text(
    `Genere le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    14,
    40,
  );

  return 50; // y cursor après l'en-tête
}

// ─── 1. EXPORT RÉCAP HEBDOMADAIRE ───

export function exportRecapPDF(summary: WeekSummary, organizationName: string): void {
  const doc = new jsPDF();

  const y = headerBlock(
    doc,
    'Recapitulatif Hebdomadaire',
    `Semaine ${summary.weekNumber} — ${summary.startDate} au ${summary.endDate}`,
    organizationName,
  );

  // Stats globales
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiques globales', 14, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total heures : ${formatHours(summary.totalHours)}`, 14, y + 7);
  doc.text(`Total shifts : ${summary.totalShifts}`, 80, y + 7);
  doc.text(`Employes actifs : ${summary.employeeCount}`, 140, y + 7);

  // Tableau par employé
  const empRows = summary.employeeSummaries.map((emp) => [
    emp.employeeName,
    emp.category,
    formatHours(emp.totalHours),
    String(emp.shiftsCount),
    `${emp.weeklyTarget}h`,
    `${emp.hoursDelta > 0 ? '+' : ''}${formatHours(emp.hoursDelta)}`,
    emp.isCompliant ? 'Conforme' : '>48h',
  ]);

  autoTable(doc, {
    startY: y + 16,
    head: [['Employe', 'Categorie', 'Heures', 'Shifts', 'Objectif', 'Ecart', 'Statut']],
    body: empRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PRIMARY_RGB, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: NEUTRAL_ALT_RGB },
  });

  // Page 2 : détail par jour
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Detail par jour', 14, 20);

  let curY = 30;

  for (const day of summary.dailySummaries) {
    if (curY > 260) {
      doc.addPage();
      curY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const dateObj = parseISODate(day.date);
    doc.text(`${day.dayName} ${formatDate(dateObj, 'medium')}`, 14, curY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${formatHours(day.totalHours)} — ${day.employeesCount} employe${day.employeesCount !== 1 ? 's' : ''} — ${day.shiftsCount} shift${day.shiftsCount !== 1 ? 's' : ''}`,
      14,
      curY + 5,
    );

    curY += 12;

    if (day.shifts.length > 0) {
      for (const shift of day.shifts) {
        if (curY > 270) {
          doc.addPage();
          curY = 20;
        }
        doc.text(
          `  ${shift.startTime}-${shift.endTime}  ${shift.employeeName} (${shift.category}) — ${formatHours(shift.hours)}`,
          18,
          curY,
        );
        curY += 5;
      }
      curY += 3;
    } else {
      doc.text('  Aucun shift', 18, curY);
      curY += 8;
    }
  }

  doc.save(`recap-semaine-${summary.weekNumber}-${summary.year}.pdf`);
}

// ─── 2. EXPORT GARDES ───

export function exportGardesPDF(
  gardes: GardeAssignment[],
  month: number,
  year: number,
  organizationName: string,
): void {
  const doc = new jsPDF();

  const MONTH_NAMES = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
  ];

  headerBlock(doc, 'Planning des Gardes', `${MONTH_NAMES[month]} ${year}`, organizationName);

  // Grouper par date
  const gardesByDate = new Map<string, GardeAssignment[]>();
  for (const g of gardes) {
    const existing = gardesByDate.get(g.date) || [];
    existing.push(g);
    gardesByDate.set(g.date, existing);
  }

  const rows: (string | number)[][] = [];
  const sortedDates = [...gardesByDate.keys()].sort();

  for (const date of sortedDates) {
    const dayGardes = gardesByDate.get(date) || [];
    const dateObj = parseISODate(date);
    const dateStr = formatDate(dateObj, 'long');

    dayGardes.forEach((garde, idx) => {
      rows.push([
        idx === 0 ? dateStr : '',
        GARDE_TYPE_LABELS[garde.type],
        `${garde.heureDebut} - ${garde.heureFin}`,
        garde.pharmacienName,
        garde.hasConflict ? (garde.conflictReason || 'Conflit') : '',
      ]);
    });
  }

  if (rows.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Aucune garde planifiee pour ${MONTH_NAMES[month]} ${year}`, 14, 55);
  } else {
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Type', 'Horaires', 'Pharmacien', 'Conflit']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 45 },
        4: { cellWidth: 30 },
      },
    });
  }

  doc.save(`gardes-${MONTH_NAMES[month].toLowerCase()}-${year}.pdf`);
}

// ─── 3. EXPORT ASSISTANT PLANNING ───

export function exportAssistantPDF(
  schedule: GeneratedSchedule,
  config: WizardConfig,
  organizationName: string,
  employees?: Employee[],
): void {
  const doc = new jsPDF();

  // Map employeeId → nom complet
  const nameMap = new Map<string, string>();
  if (employees) {
    for (const emp of employees) {
      nameMap.set(emp.id, `${emp.first_name} ${emp.last_name}`);
    }
  }

  headerBlock(
    doc,
    'Planning Genere — Assistant',
    `Periode : ${config.startDate} au ${config.endDate}`,
    organizationName,
  );

  // Stats
  let y = 50;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiques', 14, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total shifts : ${schedule.stats.totalShifts}`, 14, y);
  doc.text(`Total heures : ${schedule.stats.totalHours}h`, 80, y);
  y += 6;
  doc.text(`Couverture : ${schedule.stats.coverageRate}%`, 14, y);
  doc.text(`Conformite : ${schedule.stats.legalCompliance}%`, 80, y);
  y += 6;
  doc.text(`Equilibrage : +/-${schedule.stats.balanceScore}h`, 14, y);

  // Conflits
  if (schedule.conflicts.length > 0) {
    y += 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Conflits detectes (${schedule.conflicts.length})`, 14, y);

    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const maxConflicts = Math.min(schedule.conflicts.length, 15);
    for (let i = 0; i < maxConflicts; i++) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const c = schedule.conflicts[i];
      const prefix = c.type === 'error' ? '[ERR]' : c.type === 'warning' ? '[AVERT]' : '[INFO]';
      doc.text(`${prefix} ${c.message}`, 14, y);
      y += 5;
    }
  }

  // Tableau des shifts groupés par date
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Planning detaille', 14, 20);

  // Grouper par date
  const shiftsByDate = new Map<string, typeof schedule.shifts>();
  for (const s of schedule.shifts) {
    const arr = shiftsByDate.get(s.date) || [];
    arr.push(s);
    shiftsByDate.set(s.date, arr);
  }

  const rows: (string | number)[][] = [];
  const sortedDates = [...shiftsByDate.keys()].sort();

  for (const date of sortedDates) {
    const dayShifts = shiftsByDate.get(date) || [];
    const dateObj = parseISODate(date);
    const dateStr = formatDate(dateObj, 'long');

    dayShifts.forEach((shift, idx) => {
      rows.push([
        idx === 0 ? dateStr : '',
        `${shift.startTime} - ${shift.endTime}`,
        nameMap.get(shift.employeeId) || shift.employeeId.slice(0, 8),
        `${shift.hours}h`,
      ]);
    });
  }

  autoTable(doc, {
    startY: 30,
    head: [['Date', 'Horaires', 'Employe', 'Heures']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PRIMARY_RGB, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: NEUTRAL_ALT_RGB },
  });

  doc.save(`planning-${config.startDate}-${config.endDate}.pdf`);
}
