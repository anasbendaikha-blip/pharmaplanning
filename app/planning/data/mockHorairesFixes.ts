/**
 * Donnees mock : Horaires fixes recurrents des employes
 * Pharmacie des Coquelicots — 10 employes
 * Horaires : Lun-Ven 08:30-12:30 + 13:30-19:00 (coupure midi) / Sam 09:00-17:00
 */

import type { HoraireFixes } from '@/lib/types/horaires-fixes';

let _idCounter = 0;
function hfId(): string { return `hf-${String(++_idCounter).padStart(3, '0')}`; }

export const MOCK_HORAIRES_FIXES: HoraireFixes[] = [
  // ═══ Pharmacien Titulaire ═══

  // emp-001 Mustafa UNLU — Lun-Ven journee complete + Sam alternees
  { id: hfId(), employee_id: 'emp-001', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 5, start_time: '09:00', end_time: '17:00', break_duration: 0, shift_type: 'regular', alternate_weeks: 'even', is_active: true, label: 'Samedi' },

  // ═══ Pharmacien Adjoint ═══

  // emp-002 Tolga PHARMACIEN — Lun-Ven journee + Sam alternees
  { id: hfId(), employee_id: 'emp-002', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 5, start_time: '09:00', end_time: '17:00', break_duration: 0, shift_type: 'regular', alternate_weeks: 'odd', is_active: true, label: 'Samedi' },

  // ═══ Preparateurs ═══

  // emp-003 Lea PREPARATRICE — Lun-Ven journee
  { id: hfId(), employee_id: 'emp-003', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },

  // emp-004 Hanife PREPARATRICE — Lun-Ven journee + Sam alternees
  { id: hfId(), employee_id: 'emp-004', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 5, start_time: '09:00', end_time: '17:00', break_duration: 0, shift_type: 'regular', alternate_weeks: 'even', is_active: true, label: 'Samedi' },

  // ═══ Apprentis (alternance) ═══

  // emp-005 Myriam APPRENTIE — Lun-Mar-Mer en pharmacie (Jeu-Ven ecole)
  { id: hfId(), employee_id: 'emp-005', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-005', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-005', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },

  // emp-006 Selena APPRENTIE — Mer-Jeu-Ven en pharmacie (Lun-Mar ecole)
  { id: hfId(), employee_id: 'emp-006', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journee' },

  // ═══ Etudiants (horaires reduits ~20h/sem) ═══

  // emp-007 Ensar ETUDIANT — Lun-Mer-Ven apres-midi 13:30-19:00
  { id: hfId(), employee_id: 'emp-007', day_of_week: 0, start_time: '13:30', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Apres-midi' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 2, start_time: '13:30', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Apres-midi' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 4, start_time: '13:30', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Apres-midi' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 5, start_time: '09:00', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'odd', is_active: true, label: 'Sam matin' },

  // emp-008 Nisa ETUDIANTE — Mar-Jeu apres-midi + Sam
  { id: hfId(), employee_id: 'emp-008', day_of_week: 1, start_time: '13:30', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Apres-midi' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 3, start_time: '13:30', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Apres-midi' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 5, start_time: '09:00', end_time: '17:00', break_duration: 0, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Samedi' },

  // emp-009 Mervenur ETUDIANTE — Lun-Mer matin + Sam
  { id: hfId(), employee_id: 'emp-009', day_of_week: 0, start_time: '08:30', end_time: '12:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 2, start_time: '08:30', end_time: '12:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 4, start_time: '08:30', end_time: '12:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 5, start_time: '09:00', end_time: '17:00', break_duration: 0, shift_type: 'regular', alternate_weeks: 'even', is_active: true, label: 'Samedi' },

  // emp-010 Mohamed ETUDIANT — Mar-Jeu matin + Sam
  { id: hfId(), employee_id: 'emp-010', day_of_week: 1, start_time: '08:30', end_time: '12:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-010', day_of_week: 3, start_time: '08:30', end_time: '12:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-010', day_of_week: 5, start_time: '09:00', end_time: '17:00', break_duration: 0, shift_type: 'regular', alternate_weeks: 'odd', is_active: true, label: 'Samedi' },
];
