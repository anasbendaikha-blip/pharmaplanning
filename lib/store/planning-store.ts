/**
 * Store Central Planning — localStorage + sync multi-tabs
 *
 * Gere :
 *  - PlanningSlots (assignations employe/jour/creneau)
 *  - HorairesFixes (horaires recurrents par employe)
 *  - Synchronisation entre onglets via CustomEvent + StorageEvent
 *
 * Convention : pas d'emojis, ASCII uniquement, prefix "ps-" pour les cles localStorage
 */

import type { Employee } from '@/lib/types';

// ─── Types ───

export type CreneauType = 'matin' | 'aprem';

export interface PlanningSlot {
  /** ID employe */
  employeeId: string;
  /** Date ISO "YYYY-MM-DD" */
  date: string;
  /** Creneau: matin ou aprem */
  creneau: CreneauType;
  /** Heure de debut "HH:MM" */
  startTime: string;
  /** Heure de fin "HH:MM" */
  endTime: string;
  /** Duree de pause en minutes */
  breakMinutes: number;
}

export interface HoraireFixeEntry {
  /** ID employe */
  employeeId: string;
  /** Jour de la semaine (0=Lun, 5=Sam) */
  dayOfWeek: number;
  /** Creneau: matin ou aprem */
  creneau: CreneauType;
  /** Heure de debut "HH:MM" */
  startTime: string;
  /** Heure de fin "HH:MM" */
  endTime: string;
  /** Duree de pause en minutes */
  breakMinutes: number;
  /** Actif ou non */
  isActive: boolean;
}

export interface PlanningStore {
  /** Semaine courante (date ISO du lundi) */
  weekStart: string;
  /** Slots du planning */
  slots: PlanningSlot[];
  /** Horaires fixes */
  horairesFixes: HoraireFixeEntry[];
  /** Version (pour detecter les changements) */
  version: number;
}

// ─── Cles localStorage ───

const LS_KEY_SLOTS = 'ps-planning-slots';
const LS_KEY_HORAIRES = 'ps-horaires-fixes';
const LS_KEY_VERSION = 'ps-store-version';

// ─── Evenement custom pour sync intra-tab ───

const STORE_CHANGED_EVENT = 'planning-store-changed';

// ─── Helpers ───

function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function getVersion(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(LS_KEY_VERSION) || '0');
}

function incrementVersion(): number {
  const v = getVersion() + 1;
  localStorage.setItem(LS_KEY_VERSION, String(v));
  return v;
}

/** Cle unique pour un slot */
function slotKey(employeeId: string, date: string, creneau: CreneauType): string {
  return `${employeeId}|${date}|${creneau}`;
}

// ─── CRUD Operations ───

/**
 * Charge tous les slots depuis localStorage
 */
export function loadSlots(): PlanningSlot[] {
  if (typeof window === 'undefined') return [];
  return safeJsonParse<PlanningSlot[]>(localStorage.getItem(LS_KEY_SLOTS), []);
}

/**
 * Sauvegarde les slots dans localStorage et notifie les autres tabs
 */
export function saveSlots(slots: PlanningSlot[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY_SLOTS, JSON.stringify(slots));
  incrementVersion();
  window.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, { detail: { type: 'slots' } }));
}

/**
 * Charge les horaires fixes depuis localStorage
 */
export function loadHorairesFixes(): HoraireFixeEntry[] {
  if (typeof window === 'undefined') return [];
  return safeJsonParse<HoraireFixeEntry[]>(localStorage.getItem(LS_KEY_HORAIRES), []);
}

/**
 * Sauvegarde les horaires fixes et notifie
 */
export function saveHorairesFixes(horaires: HoraireFixeEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY_HORAIRES, JSON.stringify(horaires));
  incrementVersion();
  window.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, { detail: { type: 'horaires' } }));
}

/**
 * Charge le store complet
 */
export function loadStore(): PlanningStore {
  return {
    weekStart: '',
    slots: loadSlots(),
    horairesFixes: loadHorairesFixes(),
    version: getVersion(),
  };
}

// ─── Slot CRUD ───

/**
 * Ajoute ou met a jour un slot
 * Si un slot existe deja pour cet employe/date/creneau, il est remplace
 */
