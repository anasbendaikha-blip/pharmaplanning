/**
 * Types liés aux employés - Multi-tenant
 * Chaque employé est lié à une organization_id
 */

import { EmployeeCategory } from './organization';

export interface Employee {
  id: string;
  /** CRITICAL: Isolation multi-tenant */
  organization_id: string;
  /** Prénom */
  first_name: string;
  /** Nom de famille */
  last_name: string;
  /** Email professionnel */
  email: string;
  /** Téléphone */
  phone: string | null;
  /** Catégorie professionnelle */
  category: EmployeeCategory;
  /** Rôle dans l'application */
  role: EmployeeRole;
  /** Heures contractuelles hebdomadaires */
  contract_hours: number;
  /** Type de contrat */
  contract_type: ContractType;
  /** Date de début du contrat */
  contract_start_date: string;
  /** Date de fin du contrat (null si CDI) */
  contract_end_date: string | null;
  /** Couleur d'affichage dans le planning */
  display_color: string;
  /** Matricule interne */
  employee_number: string | null;
  /** Actif dans le planning */
  is_active: boolean;
  /** Disponibilités récurrentes (contraintes personnelles) */
  availabilities: Availability[];
  /** Compétences spécifiques (ex: gestion stock, vaccination) */
  skills: string[];
  /** Préférences d'horaires */
  preferences: EmployeePreferences;
  /** Lien vers le user Supabase Auth (si le portail employé est activé) */
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeRole = 'titulaire' | 'adjoint' | 'preparateur' | 'rayonniste' | 'apprenti' | 'etudiant';

export type ContractType = 'CDI' | 'CDD' | 'alternance' | 'stage' | 'interim';

export interface Availability {
  id: string;
  employee_id: string;
  organization_id: string;
  /** Jour de la semaine (0 = lundi, 6 = dimanche) */
  day_of_week: number;
  /** Type de disponibilité */
  type: AvailabilityType;
  /** Heure de début (format "HH:MM") - requis si type = 'partial' */
  start_time: string | null;
  /** Heure de fin (format "HH:MM") - requis si type = 'partial' */
  end_time: string | null;
  /** Raison (optionnel) */
  reason: string | null;
  /** Récurrent ou ponctuel */
  is_recurring: boolean;
  /** Date spécifique (si non récurrent) */
  specific_date: string | null;
}

export type AvailabilityType = 'available' | 'unavailable' | 'partial' | 'preferred';

export interface EmployeePreferences {
  /** Jours préférés de repos */
  preferred_days_off: number[];
  /** Préférence horaire */
  preferred_shift: 'morning' | 'afternoon' | 'flexible';
  /** Maximum d'heures souhaitées par jour */
  max_preferred_daily_hours: number | null;
  /** Notes libres */
  notes: string | null;
}

/** Résumé d'un employé pour l'affichage dans le planning */
export interface EmployeeSummary {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  category: EmployeeCategory;
  contract_hours: number;
  display_color: string;
  is_active: boolean;
}

/** Données d'un employé pour le récapitulatif hebdomadaire */
export interface EmployeeWeeklyStats {
  employee_id: string;
  employee: EmployeeSummary;
  /** Heures travaillées cette semaine */
  total_hours: number;
  /** Heures contractuelles */
  contract_hours: number;
  /** Différence (heures sup ou déficit) */
  hours_difference: number;
  /** Nombre de jours travaillés */
  days_worked: number;
  /** Repos hebdomadaire respecté */
  weekly_rest_valid: boolean;
  /** Conflits détectés */
  conflicts: string[];
}
