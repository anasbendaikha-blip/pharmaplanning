/**
 * Service Paramètres Pharmacie — Planning V2 Phase 6
 * Lecture / écriture / hook React pour la configuration pharmacie
 * V1 : localStorage — V2 : Supabase
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  PharmacieConfig,
  PharmacieInfo,
  HorairesConfig,
  PlanningRulesConfig,
  NotificationsConfig,
} from '@/lib/types/pharmacie-config';

const STORAGE_KEY = 'pharmaplanning-config';
const CONFIG_VERSION = '1.0';

// ═══════════════════════════════════════════════════════
// Valeurs par défaut
// ═══════════════════════════════════════════════════════

export const DEFAULT_PHARMACIE_INFO: PharmacieInfo = {
  nom: '',
  adresse: '',
  codePostal: '',
  ville: '',
  finess: '',
  rpps: '',
  telephone: '',
  email: '',
  titulaireNom: '',
  titulaireRpps: '',
  titulaireEmail: '',
  titulaireTelephone: '',
};

export const DEFAULT_HORAIRES_CONFIG: HorairesConfig = {
  ouverture: {
    0: { is_open: true, slots: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '19:00' }] }, // Lun
    1: { is_open: true, slots: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '19:00' }] }, // Mar
    2: { is_open: true, slots: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '19:00' }] }, // Mer
    3: { is_open: true, slots: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '19:00' }] }, // Jeu
    4: { is_open: true, slots: [{ start: '08:30', end: '12:30' }, { start: '13:30', end: '19:00' }] }, // Ven
    5: { is_open: true, slots: [{ start: '09:00', end: '17:00' }] }, // Sam (non-stop)
    6: { is_open: false, slots: [] }, // Dim
  },
  preOuvertureDebut: '08:00',
  preOuvertureFin: '08:30',
  gardeDebut: '19:00',
  gardeFin: '21:00',
  coupureDebut: '12:30',
  coupureFin: '13:30',
  timelineStart: 8,
  timelineEnd: 21,
};

export const DEFAULT_PLANNING_RULES: PlanningRulesConfig = {
  maxDailyHours: 10,
  minRestHoursWeekly: 35,
  minPharmacists: 1,
  breakRequired: true,
  breakDurationMinutes: 30,
  breakThresholdHours: 6,
  maxWeeklyHours: 44,
};

export const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  conflictsEnabled: true,
  leaveRequestsEnabled: true,
  planningChangesEnabled: true,
  notificationEmail: '',
  weeklyDigestEnabled: true,
  weeklyDigestDay: 4, // Vendredi
};

export function getDefaultConfig(): PharmacieConfig {
  return {
    pharmacie: { ...DEFAULT_PHARMACIE_INFO },
    horaires: JSON.parse(JSON.stringify(DEFAULT_HORAIRES_CONFIG)),
    planning: { ...DEFAULT_PLANNING_RULES },
    notifications: { ...DEFAULT_NOTIFICATIONS },
    _version: CONFIG_VERSION,
    _updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════
// Lecture / Écriture localStorage
// ═══════════════════════════════════════════════════════

/** Charge la configuration depuis localStorage */
export function loadPharmacieConfig(): PharmacieConfig {
  if (typeof window === 'undefined') return getDefaultConfig();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultConfig();

    const parsed = JSON.parse(raw) as Partial<PharmacieConfig>;

    // Merge avec les défauts pour garantir la structure complète
    const defaults = getDefaultConfig();
    return {
      pharmacie: { ...defaults.pharmacie, ...parsed.pharmacie },
      horaires: {
        ...defaults.horaires,
        ...parsed.horaires,
        ouverture: parsed.horaires?.ouverture || defaults.horaires.ouverture,
      },
      planning: { ...defaults.planning, ...parsed.planning },
      notifications: { ...defaults.notifications, ...parsed.notifications },
      _version: parsed._version || CONFIG_VERSION,
      _updatedAt: parsed._updatedAt || new Date().toISOString(),
    };
  } catch {
    return getDefaultConfig();
  }
}

/** Sauvegarde la configuration dans localStorage */
export function savePharmacieConfig(config: PharmacieConfig): void {
  if (typeof window === 'undefined') return;

  const toSave: PharmacieConfig = {
    ...config,
    _version: CONFIG_VERSION,
    _updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

/** Réinitialise aux valeurs par défaut */
export function resetPharmacieConfig(): PharmacieConfig {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return getDefaultConfig();
}

// ═══════════════════════════════════════════════════════
// Hook React
// ═══════════════════════════════════════════════════════

interface UsePharmacieConfigReturn {
  config: PharmacieConfig;
  updatePharmacie: (info: Partial<PharmacieInfo>) => void;
  updateHoraires: (horaires: Partial<HorairesConfig>) => void;
  updatePlanning: (rules: Partial<PlanningRulesConfig>) => void;
  updateNotifications: (notifs: Partial<NotificationsConfig>) => void;
  save: () => void;
  reset: () => void;
  hasChanges: boolean;
  isSaving: boolean;
  lastSaved: string | null;
}

export function usePharmacieConfig(): UsePharmacieConfigReturn {
  const [config, setConfig] = useState<PharmacieConfig>(getDefaultConfig);
  const [savedConfig, setSavedConfig] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    const loaded = loadPharmacieConfig();
    setConfig(loaded);
    setSavedConfig(JSON.stringify(loaded));
    if (loaded._updatedAt) {
      setLastSaved(loaded._updatedAt);
    }
  }, []);

  const hasChanges = JSON.stringify(config) !== savedConfig;

  const updatePharmacie = useCallback((info: Partial<PharmacieInfo>) => {
    setConfig(prev => ({
      ...prev,
      pharmacie: { ...prev.pharmacie, ...info },
    }));
  }, []);

  const updateHoraires = useCallback((horaires: Partial<HorairesConfig>) => {
    setConfig(prev => ({
      ...prev,
      horaires: { ...prev.horaires, ...horaires },
    }));
  }, []);

  const updatePlanning = useCallback((rules: Partial<PlanningRulesConfig>) => {
    setConfig(prev => ({
      ...prev,
      planning: { ...prev.planning, ...rules },
    }));
  }, []);

  const updateNotifications = useCallback((notifs: Partial<NotificationsConfig>) => {
    setConfig(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...notifs },
    }));
  }, []);

  const save = useCallback(() => {
    setIsSaving(true);
    // Simulate async save (will be Supabase in V2)
    setTimeout(() => {
      savePharmacieConfig(config);
      setSavedConfig(JSON.stringify(config));
      setLastSaved(new Date().toISOString());
      setIsSaving(false);
    }, 400);
  }, [config]);

  const reset = useCallback(() => {
    const defaults = resetPharmacieConfig();
    setConfig(defaults);
    setSavedConfig(JSON.stringify(defaults));
  }, []);

  return {
    config,
    updatePharmacie,
    updateHoraires,
    updatePlanning,
    updateNotifications,
    save,
    reset,
    hasChanges,
    isSaving,
    lastSaved,
  };
}
