/**
 * Types pour le module Gardes Pharmacie
 *
 * Obligations légales françaises :
 *  - Seuls les pharmaciens diplômés (titulaire, adjoint) assurent les gardes
 *  - Rotation équitable obligatoire
 *  - Types : nuit, dimanche, jour férié
 */

// ─── Type de garde ───

export type GardeType = 'nuit' | 'dimanche' | 'ferie';

export type GardeStatut = 'planifie' | 'confirme' | 'effectue' | 'annule';

// ─── Garde individuelle (future persistance DB) ───

export interface Garde {
  id: string;
  date: string;
  pharmacien_id: string;
  type: GardeType;
  heure_debut: string;
  heure_fin: string;
  statut: GardeStatut;
  notes: string | null;
  organization_id: string;
}

// ─── Assignment de garde (résultat de la rotation) ───

export interface GardeAssignment {
  /** Date YYYY-MM-DD */
  date: string;
  /** Nom du jour en français */
  dayName: string;
  /** Type de garde */
  type: GardeType;
  /** ID du pharmacien assigné */
  pharmacienId: string;
  /** Nom complet du pharmacien */
  pharmacienName: string;
  /** Heure de début HH:MM */
  heureDebut: string;
  /** Heure de fin HH:MM */
  heureFin: string;
  /** Y a-t-il un conflit non résolu ? */
  hasConflict: boolean;
  /** Description du conflit */
  conflictReason: string | null;
}

// ─── Statistiques par pharmacien ───

export interface PharmacienStats {
  pharmacienId: string;
  pharmacienName: string;
  totalGardes: number;
  gardesNuit: number;
  gardesDimanche: number;
  gardesFerie: number;
  lastGardeDate: string | null;
  nextGardeDate: string | null;
}

// ─── Conflit détecté ───

export type ConflictType = 'conge' | 'planning' | 'autre_garde';

export interface GardeConflict {
  date: string;
  pharmacienId: string;
  pharmacienName: string;
  type: ConflictType;
  description: string;
}

// ─── Configuration de la rotation ───

export interface RotationConfig {
  /** Date de début de la période (YYYY-MM-DD) */
  startDate: string;
  /** Date de fin de la période (YYYY-MM-DD) */
  endDate: string;
  /** Inclure les dimanches */
  includeDimanches: boolean;
  /** Inclure les gardes de nuit */
  includeNuits: boolean;
  /** Inclure les jours fériés */
  includeFeries: boolean;
  /** Heure de début des gardes de nuit */
  heureDebutNuit: string;
  /** Heure de fin des gardes de nuit */
  heureFinNuit: string;
  /** Heure de début des gardes dimanche/férié */
  heureDebutDimanche: string;
  /** Heure de fin des gardes dimanche/férié */
  heureFinDimanche: string;
}

// ─── Labels ───

export const GARDE_TYPE_LABELS: Record<GardeType, string> = {
  nuit: 'Nuit',
  dimanche: 'Dimanche',
  ferie: 'Jour férié',
};

export const GARDE_STATUT_LABELS: Record<GardeStatut, string> = {
  planifie: 'Planifié',
  confirme: 'Confirmé',
  effectue: 'Effectué',
  annule: 'Annulé',
};

// ─── Jours fériés français 2025-2027 ───

export const JOURS_FERIES: string[] = [
  // 2025
  '2025-01-01', // Jour de l'An
  '2025-04-21', // Lundi de Pâques
  '2025-05-01', // Fête du Travail
  '2025-05-08', // Victoire 1945
  '2025-05-29', // Ascension
  '2025-06-09', // Lundi de Pentecôte
  '2025-07-14', // Fête Nationale
  '2025-08-15', // Assomption
  '2025-11-01', // Toussaint
  '2025-11-11', // Armistice
  '2025-12-25', // Noël
  // 2026
  '2026-01-01',
  '2026-04-06', // Lundi de Pâques
  '2026-05-01',
  '2026-05-08',
  '2026-05-14', // Ascension
  '2026-05-25', // Lundi de Pentecôte
  '2026-07-14',
  '2026-08-15',
  '2026-11-01',
  '2026-11-11',
  '2026-12-25',
  // 2027
  '2027-01-01',
  '2027-03-29', // Lundi de Pâques
  '2027-05-01',
  '2027-05-08',
  '2027-05-06', // Ascension
  '2027-05-17', // Lundi de Pentecôte
  '2027-07-14',
  '2027-08-15',
  '2027-11-01',
  '2027-11-11',
  '2027-12-25',
];
