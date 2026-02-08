/**
 * Configuration centralisée du Planning V2
 * Contient toutes les constantes visuelles, zones, couleurs, etc.
 */

import type { EmployeeCategory } from '@/lib/types';

// ═══════════════════════════════════════════════════════
// Timeline
// ═══════════════════════════════════════════════════════

/** Heures de début/fin de la timeline */
export const TIMELINE_START = 8;
export const TIMELINE_END = 22;
export const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

/** Tick marks sur la timeline */
export const TIMELINE_TICKS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
export const TIMELINE_TICKS_COMPACT = [8, 12, 16, 20];

// ═══════════════════════════════════════════════════════
// Zones contextuelles
// ═══════════════════════════════════════════════════════

export interface PlanningZone {
  id: string;
  label: string;
  start: string;   // "HH:MM"
  end: string;      // "HH:MM"
  color: string;    // Couleur de fond
  borderColor: string;
  textColor: string;
  zIndex: number;
}

/** Zone d'ouverture — Créneau avant ouverture officielle */
export const ZONE_OUVERTURE: PlanningZone = {
  id: 'ouverture',
  label: 'Ouverture',
  start: '08:00',
  end: '08:30',
  color: 'rgba(34, 197, 94, 0.08)',     // green-500 @ 8%
  borderColor: 'rgba(34, 197, 94, 0.25)',
  textColor: '#16a34a',
  zIndex: 0,
};

/** Zone de garde — Créneau après fermeture */
export const ZONE_GARDE: PlanningZone = {
  id: 'garde',
  label: 'Garde',
  start: '20:30',
  end: '22:00',
  color: 'rgba(147, 51, 234, 0.06)',    // purple-600 @ 6%
  borderColor: 'rgba(147, 51, 234, 0.2)',
  textColor: '#9333ea',
  zIndex: 0,
};

/** Toutes les zones */
export const PLANNING_ZONES: PlanningZone[] = [ZONE_OUVERTURE, ZONE_GARDE];

// ═══════════════════════════════════════════════════════
// Couleurs
// ═══════════════════════════════════════════════════════

/** Couleurs des barres de shift (BaggPlanning style) */
export const COLORS = {
  /** Pharmaciens, préparateurs, rayonnistes */
  slot: '#6366f1',       // indigo-500
  /** Étudiants & apprentis */
  student: '#a78bfa',    // violet-400
  /** Congé/Maladie */
  leave: '#ef4444',      // red-500
  /** Pause */
  pause: '#f59e0b',      // amber-500
  /** Formation */
  formation: '#3b82f6',  // blue-500
  /** Garde */
  garde: '#ef4444',      // red-500
  /** Astreinte */
  astreinte: '#f59e0b',  // amber-500

  /** Disponibilité (layer) */
  dispoAvailable: 'rgba(34, 197, 94, 0.12)',      // green transparent
  dispoBorder: 'rgba(34, 197, 94, 0.35)',
  dispoUnavailable: 'rgba(239, 68, 68, 0.08)',    // red transparent
  dispoPreferred: 'rgba(59, 130, 246, 0.10)',      // blue transparent
} as const;

// ═══════════════════════════════════════════════════════
// Catégories d'employés
// ═══════════════════════════════════════════════════════

export interface CategoryConfig {
  label: string;
  labelShort: string;
  color: string;
  icon: string;
}

export const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

export const CATEGORY_CONFIG: Record<EmployeeCategory, CategoryConfig> = {
  pharmacien_titulaire: { label: 'Pharmaciens Titulaires', labelShort: 'Ph. Tit.', color: '#2563eb', icon: '💊' },
  pharmacien_adjoint: { label: 'Pharmaciens Adjoints', labelShort: 'Ph. Adj.', color: '#3b82f6', icon: '💊' },
  preparateur: { label: 'Préparateurs', labelShort: 'Prép.', color: '#10b981', icon: '⚗️' },
  rayonniste: { label: 'Rayonnistes', labelShort: 'Ray.', color: '#f59e0b', icon: '📦' },
  apprenti: { label: 'Apprentis', labelShort: 'App.', color: '#8b5cf6', icon: '🎓' },
  etudiant: { label: 'Étudiants', labelShort: 'Étud.', color: '#ec4899', icon: '📚' },
};

// ═══════════════════════════════════════════════════════
// Légende
// ═══════════════════════════════════════════════════════

export const LEGEND_ITEMS = [
  { color: COLORS.slot, label: 'Travail' },
  { color: COLORS.student, label: 'Étudiant' },
  { color: COLORS.pause, label: 'Pause' },
  { color: COLORS.leave, label: 'Congé' },
  { color: '#22c55e', label: 'Disponible' },
  { color: ZONE_GARDE.textColor, label: 'Garde' },
];

