/**
 * Hook React pour le Planning Store
 *
 * Fournit un acces reactif au store central avec sync multi-tabs.
 * Chaque composant qui utilise ce hook se re-render automatiquement
 * quand le store change (meme depuis un autre onglet).
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Employee } from '@/lib/types';
import {
  loadSlots,
  loadHorairesFixes,
  saveSlots,
  saveHorairesFixes,
  toggleSlot,
  upsertSlot,
  removeSlot,
  getSlotsForWeek,
  getSlotsForEmployeeDate,
  hasSlot,
  upsertHoraireFixes,
  removeHoraireFixes,
  getHorairesForEmployee,
  generateSlotsFromHorairesFixes,
  applyHorairesFixes,
  slotHours,
  weeklyHoursForEmployee,
  countEmployeesForDate,
  clearStore,
  clearWeekSlots,
  onStoreChange,
  type PlanningSlot,
  type HoraireFixeEntry,
  type CreneauType,
} from '@/lib/store/planning-store';

interface UsePlanningStoreReturn {
  // ─── State ───
  slots: PlanningSlot[];
  horairesFixes: HoraireFixeEntry[];

  // ─── Slot Actions ───
  /** Toggle un slot (clic dans la grille) */
  toggle: (employeeId: string, date: string, creneau: CreneauType, defaults?: {
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
  }) => void;
  /** Ajoute ou met a jour un slot */
  upsert: (slot: PlanningSlot) => void;
  /** Supprime un slot */
  remove: (employeeId: string, date: string, creneau: CreneauType) => void;
  /** Verifie si un slot existe */
  has: (employeeId: string, date: string, creneau: CreneauType) => boolean;
  /** Recupere les slots d'un employe pour une date */
  getForEmployeeDate: (employeeId: string, date: string) => PlanningSlot[];
  /** Recupere les slots de la semaine */
  getForWeek: (weekDates: string[]) => PlanningSlot[];

  // ─── Horaires Fixes Actions ───
  /** Ajoute/met a jour un horaire fixe */
  upsertHoraire: (entry: HoraireFixeEntry) => void;
  /** Supprime un horaire fixe */
  removeHoraire: (employeeId: string, dayOfWeek: number, creneau: CreneauType) => void;
  /** Recupere les horaires d'un employe */
  getHoraires: (employeeId: string) => HoraireFixeEntry[];
  /** Genere les slots depuis les horaires fixes (preview) */
  previewFromHoraires: (weekDates: string[], employees: Employee[]) => PlanningSlot[];
  /** Applique les horaires fixes (cree les slots) */
  applyHoraires: (weekDates: string[], employees: Employee[]) => { created: number; skipped: number };

  // ─── Stats ───
  /** Heures d'un slot */
  hours: (slot: PlanningSlot) => number;
  /** Heures hebdomadaires d'un employe */
  weeklyHours: (employeeId: string, weekDates: string[]) => number;
  /** Nombre d'employes presents un jour */
  employeeCount: (date: string) => number;

  // ─── Admin ───
  /** Efface tout le store */
  clear: () => void;
  /** Efface les slots d'une semaine */
  clearWeek: (weekDates: string[]) => void;
  /** Remplace tous les slots (import) */
  replaceAllSlots: (slots: PlanningSlot[]) => void;
  /** Remplace tous les horaires fixes (import) */
  replaceAllHoraires: (horaires: HoraireFixeEntry[]) => void;
}

