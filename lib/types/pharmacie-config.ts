/**
 * Types pour les Paramètres Pharmacie — Planning V2 Phase 6
 * Configuration complète de la pharmacie, horaires, planning et notifications
 */

import type { WeeklyOpeningHours } from './organization';

/** Configuration complète de la pharmacie */
export interface PharmacieConfig {
  /** Informations générales */
  pharmacie: PharmacieInfo;
  /** Horaires d'ouverture et garde */
  horaires: HorairesConfig;
  /** Paramètres planning */
  planning: PlanningRulesConfig;
  /** Préférences de notifications */
  notifications: NotificationsConfig;
  /** Métadonnées */
  _version: string;
  _updatedAt: string;
}

/** Informations de la pharmacie */
export interface PharmacieInfo {
  /** Nom officiel */
  nom: string;
  /** Adresse complète */
  adresse: string;
  /** Code postal */
  codePostal: string;
  /** Ville */
  ville: string;
  /** Numéro FINESS */
  finess: string;
  /** Numéro RPPS de la pharmacie */
  rpps: string;
  /** Téléphone */
  telephone: string;
  /** Email */
  email: string;
  /** Titulaire — Nom complet */
  titulaireNom: string;
  /** Titulaire — RPPS personnel */
  titulaireRpps: string;
  /** Titulaire — Email */
  titulaireEmail: string;
  /** Titulaire — Téléphone */
  titulaireTelephone: string;
}

/** Configuration des horaires */
export interface HorairesConfig {
  /** Horaires d'ouverture par jour de la semaine */
  ouverture: WeeklyOpeningHours;
  /** Heure de début de la zone "pré-ouverture" (ex: "08:00") */
  preOuvertureDebut: string;
  /** Heure de fin de la zone "pré-ouverture" (= heure d'ouverture officielle, ex: "08:30") */
  preOuvertureFin: string;
  /** Heure de début de la garde pharmaceutique (ex: "20:30") */
  gardeDebut: string;
  /** Heure de fin de la garde pharmaceutique (ex: "22:00") */
  gardeFin: string;
  /** Heure de début de la timeline du planning */
  timelineStart: number;
  /** Heure de fin de la timeline du planning */
  timelineEnd: number;
}

/** Paramètres des règles planning */
export interface PlanningRulesConfig {
  /** Durée max d'une journée de travail (heures) */
  maxDailyHours: number;
  /** Repos hebdomadaire minimum (heures) */
  minRestHoursWeekly: number;
  /** Nombre minimum de pharmaciens en service */
  minPharmacists: number;
  /** Pause obligatoire si >6h de travail */
  breakRequired: boolean;
  /** Durée de la pause obligatoire (minutes) */
  breakDurationMinutes: number;
  /** Seuil de déclenchement pause (heures travaillées) */
  breakThresholdHours: number;
  /** Heures max hebdomadaires */
  maxWeeklyHours: number;
}

/** Configuration des notifications */
export interface NotificationsConfig {
  /** Notifier les conflits de planning */
  conflictsEnabled: boolean;
  /** Notifier les demandes de congés */
  leaveRequestsEnabled: boolean;
  /** Notifier les changements de planning */
  planningChangesEnabled: boolean;
  /** Email de notification */
  notificationEmail: string;
  /** Récapitulatif hebdomadaire */
  weeklyDigestEnabled: boolean;
  /** Jour d'envoi du récap (0=lundi, 6=dimanche) */
  weeklyDigestDay: number;
}