export function upsertSlot(slot: PlanningSlot): PlanningSlot[] {
  const slots = loadSlots();
  const key = slotKey(slot.employeeId, slot.date, slot.creneau);
  const idx = slots.findIndex(s => slotKey(s.employeeId, s.date, s.creneau) === key);

  if (idx >= 0) {
    slots[idx] = slot;
  } else {
    slots.push(slot);
  }

  saveSlots(slots);
  return slots;
}

/**
 * Supprime un slot
 */
export function removeSlot(employeeId: string, date: string, creneau: CreneauType): PlanningSlot[] {
  const slots = loadSlots();
  const key = slotKey(employeeId, date, creneau);
  const filtered = slots.filter(s => slotKey(s.employeeId, s.date, s.creneau) !== key);
  saveSlots(filtered);
  return filtered;
}

/**
 * Toggle un slot : si existe, supprime ; sinon, cree avec les horaires par defaut
 */
export function toggleSlot(
  employeeId: string,
  date: string,
  creneau: CreneauType,
  defaults?: { startTime?: string; endTime?: string; breakMinutes?: number },
): PlanningSlot[] {
  const slots = loadSlots();
  const key = slotKey(employeeId, date, creneau);
  const exists = slots.findIndex(s => slotKey(s.employeeId, s.date, s.creneau) === key);

  if (exists >= 0) {
    return removeSlot(employeeId, date, creneau);
  }

  const defaultTimes = creneau === 'matin'
    ? { startTime: '08:30', endTime: '12:30', breakMinutes: 0 }
    : { startTime: '14:00', endTime: '19:30', breakMinutes: 0 };

  return upsertSlot({
    employeeId,
    date,
    creneau,
    startTime: defaults?.startTime || defaultTimes.startTime,
    endTime: defaults?.endTime || defaultTimes.endTime,
    breakMinutes: defaults?.breakMinutes ?? defaultTimes.breakMinutes,
  });
}

/**
 * Recupere les slots pour une semaine donnee (filtre par dates)
 */
export function getSlotsForWeek(weekDates: string[]): PlanningSlot[] {
  const slots = loadSlots();
  const dateSet = new Set(weekDates);
  return slots.filter(s => dateSet.has(s.date));
}

/**
 * Recupere les slots d'un employe pour une date
 */
export function getSlotsForEmployeeDate(employeeId: string, date: string): PlanningSlot[] {
  const slots = loadSlots();
  return slots.filter(s => s.employeeId === employeeId && s.date === date);
}

/**
 * Verifie si un slot existe
 */
export function hasSlot(employeeId: string, date: string, creneau: CreneauType): boolean {
  const slots = loadSlots();
  return slots.some(s => s.employeeId === employeeId && s.date === date && s.creneau === creneau);
}

// ─── Horaires Fixes CRUD ───

/**
 * Ajoute ou met a jour un horaire fixe
 */
export function upsertHoraireFixes(entry: HoraireFixeEntry): HoraireFixeEntry[] {
  const horaires = loadHorairesFixes();
  const idx = horaires.findIndex(
    h => h.employeeId === entry.employeeId && h.dayOfWeek === entry.dayOfWeek && h.creneau === entry.creneau,
  );

  if (idx >= 0) {
    horaires[idx] = entry;
  } else {
    horaires.push(entry);
  }

  saveHorairesFixes(horaires);
  return horaires;
}

/**
 * Supprime un horaire fixe
 */
export function removeHoraireFixes(employeeId: string, dayOfWeek: number, creneau: CreneauType): HoraireFixeEntry[] {
  const horaires = loadHorairesFixes();
  const filtered = horaires.filter(
    h => !(h.employeeId === employeeId && h.dayOfWeek === dayOfWeek && h.creneau === creneau),
  );
  saveHorairesFixes(filtered);
  return filtered;
}

/**
 * Recupere les horaires fixes d'un employe
 */
export function getHorairesForEmployee(employeeId: string): HoraireFixeEntry[] {
  const horaires = loadHorairesFixes();
  return horaires.filter(h => h.employeeId === employeeId && h.isActive);
}

/**
 * Genere les slots a partir des horaires fixes pour une semaine
 * Ne cree PAS les slots directement — retourne les slots a creer
 */
