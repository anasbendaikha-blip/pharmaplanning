/**
 * Données mock : shifts d'une semaine type pour la Pharmacie Isabelle MAURER
 *
 * Génère des shifts réalistes pour une semaine donnée.
 * Inclut volontairement quelques conflits pour démontrer la détection.
 */

import type { Shift, ShiftType } from '@/lib/types';
import { toISODateString, addDays } from '@/lib/utils/dateUtils';
import { calculateEffectiveHours } from '@/lib/utils/hourUtils';

const ORG_ID = 'org-pharmacie-maurer';

interface ShiftTemplate {
  employeeId: string;
  /** Jour de la semaine (0=lundi, 6=dimanche) */
  dayOffset: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  type: ShiftType;
}

/**
 * Planning type de la semaine (simplifié mais réaliste)
 * - Pharmacie ouverte Lun-Sam (8h30-19h30), fermée dimanche
 * - 2 shifts principaux : matin (8h30-13h00) et journée (8h30-19h30 avec pause)
 * - Inclut des conflits intentionnels pour la démo
 */
const SHIFT_TEMPLATES: ShiftTemplate[] = [
  // === PHARMACIENS TITULAIRES ===
  // Isabelle MAURER - Lun, Mar, Mer matin, Ven, Sam matin
  { employeeId: 'emp-001', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 2, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-001', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // François WEBER - Mar, Mer, Jeu, Sam
  { employeeId: 'emp-002', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 5, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // === PHARMACIENS ADJOINTS ===
  // Marie DUPONT - Lun, Mer, Jeu, Ven (⚠️ CONFLIT : 11h le jeudi → > 10h)
  { employeeId: 'emp-003', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-003', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-003', dayOffset: 3, startTime: '07:30', endTime: '19:30', breakMinutes: 60, type: 'regular' }, // 11h effectives = CONFLIT
  { employeeId: 'emp-003', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Claire BERNARD - Lun, Mar, Jeu, Sam
  { employeeId: 'emp-004', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Sophie LAURENT (28h) - Mar, Mer, Ven
  { employeeId: 'emp-005', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-005', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-005', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // Antoine MOREAU - Lun, Mer, Jeu, Ven, Sam matin
  { employeeId: 'emp-006', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-006', dayOffset: 2, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-006', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-006', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-006', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // === PRÉPARATEURS (12) - planning rotatif ===
  // Jean MARTIN
  { employeeId: 'emp-007', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-007', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-007', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-007', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Lucie PETIT
  { employeeId: 'emp-008', dayOffset: 0, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-008', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-008', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-008', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Pierre ROBERT
  { employeeId: 'emp-009', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-009', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-009', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-009', dayOffset: 4, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Camille RICHARD (28h)
  { employeeId: 'emp-010', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-010', dayOffset: 3, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-010', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // Nicolas DURAND
  { employeeId: 'emp-011', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-011', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-011', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-011', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Émilie LEROY
  { employeeId: 'emp-012', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-012', dayOffset: 2, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-012', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-012', dayOffset: 5, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Thomas SIMON
  { employeeId: 'emp-013', dayOffset: 0, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-013', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-013', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-013', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Julie MICHEL (28h)
  { employeeId: 'emp-014', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-014', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-014', dayOffset: 4, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Mathieu GARCIA
  { employeeId: 'emp-015', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-015', dayOffset: 1, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-015', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-015', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Laura DAVID
  { employeeId: 'emp-016', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-016', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-016', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-016', dayOffset: 5, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Sébastien BERTRAND
  { employeeId: 'emp-017', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-017', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-017', dayOffset: 3, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-017', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Pauline ROUX (28h)
  { employeeId: 'emp-018', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-018', dayOffset: 3, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-018', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // === RAYONNISTES (6) ===
  // Alain FOURNIER
  { employeeId: 'emp-019', dayOffset: 0, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-019', dayOffset: 1, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-019', dayOffset: 2, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-019', dayOffset: 3, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-019', dayOffset: 4, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-019', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
  // ⚠️ CONFLIT intentionnel : Alain travaille Lun-Sam sans 35h de repos consécutif

  // Nathalie MOREL
  { employeeId: 'emp-020', dayOffset: 0, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-020', dayOffset: 1, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-020', dayOffset: 2, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-020', dayOffset: 3, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-020', dayOffset: 4, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },

  // Vincent GIRARD (28h)
  { employeeId: 'emp-021', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-021', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-021', dayOffset: 4, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // Céline ANDRE
  { employeeId: 'emp-022', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-022', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-022', dayOffset: 5, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // David LEFEVRE
  { employeeId: 'emp-023', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-023', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-023', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Stéphanie MERCIER (28h)
  { employeeId: 'emp-024', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-024', dayOffset: 3, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-024', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },

  // === APPRENTIS (2) ===
  // Léa BONNET - Lun, Mar, Mer (école Jeu-Ven)
  { employeeId: 'emp-025', dayOffset: 0, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-025', dayOffset: 1, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-025', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Hugo LAMBERT - Mer, Jeu, Ven (école Lun-Mar)
  { employeeId: 'emp-026', dayOffset: 2, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-026', dayOffset: 3, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-026', dayOffset: 4, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // === ÉTUDIANTS (2, 20h) ===
  // Chloé FONTAINE - Mer après-midi, Sam
  { employeeId: 'emp-027', dayOffset: 2, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-027', dayOffset: 5, startTime: '08:30', endTime: '19:30', breakMinutes: 60, type: 'regular' },

  // Maxime CHEVALIER - Mar après-midi, Ven après-midi, Sam matin
  { employeeId: 'emp-028', dayOffset: 1, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-028', dayOffset: 4, startTime: '14:00', endTime: '19:30', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-028', dayOffset: 5, startTime: '08:30', endTime: '13:00', breakMinutes: 0, type: 'morning' },
];

/**
 * Génère les shifts concrets pour une semaine donnée à partir des templates
 */
export function generateMockShifts(monday: Date): Shift[] {
  let shiftId = 1;

  return SHIFT_TEMPLATES.map(template => {
    const shiftDate = addDays(monday, template.dayOffset);
    const dateStr = toISODateString(shiftDate);
    const effectiveHours = calculateEffectiveHours(
      template.startTime,
      template.endTime,
      template.breakMinutes
    );

    return {
      id: `shift-${String(shiftId++).padStart(3, '0')}`,
      organization_id: ORG_ID,
      employee_id: template.employeeId,
      date: dateStr,
      start_time: template.startTime,
      end_time: template.endTime,
      break_duration: template.breakMinutes,
      effective_hours: effectiveHours,
      type: template.type,
      status: 'published' as const,
      notes: null,
      created_by: 'emp-001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
}
