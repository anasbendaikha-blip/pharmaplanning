/**
 * Types pour le Quick Assign Panel (Planning V2 Phase 3)
 * Panel de création rapide de shift depuis une disponibilité
 */

import type { Employee } from './employee';
import type { Shift } from './planning';
import type { Disponibilite } from './disponibilite';
import type { SlotSuggestion } from '@/lib/time-utils';

/**
 * Props du QuickAssignPanel
 */
export interface QuickAssignPanelProps {
  /** Employé ciblé */
  employee: Employee;
  /** Date du créneau (YYYY-MM-DD) */
  date: string;
  /** Disponibilité sélectionnée */
  dispo: Disponibilite;
  /** Shifts existants de l'employé pour cette date */
  existingShifts: Shift[];
  /** Callback quand le panel confirme un nouveau shift */
  onConfirm: (shift: {
    employee_id: string;
    date: string;
    start_time: string;
    end_time: string;
    break_duration: number;
    type: Shift['type'];
  }) => void;
  /** Callback quand le panel est fermé */
  onClose: () => void;
}

/**
 * Créneau suggéré dans le panel
 */
export interface SuggestedSlot {
  id: string;
  label: string;
  icon: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  /** Créneau sélectionnable ? (false si chevauchement) */
  is_valid: boolean;
  /** Message si non valide */
  invalid_reason?: string;
}

/**
 * État interne du QuickAssignPanel
 */
export interface QuickAssignState {
  /** Créneau de début sélectionné */
  start_time: string;
  /** Créneau de fin sélectionné */
  end_time: string;
  /** Durée de pause en minutes */
  break_duration: number;
  /** Type de shift */
  shift_type: Shift['type'];
  /** Mode de saisie actif : suggestion ou manuel */
  input_mode: 'suggestion' | 'manual';
  /** ID de la suggestion sélectionnée */
  selected_suggestion: string | null;
  /** Résultat de validation */
  validation: ValidationResult;
  /** Suggestion de pause affichée */
  show_pause_suggestion: boolean;
}

/**
 * Résultat de validation d'un créneau
 */
export interface ValidationResult {
  /** Créneau valide ? */
  is_valid: boolean;
  /** Erreurs bloquantes */
  errors: ValidationMessage[];
  /** Avertissements non bloquants */
  warnings: ValidationMessage[];
}

/**
 * Message de validation individuel
 */
export interface ValidationMessage {
  /** Code du message */
  code: string;
  /** Message lisible */
  message: string;
  /** Icône */
  icon: string;
}

/**
 * Données passées au QuickAssignPanel quand on clique sur un CTA
 */
export interface QuickAssignTarget {
  employee: Employee;
  date: string;
  dispo: Disponibilite;
}
