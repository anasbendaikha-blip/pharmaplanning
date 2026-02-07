/**
 * Types pour le module Récapitulatif Hebdomadaire
 *
 * Utilisé par :
 *  - lib/recap/generator.ts  (génération des résumés)
 *  - app/titulaire/recap-hebdo/page.tsx  (page complète)
 *  - components/recap/WeekSummaryWidget.tsx  (widget dashboard)
 */

export interface WeekSummary {
  /** Numéro de semaine ISO */
  weekNumber: number;
  /** Année */
  year: number;
  /** Date de début (YYYY-MM-DD, lundi) */
  startDate: string;
  /** Date de fin (YYYY-MM-DD, dimanche) */
  endDate: string;
  /** Total des heures effectives */
  totalHours: number;
  /** Nombre total de shifts */
  totalShifts: number;
  /** Nombre d'employés ayant au moins 1 shift */
  employeeCount: number;
  /** Résumés par employé */
  employeeSummaries: EmployeeWeekSummary[];
  /** Résumés par jour */
  dailySummaries: DailySummary[];
}

export interface EmployeeWeekSummary {
  /** ID de l'employé */
  employeeId: string;
  /** Nom complet (prénom + nom) */
  employeeName: string;
  /** Catégorie (pharmacien_titulaire, preparateur, etc.) */
  category: string;
  /** Total d'heures effectives sur la semaine */
  totalHours: number;
  /** Nombre de shifts */
  shiftsCount: number;
  /** Heures par jour : date (YYYY-MM-DD) → heures */
  dailyHours: Record<string, number>;
  /** Conformité 48h hebdo */
  isCompliant: boolean;
  /** Heures contractuelles hebdomadaires */
  weeklyTarget: number;
  /** Écart par rapport à l'objectif (positif = surplus, négatif = déficit) */
  hoursDelta: number;
}

export interface DailySummary {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Nom du jour en français (Lundi, Mardi, etc.) */
  dayName: string;
  /** Total heures effectives */
  totalHours: number;
  /** Nombre de shifts */
  shiftsCount: number;
  /** Nombre d'employés distincts */
  employeesCount: number;
  /** Détail des shifts */
  shifts: ShiftInfo[];
}

export interface ShiftInfo {
  /** ID du shift */
  id: string;
  /** ID de l'employé */
  employeeId: string;
  /** Nom complet */
  employeeName: string;
  /** Catégorie */
  category: string;
  /** Heure de début (HH:MM) */
  startTime: string;
  /** Heure de fin (HH:MM) */
  endTime: string;
  /** Heures effectives */
  hours: number;
}

export interface ExportOptions {
  /** Format d'export */
  format: 'pdf' | 'excel';
  /** Inclure le résumé global */
  includeSummary: boolean;
  /** Inclure le détail par jour */
  includeDetails: boolean;
  /** Inclure les signatures (pour validation paie) */
  includeSignatures: boolean;
}
