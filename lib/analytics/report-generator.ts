/**
 * Report Generator — Analytics PDF & Excel exports
 *
 * Utilise jsPDF + jspdf-autotable et xlsx (deja installes).
 * Declenchement cote client (telechargement direct).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { AnalyticsDashboard, AnalyticsPeriodRange } from './types';

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

  return 50;
}

function formatPeriod(period: AnalyticsPeriodRange): string {
  return `${period.start} au ${period.end}`;
}

// ─── PDF Export ───

export function exportAnalyticsPDF(
  dashboard: AnalyticsDashboard,
  organizationName: string,
): void {
  const doc = new jsPDF();

  let y = headerBlock(
    doc,
    'Rapport Analytics',
    `Periode: ${formatPeriod(dashboard.period)}`,
    organizationName,
  );

  // ─── KPIs Section ───
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Indicateurs cles (KPIs)', 14, y);
  y += 4;

  const kpiRows = [
    [
      dashboard.kpis.totalHours.label,
      `${dashboard.kpis.totalHours.value} ${dashboard.kpis.totalHours.unit}`,
      `${dashboard.kpis.totalHours.trendValue}%`,
      dashboard.kpis.totalHours.trend === 'up' ? '↑' : dashboard.kpis.totalHours.trend === 'down' ? '↓' : '→',
    ],
    [
      dashboard.kpis.totalShifts.label,
      `${dashboard.kpis.totalShifts.value}`,
      `${dashboard.kpis.totalShifts.trendValue}%`,
      dashboard.kpis.totalShifts.trend === 'up' ? '↑' : dashboard.kpis.totalShifts.trend === 'down' ? '↓' : '→',
    ],
    [
      dashboard.kpis.averageHoursPerEmployee.label,
      `${dashboard.kpis.averageHoursPerEmployee.value} ${dashboard.kpis.averageHoursPerEmployee.unit}`,
      `${dashboard.kpis.averageHoursPerEmployee.trendValue}%`,
      dashboard.kpis.averageHoursPerEmployee.trend === 'up' ? '↑' : dashboard.kpis.averageHoursPerEmployee.trend === 'down' ? '↓' : '→',
    ],
    [
      dashboard.kpis.overtimeHours.label,
      `${dashboard.kpis.overtimeHours.value} ${dashboard.kpis.overtimeHours.unit}`,
      `${dashboard.kpis.overtimeHours.trendValue}%`,
      dashboard.kpis.overtimeHours.trend === 'up' ? '↑' : dashboard.kpis.overtimeHours.trend === 'down' ? '↓' : '→',
    ],
    [
      dashboard.kpis.leaveDays.label,
      `${dashboard.kpis.leaveDays.value} ${dashboard.kpis.leaveDays.unit}`,
      `${dashboard.kpis.leaveDays.trendValue}%`,
      dashboard.kpis.leaveDays.trend === 'up' ? '↑' : dashboard.kpis.leaveDays.trend === 'down' ? '↓' : '→',
    ],
    [
      dashboard.kpis.complianceRate.label,
      `${dashboard.kpis.complianceRate.value} ${dashboard.kpis.complianceRate.unit}`,
      `${dashboard.kpis.complianceRate.trendValue}%`,
      dashboard.kpis.complianceRate.trend === 'up' ? '↑' : dashboard.kpis.complianceRate.trend === 'down' ? '↓' : '→',
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur', 'Variation', 'Tendance']],
    body: kpiRows,
    headStyles: { fillColor: PRIMARY_RGB, fontSize: 9 },
    alternateRowStyles: { fillColor: NEUTRAL_ALT_RGB },
    styles: { fontSize: 9 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // ─── Top employees ───
  if (dashboard.topEmployees.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Top employes par heures', 14, y);
    y += 4;

    const empRows = dashboard.topEmployees.map((e) => [
      e.employeeName,
      e.role,
      `${e.totalHours}h`,
      `${e.shiftsCount}`,
      `${e.overtime}h`,
      `${e.leaveDays}j`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Employe', 'Role', 'Heures', 'Shifts', 'H. Sup.', 'Conges']],
      body: empRows,
      headStyles: { fillColor: PRIMARY_RGB, fontSize: 9 },
      alternateRowStyles: { fillColor: NEUTRAL_ALT_RGB },
      styles: { fontSize: 9 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ─── Predictions ───
  if (dashboard.predictions.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Predictions & Recommandations', 14, y);
    y += 4;

    const predRows = dashboard.predictions.map((p) => [
      p.type === 'alert' ? '⚠' : p.type === 'recommendation' ? '💡' : '📈',
      p.title,
      p.description,
      `${p.confidence}%`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['', 'Titre', 'Description', 'Confiance']],
      body: predRows,
      headStyles: { fillColor: PRIMARY_RGB, fontSize: 9 },
      alternateRowStyles: { fillColor: NEUTRAL_ALT_RGB },
      styles: { fontSize: 8, cellWidth: 'wrap' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 110 },
        3: { cellWidth: 20 },
      },
    });
  }

  doc.save(`analytics-${dashboard.period.start}-${dashboard.period.end}.pdf`);
}

// ─── Excel Export ───

export function exportAnalyticsExcel(
  dashboard: AnalyticsDashboard,
  organizationName: string,
): void {
  const workbook = XLSX.utils.book_new();

  // ─── Sheet 1: KPIs ───
  const kpiRows: (string | number)[][] = [
    ['Rapport Analytics'],
    [organizationName],
    [],
    ['Periode', `${dashboard.period.start} au ${dashboard.period.end}`],
    [],
    ['Indicateur', 'Valeur', 'Unite', 'Variation (%)', 'Tendance', 'Valeur precedente'],
    [
      dashboard.kpis.totalHours.label,
      dashboard.kpis.totalHours.value,
      dashboard.kpis.totalHours.unit,
      dashboard.kpis.totalHours.trendValue,
      dashboard.kpis.totalHours.trend,
      dashboard.kpis.totalHours.previousValue,
    ],
    [
      dashboard.kpis.totalShifts.label,
      dashboard.kpis.totalShifts.value,
      dashboard.kpis.totalShifts.unit,
      dashboard.kpis.totalShifts.trendValue,
      dashboard.kpis.totalShifts.trend,
      dashboard.kpis.totalShifts.previousValue,
    ],
    [
      dashboard.kpis.averageHoursPerEmployee.label,
      dashboard.kpis.averageHoursPerEmployee.value,
      dashboard.kpis.averageHoursPerEmployee.unit,
      dashboard.kpis.averageHoursPerEmployee.trendValue,
      dashboard.kpis.averageHoursPerEmployee.trend,
      dashboard.kpis.averageHoursPerEmployee.previousValue,
    ],
    [
      dashboard.kpis.overtimeHours.label,
      dashboard.kpis.overtimeHours.value,
      dashboard.kpis.overtimeHours.unit,
      dashboard.kpis.overtimeHours.trendValue,
      dashboard.kpis.overtimeHours.trend,
      dashboard.kpis.overtimeHours.previousValue,
    ],
    [
      dashboard.kpis.leaveDays.label,
      dashboard.kpis.leaveDays.value,
      dashboard.kpis.leaveDays.unit,
      dashboard.kpis.leaveDays.trendValue,
      dashboard.kpis.leaveDays.trend,
      dashboard.kpis.leaveDays.previousValue,
    ],
    [
      dashboard.kpis.complianceRate.label,
      dashboard.kpis.complianceRate.value,
      dashboard.kpis.complianceRate.unit,
      dashboard.kpis.complianceRate.trendValue,
      dashboard.kpis.complianceRate.trend,
      dashboard.kpis.complianceRate.previousValue,
    ],
  ];
  const kpiSheet = XLSX.utils.aoa_to_sheet(kpiRows);
  kpiSheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, kpiSheet, 'KPIs');

  // ─── Sheet 2: Employees ───
  const empHeader = ['Employe', 'Role', 'Heures totales', 'Heures contrat', 'Shifts', 'H. Sup.', 'Conges (j)', 'Conformite (%)'];
  const empRows = dashboard.charts.hoursPerEmployee.map((e) => [
    e.employeeName,
    e.role,
    e.totalHours,
    e.contractHours,
    e.shiftsCount,
    e.overtime,
    e.leaveDays,
    e.complianceRate,
  ]);
  const empSheet = XLSX.utils.aoa_to_sheet([empHeader, ...empRows]);
  empSheet['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, empSheet, 'Employes');

  // ─── Sheet 3: Hours per week ───
  const weekHeader = ['Semaine', 'Heures'];
  const weekRows = dashboard.charts.hoursPerWeek.map((d) => [d.label, d.value]);
  const weekSheet = XLSX.utils.aoa_to_sheet([weekHeader, ...weekRows]);
  XLSX.utils.book_append_sheet(workbook, weekSheet, 'Heures par semaine');

  // ─── Sheet 4: Predictions ───
  const predHeader = ['Type', 'Titre', 'Description', 'Confiance (%)'];
  const predRows = dashboard.predictions.map((p) => [p.type, p.title, p.description, p.confidence]);
  const predSheet = XLSX.utils.aoa_to_sheet([predHeader, ...predRows]);
  predSheet['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 60 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, predSheet, 'Predictions');

  XLSX.writeFile(workbook, `analytics-${dashboard.period.start}-${dashboard.period.end}.xlsx`);
}
