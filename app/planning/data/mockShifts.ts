/**
 * Donnees mock : shifts d'une semaine type pour la Pharmacie des Coquelicots
 *
 * Genere des shifts realistes pour une semaine donnee.
 * Horaires : Lun-Ven 08:30-12:30 + 13:30-19:00 (coupure midi) / Sam 09:00-17:00
 * Inclut volontairement quelques conflits pour demontrer la detection.
 */

import type { Shift, ShiftType } from '@/lib/types';
import { toISODateString, addDays } from '@/lib/utils/dateUtils';
import { calculateEffectiveHours } from '@/lib/utils/hourUtils';

const ORG_ID = 'org-pharmacie-coquelicots';

interface ShiftTemplate {
  employeeId: string;
  /** Jour de la semaine (0=lundi, 5=samedi) */
  dayOffset: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  type: ShiftType;
}

/**
 * Planning type de la semaine (10 employes)
 * - Pharmacie ouverte Lun-Ven (8h30-12h30 + 13h30-19h00), Sam (9h-17h)
 * - Coupure midi Lun-Ven 12h30-13h30
 * - Inclut des conflits intentionnels pour la demo
 */
const SHIFT_TEMPLATES: ShiftTemplate[] = [
  // === PHARMACIEN TITULAIRE ===
  // Mustafa UNLU — Lun-Ven journee + Sam
  { employeeId: 'emp-001', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 3, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-001', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // === PHARMACIEN ADJOINT ===
  // Tolga PHARMACIEN — Lun-Ven journee + Sam
  { employeeId: 'emp-002', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 3, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-002', dayOffset: 5, startTime: '09:00', endTime: '17:00', breakMinutes: 0, type: 'regular' },

  // === PREPARATEURS ===
  // Lea PREPARATRICE — Lun-Ven journee
  { employeeId: 'emp-003', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-003', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-003', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-003', dayOffset: 3, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-003', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // Hanife PREPARATRICE — Lun-Ven + Sam
  { employeeId: 'emp-004', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  // CONFLIT intentionnel : Hanife travaille 11h le jeudi (> 10h max)
  { employeeId: 'emp-004', dayOffset: 3, startTime: '07:30', endTime: '19:00', breakMinutes: 30, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-004', dayOffset: 5, startTime: '09:00', endTime: '17:00', breakMinutes: 0, type: 'regular' },

  // === APPRENTIS ===
  // Myriam APPRENTIE — Lun-Mar-Mer (Jeu-Ven = ecole)
  { employeeId: 'emp-005', dayOffset: 0, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-005', dayOffset: 1, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-005', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // Selena APPRENTIE — Mer-Jeu-Ven (Lun-Mar = ecole)
  { employeeId: 'emp-006', dayOffset: 2, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-006', dayOffset: 3, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },
  { employeeId: 'emp-006', dayOffset: 4, startTime: '08:30', endTime: '19:00', breakMinutes: 60, type: 'regular' },

  // === ETUDIANTS (20h/sem) ===
  // Ensar ETUDIANT — Lun-Mer-Ven apres-midi + Sam matin
  { employeeId: 'emp-007', dayOffset: 0, startTime: '13:30', endTime: '19:00', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-007', dayOffset: 2, startTime: '13:30', endTime: '19:00', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-007', dayOffset: 4, startTime: '13:30', endTime: '19:00', breakMinutes: 0, type: 'afternoon' },

  // Nisa ETUDIANTE — Mar-Jeu apres-midi + Sam
  { employeeId: 'emp-008', dayOffset: 1, startTime: '13:30', endTime: '19:00', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-008', dayOffset: 3, startTime: '13:30', endTime: '19:00', breakMinutes: 0, type: 'afternoon' },
  { employeeId: 'emp-008', dayOffset: 5, startTime: '09:00', endTime: '17:00', breakMinutes: 0, type: 'regular' },

  // Mervenur ETUDIANTE — Lun-Mer-Ven matin
  { employeeId: 'emp-009', dayOffset: 0, startTime: '08:30', endTime: '12:30', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-009', dayOffset: 2, startTime: '08:30', endTime: '12:30', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-009', dayOffset: 4, startTime: '08:30', endTime: '12:30', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-009', dayOffset: 5, startTime: '09:00', endTime: '17:00', breakMinutes: 0, type: 'regular' },

  // Mohamed ETUDIANT — Mar-Jeu matin + Sam
  { employeeId: 'emp-010', dayOffset: 1, startTime: '08:30', endTime: '12:30', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-010', dayOffset: 3, startTime: '08:30', endTime: '12:30', breakMinutes: 0, type: 'morning' },
  { employeeId: 'emp-010', dayOffset: 5, startTime: '09:00', endTime: '17:00', breakMinutes: 0, type: 'regular' },
];

/**
 * Genere les shifts concrets pour une semaine donnee a partir des templates
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
