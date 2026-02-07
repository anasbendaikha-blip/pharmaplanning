/**
 * Types liés au planning - Multi-tenant
 * Gestion des shifts, planning hebdomadaire et conflits
 */

import { EmployeeSummary } from './employee';

export interface Shift {
  id: string;
  /** CRITICAL: Isolation multi-tenant */
  organization_id: string;
  /** Employé assigné */
  employee_id: string;
  /** Date du shift (format YYYY-MM-DD) */
  date: string;
  /** Heure de début (format "HH:MM") */
  start_time: string;
  /** Heure de fin (format "HH:MM") */
  end_time: string;
  /** Durée de la pause en minutes */
  break_duration: number;
  /** Durée effective en heures (sans pause) */
  effective_hours: number;
  /** Type de shift */
  type: ShiftType;
  /** Statut du shift */
  status: ShiftStatus;
  /** Notes / commentaires */
  notes: string | null;
  /** Créé par (user_id) */
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ShiftType =
  | 'regular'       // Journée normale
  | 'morning'       // Matin uniquement
  | 'afternoon'     // Après-midi uniquement
  | 'split'         // Journée coupée (matin + après-midi avec pause longue)
  | 'garde'         // Garde (dimanche/jour férié)
  | 'astreinte'     // Astreinte
  | 'formation'     // Formation
  | 'conge'         // Congé
  | 'maladie'       // Arrêt maladie
  | 'rtt';          // RTT

export type ShiftStatus =
  | 'draft'         // Brouillon (en cours de planification)
  | 'published'     // Publié (visible par les employés)
  | 'confirmed'     // Confirmé par l'employé
  | 'modified'      // Modifié après publication
  | 'cancelled';    // Annulé

/** Planning hebdomadaire complet */
export interface WeeklyPlanning {
  organization_id: string;
  /** Date du lundi de la semaine */
  week_start: string;
  /** Tous les shifts de la semaine */
  shifts: Shift[];
  /** Employés impliqués */
  employees: EmployeeSummary[];
  /** Conflits détectés */
  conflicts: Conflict[];
  /** Statut global du planning */
  status: PlanningStatus;
  /** Statistiques de la semaine */
  stats: WeeklyPlanningStats;
}

export type PlanningStatus = 'draft' | 'in_progress' | 'validated' | 'published';

export interface WeeklyPlanningStats {
  /** Total d'heures planifiées */
  total_hours: number;
  /** Nombre d'employés planifiés */
  employees_count: number;
  /** Nombre de conflits */
  conflicts_count: number;
  /** Pourcentage de couverture pharmacien */
  pharmacist_coverage_percent: number;
  /** Coût estimé (optionnel) */
  estimated_cost: number | null;
}

/** Conflit détecté dans le planning */
export interface Conflict {
  id: string;
  organization_id: string;
  /** Type de conflit */
  type: ConflictType;
  /** Sévérité */
  severity: ConflictSeverity;
  /** Employé(s) concerné(s) */
  employee_ids: string[];
  /** Shift(s) concerné(s) */
  shift_ids: string[];
  /** Description lisible du conflit */
  message: string;
  /** Date concernée */
  date: string;
  /** Conflit résolu */
  is_resolved: boolean;
  /** Comment le conflit a été résolu */
  resolution: string | null;
}

export type ConflictType =
  | 'daily_limit_exceeded'        // Dépassement 10h journalières
  | 'weekly_limit_exceeded'       // Dépassement heures hebdomadaires
  | 'insufficient_rest'           // Repos < 35h non respecté
  | 'no_pharmacist_coverage'      // Pas de pharmacien titulaire/adjoint
  | 'overlap'                     // Chevauchement de shifts
  | 'availability_conflict'       // Conflit avec disponibilités
  | 'contract_hours_exceeded'     // Dépassement heures contractuelles
  | 'missing_break'               // Pause non respectée (>6h travail)
  | 'consecutive_days_exceeded';  // Trop de jours consécutifs

export type ConflictSeverity =
  | 'error'    // Violation légale - DOIT être corrigé
  | 'warning'  // Recommandation forte
  | 'info';    // Information

/** Cellule du planning dans la grille Gantt */
export interface PlanningCell {
  employee_id: string;
  date: string;
  shifts: Shift[];
  /** Heures totales pour cette cellule */
  total_hours: number;
  /** Conflits sur cette cellule */
  has_conflict: boolean;
  conflict_severity: ConflictSeverity | null;
}

/** Template de shift réutilisable */
export interface ShiftTemplate {
  id: string;
  organization_id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_duration: number;
  type: ShiftType;
  /** Couleur d'affichage du template */
  color: string;
}
