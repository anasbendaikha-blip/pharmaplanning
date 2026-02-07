/**
 * Types liés aux gardes pharmaceutiques - Multi-tenant
 * Gardes de nuit, dimanche et jours fériés
 */

export interface GardeDuty {
  id: string;
  /** CRITICAL: Isolation multi-tenant */
  organization_id: string;
  /** Date de la garde (format YYYY-MM-DD) */
  date: string;
  /** Type de garde */
  type: GardeType;
  /** Statut de la garde */
  status: GardeStatus;
  /** Pharmacien(s) de garde */
  pharmacist_ids: string[];
  /** Employés supplémentaires assignés */
  staff_ids: string[];
  /** Heure de début */
  start_time: string;
  /** Heure de fin */
  end_time: string;
  /** Notes (ex: remplacement, situation spéciale) */
  notes: string | null;
  /** Validé par l'ARS / le conseil de l'ordre */
  is_validated: boolean;
  /** Numéro de tour de garde (dans le roulement) */
  rotation_number: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type GardeType =
  | 'nuit'          // Garde de nuit
  | 'dimanche'      // Garde du dimanche
  | 'jour_ferie'    // Garde jour férié
  | 'samedi_aprem'; // Garde samedi après-midi

export type GardeStatus =
  | 'planifiee'     // Planifiée
  | 'confirmee'     // Confirmée par le pharmacien
  | 'en_cours'      // En cours
  | 'terminee'      // Terminée
  | 'annulee';      // Annulée

/** Planning mensuel des gardes */
export interface MonthlyGardeSchedule {
  organization_id: string;
  /** Mois (format YYYY-MM) */
  month: string;
  /** Toutes les gardes du mois */
  gardes: GardeDuty[];
  /** Statistiques */
  stats: GardeStats;
}

export interface GardeStats {
  /** Nombre total de gardes dans le mois */
  total_gardes: number;
  /** Gardes confirmées */
  confirmed_count: number;
  /** Gardes en attente */
  pending_count: number;
  /** Répartition par pharmacien */
  distribution: GardeDistribution[];
}

export interface GardeDistribution {
  pharmacist_id: string;
  pharmacist_name: string;
  /** Nombre de gardes assignées */
  garde_count: number;
  /** Nombre de gardes ce trimestre */
  quarterly_count: number;
}

/** Jours fériés français */
export interface JourFerie {
  date: string;
  name: string;
  is_fixed: boolean; // Fixe ou mobile (Pâques, Ascension...)
}

/** Roulement de gardes entre pharmacies */
export interface GardeRotation {
  id: string;
  organization_id: string;
  /** Nom du groupe de roulement */
  group_name: string;
  /** Pharmacies dans le roulement */
  pharmacy_ids: string[];
  /** Fréquence (ex: toutes les 4 semaines) */
  frequency_weeks: number;
  /** Position dans le roulement */
  current_position: number;
}
