/**
 * Types pour le système d'Horaires Fixes (Planning V2 Phase 5)
 * Permet de pré-remplir les shifts récurrents automatiquement
 */

import type { ShiftType } from './planning';

/** Un créneau horaire fixe récurrent pour un employé */
export interface HoraireFixes {
  id: string;
  /** ID de l'employé */
  employee_id: string;
  /** Jour de la semaine (0 = lundi, 5 = samedi, 6 = dimanche) */
  day_of_week: number;
  /** Heure de début "HH:MM" */
  start_time: string;
  /** Heure de fin "HH:MM" */
  end_time: string;
  /** Durée de pause en minutes */
  break_duration: number;
  /** Type de shift */
  shift_type: ShiftType;
  /** Semaines alternées (null = toutes les semaines) */
  alternate_weeks: 'even' | 'odd' | null;
  /** Actif ou désactivé */
  is_active: boolean;
  /** Label descriptif (ex: "Matin", "Journée complète") */
  label: string;
}

/** Configuration des horaires fixes pour l'auto-fill */
export interface HorairesFixesConfig {
  /** Activer l'auto-fill */
  enabled: boolean;
  /** Écraser les shifts existants */
  overwrite_existing: boolean;
  /** Appliquer uniquement les semaines paires/impaires */
  week_parity_filter: 'all' | 'even' | 'odd';
}

/** Résultat de la génération d'horaires fixes */
export interface HorairesFixesResult {
  /** Shifts à créer */
  shifts_to_create: Array<{
    employee_id: string;
    date: string;
    start_time: string;
    end_time: string;
    break_duration: number;
    shift_type: ShiftType;
    label: string;
  }>;
  /** Shifts ignorés (déjà existants) */
  skipped_count: number;
  /** Conflits détectés */
  conflict_count: number;
}
