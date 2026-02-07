/**
 * Types pour le module de validation des contraintes légales
 * Code du Travail français — Convention Collective de la Pharmacie d'Officine
 *
 * Règles principales :
 *  - Repos hebdomadaire : 35h consécutives minimum (24h + 11h quotidien)
 *  - Amplitude journalière : 10h maximum entre début et fin de journée
 *  - Durée hebdomadaire : 48h maximum (absolue)
 *  - Repos quotidien : 11h minimum entre deux journées
 *  - Pause obligatoire : 20 min pour 6h+ de travail continu
 */

import type { Employee } from '@/lib/types';

// ─── Sévérité des violations ───

export type ViolationSeverity = 'critical' | 'warning' | 'info';

// ─── Types de violations ───

export type ViolationType =
  | 'repos_hebdomadaire_35h'     // < 35h de repos consécutif hebdomadaire
  | 'amplitude_journaliere_10h'  // > 10h d'amplitude dans la journée
  | 'duree_hebdomadaire_48h'     // > 48h de travail sur 7 jours
  | 'repos_quotidien_11h'        // < 11h entre deux journées consécutives
  | 'pause_6h';                  // Pas de pause >= 20 min pour > 6h travail

// ─── Violation individuelle ───

export interface LegalViolation {
  /** Identifiant unique de la violation */
  id: string;
  /** Type de violation légale */
  type: ViolationType;
  /** Sévérité */
  severity: ViolationSeverity;
  /** ID de l'employé concerné */
  employeeId: string;
  /** Nom complet de l'employé (prénom + nom) */
  employeeName: string;
  /** Date ou période concernée (format YYYY-MM-DD ou description) */
  date: string;
  /** Description lisible de la violation */
  message: string;
  /** Valeur réelle mesurée (ex: "42h" pour une amplitude) */
  actualValue: string;
  /** Limite légale applicable */
  legalLimit: string;
  /** Shifts concernés */
  relatedShiftIds: string[];
}

// ─── Score de conformité ───

export interface ComplianceScore {
  /** Score global 0-100 */
  score: number;
  /** Label lisible du score */
  label: string;
  /** Couleur CSS variable associée */
  colorVar: string;
  /** Nombre total de violations */
  totalViolations: number;
  /** Violations par sévérité */
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  /** Violations par type */
  byType: Record<ViolationType, number>;
}

// ─── Conformité par employé ───

export interface EmployeeCompliance {
  /** Employé concerné */
  employee: Employee;
  /** Score individuel 0-100 */
  score: number;
  /** Violations de cet employé */
  violations: LegalViolation[];
  /** Résumé des heures hebdo */
  weeklyHours: number;
  /** Nombre de jours travaillés cette semaine */
  daysWorked: number;
}

// ─── Résultat complet de validation ───

export interface ComplianceReport {
  /** Période analysée */
  period: {
    start: string;
    end: string;
  };
  /** Score global */
  score: ComplianceScore;
  /** Toutes les violations détectées */
  violations: LegalViolation[];
  /** Conformité par employé */
  employeeCompliance: EmployeeCompliance[];
  /** Shifts analysés */
  shiftsAnalyzed: number;
  /** Employés analysés */
  employeesAnalyzed: number;
  /** Date de génération du rapport */
  generatedAt: string;
}

// ─── Labels et descriptions des types de violations ───

export const VIOLATION_LABELS: Record<ViolationType, string> = {
  repos_hebdomadaire_35h: 'Repos hebdomadaire insuffisant',
  amplitude_journaliere_10h: 'Amplitude journalière excessive',
  duree_hebdomadaire_48h: 'Durée hebdomadaire excessive',
  repos_quotidien_11h: 'Repos quotidien insuffisant',
  pause_6h: 'Pause obligatoire manquante',
};

export const VIOLATION_DESCRIPTIONS: Record<ViolationType, string> = {
  repos_hebdomadaire_35h: 'Le repos hebdomadaire doit être de 35 heures consécutives minimum (24h + 11h quotidien)',
  amplitude_journaliere_10h: "L'amplitude journalière (entre début premier shift et fin dernier shift) ne peut excéder 10 heures",
  duree_hebdomadaire_48h: 'La durée maximale de travail hebdomadaire ne peut excéder 48 heures',
  repos_quotidien_11h: 'Le repos entre deux journées de travail doit être de 11 heures minimum',
  pause_6h: 'Une pause de 20 minutes minimum est obligatoire au-delà de 6 heures de travail continu',
};

export const SEVERITY_LABELS: Record<ViolationSeverity, string> = {
  critical: 'Critique',
  warning: 'Avertissement',
  info: 'Information',
};

// ─── Constantes légales ───

export const LEGAL_LIMITS = {
  /** Repos hebdomadaire consécutif minimum en heures */
  WEEKLY_REST_HOURS: 35,
  /** Amplitude journalière maximale en heures */
  MAX_DAILY_AMPLITUDE_HOURS: 10,
  /** Durée hebdomadaire maximale en heures */
  MAX_WEEKLY_HOURS: 48,
  /** Repos quotidien minimum en heures */
  MIN_DAILY_REST_HOURS: 11,
  /** Seuil de travail continu nécessitant une pause (en heures) */
  CONTINUOUS_WORK_THRESHOLD_HOURS: 6,
  /** Durée minimale de la pause obligatoire (en minutes) */
  MIN_BREAK_MINUTES: 20,
} as const;

// ─── Helpers pour les shifts ───

/**
 * Convertit "HH:MM" → nombre de minutes depuis minuit
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convertit des minutes en format lisible "Xh YYmin"
 */
export function minutesToReadable(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

/**
 * Convertit des heures décimales en format lisible
 */
export function hoursToReadable(hours: number): string {
  return minutesToReadable(Math.round(hours * 60));
}