export function generateSlotsFromHorairesFixes(
  weekDates: string[],
  employees: Employee[],
): PlanningSlot[] {
  const horaires = loadHorairesFixes();
  const existingSlots = loadSlots();
  const slotsToCreate: PlanningSlot[] = [];

  const activeHoraires = horaires.filter(h => h.isActive);
  const activeEmployeeIds = new Set(employees.filter(e => e.is_active).map(e => e.id));

  for (const hf of activeHoraires) {
    // Verifier que l'employe est actif
    if (!activeEmployeeIds.has(hf.employeeId)) continue;

    // day_of_week 0=Lun -> weekDates[0], 5=Sam -> weekDates[5]
    if (hf.dayOfWeek < 0 || hf.dayOfWeek > 5) continue;
    const dateStr = weekDates[hf.dayOfWeek];
    if (!dateStr) continue;

    // Verifier qu'un slot n'existe pas deja
    const key = slotKey(hf.employeeId, dateStr, hf.creneau);
    const alreadyExists = existingSlots.some(
      s => slotKey(s.employeeId, s.date, s.creneau) === key,
    );
    if (alreadyExists) continue;

    slotsToCreate.push({
      employeeId: hf.employeeId,
      date: dateStr,
      creneau: hf.creneau,
      startTime: hf.startTime,
      endTime: hf.endTime,
      breakMinutes: hf.breakMinutes,
    });
  }

  return slotsToCreate;
}

/**
 * Applique les horaires fixes : genere et sauvegarde les slots
 */
export function applyHorairesFixes(
  weekDates: string[],
  employees: Employee[],
): { created: number; skipped: number } {
  const slotsToCreate = generateSlotsFromHorairesFixes(weekDates, employees);
  if (slotsToCreate.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const slots = loadSlots();
  let created = 0;

  for (const newSlot of slotsToCreate) {
    const key = slotKey(newSlot.employeeId, newSlot.date, newSlot.creneau);
    const exists = slots.some(s => slotKey(s.employeeId, s.date, s.creneau) === key);
    if (!exists) {
      slots.push(newSlot);
      created++;
    }
  }

  saveSlots(slots);
  return { created, skipped: slotsToCreate.length - created };
}

// ─── Stats ───

/**
 * Calcule les heures d'un slot
 */
export function slotHours(slot: PlanningSlot): number {
  const [sh, sm] = slot.startTime.split(':').map(Number);
  const [eh, em] = slot.endTime.split(':').map(Number);
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - slot.breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

/**
 * Calcule les heures hebdomadaires d'un employe
 */
export function weeklyHoursForEmployee(employeeId: string, weekDates: string[]): number {
  const slots = getSlotsForWeek(weekDates);
  return slots
    .filter(s => s.employeeId === employeeId)
    .reduce((sum, s) => sum + slotHours(s), 0);
}

/**
 * Compte le nombre d'employes presents un jour donne
 */
export function countEmployeesForDate(date: string): number {
  const slots = loadSlots();
  const empIds = new Set(slots.filter(s => s.date === date).map(s => s.employeeId));
  return empIds.size;
}

// ─── Event Listener ───

/**
 * Ecoute les changements du store (intra-tab + inter-tab)
 * Retourne une fonction de cleanup
 */
export function onStoreChange(callback: () => void): () => void {
  // Intra-tab : CustomEvent
  const handleCustom = () => callback();
  window.addEventListener(STORE_CHANGED_EVENT, handleCustom);

  // Inter-tab : StorageEvent
  const handleStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY_SLOTS || e.key === LS_KEY_HORAIRES || e.key === LS_KEY_VERSION) {
      callback();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(STORE_CHANGED_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

// ─── Reset ───

/**
 * Efface tout le store (slots + horaires fixes)
 */
export function clearStore(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_KEY_SLOTS);
  localStorage.removeItem(LS_KEY_HORAIRES);
  localStorage.removeItem(LS_KEY_VERSION);
  window.dispatchEvent(new CustomEvent(STORE_CHANGED_EVENT, { detail: { type: 'clear' } }));
}

/**
 * Efface les slots d'une semaine
 */
export function clearWeekSlots(weekDates: string[]): PlanningSlot[] {
  const slots = loadSlots();
  const dateSet = new Set(weekDates);
  const remaining = slots.filter(s => !dateSet.has(s.date));
  saveSlots(remaining);
  return remaining;
}