export function usePlanningStore(): UsePlanningStoreReturn {
  const [slots, setSlots] = useState<PlanningSlot[]>([]);
  const [horairesFixes, setHorairesFixes] = useState<HoraireFixeEntry[]>([]);

  // Charger les donnees au mount
  useEffect(() => {
    setSlots(loadSlots());
    setHorairesFixes(loadHorairesFixes());
  }, []);

  // Ecouter les changements (intra-tab + inter-tab)
  useEffect(() => {
    const cleanup = onStoreChange(() => {
      setSlots(loadSlots());
      setHorairesFixes(loadHorairesFixes());
    });
    return cleanup;
  }, []);

  // ─── Slot Actions ───

  const toggle = useCallback((
    employeeId: string,
    date: string,
    creneau: CreneauType,
    defaults?: { startTime?: string; endTime?: string; breakMinutes?: number },
  ) => {
    const updated = toggleSlot(employeeId, date, creneau, defaults);
    setSlots(updated);
  }, []);

  const upsert = useCallback((slot: PlanningSlot) => {
    const updated = upsertSlot(slot);
    setSlots(updated);
  }, []);

  const remove = useCallback((employeeId: string, date: string, creneau: CreneauType) => {
    const updated = removeSlot(employeeId, date, creneau);
    setSlots(updated);
  }, []);

  const has = useCallback((employeeId: string, date: string, creneau: CreneauType) => {
    return hasSlot(employeeId, date, creneau);
  }, []);

  const getForEmployeeDate = useCallback((employeeId: string, date: string) => {
    return getSlotsForEmployeeDate(employeeId, date);
  }, []);

  const getForWeek = useCallback((weekDates: string[]) => {
    return getSlotsForWeek(weekDates);
  }, []);

  // ─── Horaires Fixes Actions ───

  const upsertHoraireAction = useCallback((entry: HoraireFixeEntry) => {
    const updated = upsertHoraireFixes(entry);
    setHorairesFixes(updated);
  }, []);

  const removeHoraireAction = useCallback((employeeId: string, dayOfWeek: number, creneau: CreneauType) => {
    const updated = removeHoraireFixes(employeeId, dayOfWeek, creneau);
    setHorairesFixes(updated);
  }, []);

  const getHoraires = useCallback((employeeId: string) => {
    return getHorairesForEmployee(employeeId);
  }, []);

  const previewFromHoraires = useCallback((weekDates: string[], employees: Employee[]) => {
    return generateSlotsFromHorairesFixes(weekDates, employees);
  }, []);

  const applyHorairesAction = useCallback((weekDates: string[], employees: Employee[]) => {
    const result = applyHorairesFixes(weekDates, employees);
    setSlots(loadSlots());
    return result;
  }, []);

  // ─── Stats ───

  const hours = useCallback((slot: PlanningSlot) => {
    return slotHours(slot);
  }, []);

  const weeklyHours = useCallback((employeeId: string, weekDates: string[]) => {
    return weeklyHoursForEmployee(employeeId, weekDates);
  }, []);

  const employeeCount = useCallback((date: string) => {
    return countEmployeesForDate(date);
  }, []);

  // ─── Admin ───

  const clear = useCallback(() => {
    clearStore();
    setSlots([]);
    setHorairesFixes([]);
  }, []);

  const clearWeek = useCallback((weekDates: string[]) => {
    const remaining = clearWeekSlots(weekDates);
    setSlots(remaining);
  }, []);

  const replaceAllSlots = useCallback((newSlots: PlanningSlot[]) => {
    saveSlots(newSlots);
    setSlots(newSlots);
  }, []);

  const replaceAllHoraires = useCallback((newHoraires: HoraireFixeEntry[]) => {
    saveHorairesFixes(newHoraires);
    setHorairesFixes(newHoraires);
  }, []);

  return useMemo(() => ({
    // State
    slots,
    horairesFixes,
    // Slot Actions
    toggle,
    upsert,
    remove,
    has,
    getForEmployeeDate,
    getForWeek,
    // Horaires Fixes
    upsertHoraire: upsertHoraireAction,
    removeHoraire: removeHoraireAction,
    getHoraires,
    previewFromHoraires,
    applyHoraires: applyHorairesAction,
    // Stats
    hours,
    weeklyHours,
    employeeCount,
    // Admin
    clear,
    clearWeek,
    replaceAllSlots,
    replaceAllHoraires,
  }), [
    slots, horairesFixes,
    toggle, upsert, remove, has, getForEmployeeDate, getForWeek,
    upsertHoraireAction, removeHoraireAction, getHoraires, previewFromHoraires, applyHorairesAction,
    hours, weeklyHours, employeeCount,
    clear, clearWeek, replaceAllSlots, replaceAllHoraires,
  ]);
}
