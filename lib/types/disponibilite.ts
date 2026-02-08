/**
 * Types pour le système de disponibilités (Planning V2)
 * Les disponibilités représentent les créneaux où un employé EST disponible pour travailler
 */

import type { EmployeeCategory } from './organization';

/** Type de disponibilité */
export type DispoType =
  | 'available'     // Disponible sur tout le créneau
  | 'unavailable'   // Indisponible
  | 'preferred'     // Créneau préféré
  | 'partial';      // Disponible partiellement (heures spécifiques)

/** Statut de la disponibilité */
export type DispoStatus =
  | 'active'        // En vigueur
  | 'pending'       // En attente de validation
  | 'expired';      // Expirée

/** Disponibilité d'un employé pour un jour donné */
export interface Disponibilite {
  id: string;
  organization_id: string;
  employee_id: string;
  /** Date spécifique (format YYYY-MM-DD) */
  date: string;
  /** Type de disponibilité */
  type: DispoType;
  /** Heure de début de la disponibilité (format "HH:MM") */
  start_time: string;
  /** Heure de fin de la disponibilité (format "HH:MM") */
  end_time: string;
  /** Commentaire libre */
  note: string | null;
  /** Statut */
  status: DispoStatus;
  /** Récurrente (basée sur un pattern hebdomadaire) */
  is_recurring: boolean;
  /** Jour de la semaine si récurrente (0=lundi, 6=dimanche) */
  recurring_day: number | null;
  /** Créée le */
  created_at: string;
}

/** Alerte de disponibilité non utilisée */
export interface DispoAlert {
  id: string;
  employee_id: string;
  employee_name: string;
  category: EmployeeCategory;
  date: string;
  /** Créneau disponible non utilisé */
  dispo_start: string;
  dispo_end: string;
  /** Type d'alerte */
  alert_type: 'unused_dispo' | 'partial_use' | 'no_dispo';
  /** Message descriptif */
  message: string;
}

/** Statistiques des disponibilités pour une semaine */
export interface DispoStats {
  /** Nombre total de dispos déclarées */
  total_dispos: number;
  /** Nombre de dispos utilisées (chevauchement avec un shift) */
  used_dispos: number;
  /** Nombre de dispos non utilisées */
  unused_dispos: number;
  /** Taux d'utilisation (%) */
  usage_rate: number;
  /** Employés avec dispos */
  employees_with_dispos: number;
  /** Employés sans aucune dispo */
  employees_without_dispos: number;
  /** Alertes générées */
  alerts: DispoAlert[];
}

/** Résumé d'une dispo pour l'affichage dans la timeline */
export interface DispoTimelineItem {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  type: DispoType;
  /** Chevauchement avec un shift existant */
  is_used: boolean;
  /** Pourcentage utilisé (0-100) */
  usage_percent: number;
  note: string | null;
}
