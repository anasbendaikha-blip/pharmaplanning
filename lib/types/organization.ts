/**
 * Types liés aux organisations (pharmacies) - Multi-tenant
 */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  /** Adresse de la pharmacie */
  address: string;
  phone: string;
  email: string;
  /** URL du logo (optionnel, pour le branding multi-tenant) */
  logo_url: string | null;
  /** Numéro FINESS de l'établissement */
  finess_number: string | null;
  /** Licence de la pharmacie */
  license_number: string | null;
  /** Paramètres spécifiques à la pharmacie */
  settings: OrganizationSettings;
  /** Abonnement actif */
  subscription_plan: SubscriptionPlan;
  subscription_status: 'active' | 'trial' | 'expired' | 'cancelled';
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  /** Horaires d'ouverture par jour (0 = lundi, 6 = dimanche) */
  opening_hours: WeeklyOpeningHours;
  /** Nombre minimum de pharmaciens requis pendant les heures d'ouverture */
  min_pharmacists_on_duty: number;
  /** Durée du repos hebdomadaire obligatoire en heures (défaut: 35) */
  weekly_rest_hours: number;
  /** Durée maximale de travail journalier en heures (défaut: 10) */
  max_daily_hours: number;
  /** Durée maximale de travail hebdomadaire en heures (défaut: 44) */
  max_weekly_hours: number;
  /** Catégories d'employés utilisées par cette pharmacie */
  employee_categories: EmployeeCategory[];
  /** Convention collective applicable */
  collective_agreement: string;
  /** Fuseau horaire */
  timezone: string;
  /** Premier jour de la semaine (1 = lundi) */
  week_start_day: number;
  /** Format d'affichage des heures (24h) */
  time_format: '24h' | '12h';
}

export interface WeeklyOpeningHours {
  /** 0 = lundi, 1 = mardi, ..., 6 = dimanche */
  [dayIndex: number]: DayOpeningHours;
}

export interface DayOpeningHours {
  /** Pharmacie ouverte ce jour */
  is_open: boolean;
  /** Créneaux d'ouverture (ex: matin + après-midi si pause méridienne) */
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string; // Format "HH:MM"
  end: string;   // Format "HH:MM"
}

export type EmployeeCategory =
  | 'pharmacien_titulaire'
  | 'pharmacien_adjoint'
  | 'preparateur'
  | 'rayonniste'
  | 'apprenti'
  | 'etudiant';

export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';

export interface UserOrganization {
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  organization?: Organization;
}

export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'employee';