// ═══════════════════════════════════════════════════════
// Modes d'affichage
// ═══════════════════════════════════════════════════════

export type DisplayMode = 'normal' | 'semi-focus' | 'focus';

export interface DisplayConfig {
  showSidebar: boolean;
  showEmployeeColumn: boolean;
  showTimeline: boolean;
}

export const DISPLAY_MODES: Record<DisplayMode, DisplayConfig> = {
  normal: { showSidebar: true, showEmployeeColumn: true, showTimeline: true },
  'semi-focus': { showSidebar: false, showEmployeeColumn: true, showTimeline: true },
  focus: { showSidebar: false, showEmployeeColumn: false, showTimeline: true },
};

// ═══════════════════════════════════════════════════════
// Z-Index layers
// ═══════════════════════════════════════════════════════

export const Z_LAYERS = {
  zones: 0,
  disponibilites: 1,
  gridlines: 1,
  work: 2,
  pauses: 3,
  cta: 4,
  conges: 5,
  conflicts: 6,
  stickyHeader: 10,
} as const;

// ═══════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════

/** Convertit "HH:MM" en nombre décimal */
export function timeToDecimal(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

/** Convertit un time "HH:MM" en pourcentage de la timeline */
export function timeToPercent(time: string): number {
  const dec = timeToDecimal(time);
  return ((dec - TIMELINE_START) / TIMELINE_SPAN) * 100;
}

/** Obtient la position (left%, width%) d'un créneau dans la timeline */
export function getSlotPosition(startTime: string, endTime: string): { left: number; width: number } {
  const startDec = timeToDecimal(startTime);
  const endDec = timeToDecimal(endTime);

  const left = ((Math.max(startDec, TIMELINE_START) - TIMELINE_START) / TIMELINE_SPAN) * 100;
  const right = ((Math.min(endDec, TIMELINE_END) - TIMELINE_START) / TIMELINE_SPAN) * 100;
  const width = Math.max(right - left, 2);

  return { left, width };
}

/** Obtient la position d'une zone dans la timeline */
export function getZonePosition(zone: PlanningZone): { left: number; width: number } {
  return getSlotPosition(zone.start, zone.end);
}

/** Formate "HH:MM" → "8h30" ou "8h" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  return min === 0 ? `${hour}h` : `${hour}h${m}`;
}

/** Formate plage horaire "8h30–19h30" */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** Obtient les initiales (max 2 lettres) */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Détermine la couleur du slot selon la catégorie */
export function getSlotColor(category: EmployeeCategory): string {
  return (category === 'etudiant' || category === 'apprenti') ? COLORS.student : COLORS.slot;
}

// ═══════════════════════════════════════════════════════
// Dynamic config loader (from Paramètres Pharmacie)
// ═══════════════════════════════════════════════════════

/**
 * Charge les zones dynamiques depuis les paramètres pharmacie (localStorage)
 * Utilise les valeurs par défaut si non configuré ou côté serveur
 */
export function getDynamicPlanningZones(): PlanningZone[] {
  if (typeof window === 'undefined') return PLANNING_ZONES;

  try {
    const raw = localStorage.getItem('pharmaplanning-config');
    if (!raw) return PLANNING_ZONES;

    const cfg = JSON.parse(raw);
    const h = cfg?.horaires;
    if (!h) return PLANNING_ZONES;

    return [
      {
        ...ZONE_OUVERTURE,
        start: h.preOuvertureDebut || ZONE_OUVERTURE.start,
        end: h.preOuvertureFin || ZONE_OUVERTURE.end,
      },
      {
        ...ZONE_GARDE,
        start: h.gardeDebut || ZONE_GARDE.start,
        end: h.gardeFin || ZONE_GARDE.end,
      },
    ];
  } catch {
    return PLANNING_ZONES;
  }
}

/**
 * Obtient les paramètres timeline depuis la configuration pharmacie
 */
export function getDynamicTimeline(): { start: number; end: number; span: number } {
  if (typeof window === 'undefined') {
    return { start: TIMELINE_START, end: TIMELINE_END, span: TIMELINE_SPAN };
  }

  try {
    const raw = localStorage.getItem('pharmaplanning-config');
    if (!raw) return { start: TIMELINE_START, end: TIMELINE_END, span: TIMELINE_SPAN };

    const cfg = JSON.parse(raw);
    const h = cfg?.horaires;
    if (!h) return { start: TIMELINE_START, end: TIMELINE_END, span: TIMELINE_SPAN };

    const start = h.timelineStart ?? TIMELINE_START;
    const end = h.timelineEnd ?? TIMELINE_END;
    return { start, end, span: end - start };
  } catch {
    return { start: TIMELINE_START, end: TIMELINE_END, span: TIMELINE_SPAN };
  }
}
