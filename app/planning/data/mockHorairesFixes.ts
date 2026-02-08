/**
 * Données mock : Horaires fixes récurrents des employés
 * Pré-remplis automatiquement lors du chargement d'une semaine vide
 */

import type { HoraireFixes } from '@/lib/types/horaires-fixes';

let _idCounter = 0;
function hfId(): string { return `hf-${String(++_idCounter).padStart(3, '0')}`; }

export const MOCK_HORAIRES_FIXES: HoraireFixes[] = [
  // ═══ Pharmaciens Titulaires ═══

  // emp-001 Isabelle MAURER — Lun-Ven journée complète
  { id: hfId(), employee_id: 'emp-001', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 2, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-001', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-002 François WEBER — Lun-Mar-Jeu-Ven + Sam matin alternées
  { id: hfId(), employee_id: 'emp-002', day_of_week: 0, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 1, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 3, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 4, start_time: '08:30', end_time: '19:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-002', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'even', is_active: true, label: 'Sam matin' },

  // ═══ Pharmaciens Adjoints ═══

  // emp-003 Marie DUPONT — Lun-Ven journée
  { id: hfId(), employee_id: 'emp-003', day_of_week: 0, start_time: '08:30', end_time: '18:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 1, start_time: '08:30', end_time: '18:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 2, start_time: '08:30', end_time: '18:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 3, start_time: '08:30', end_time: '18:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-003', day_of_week: 4, start_time: '08:30', end_time: '18:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-004 Claire BERNARD — Matin Lun-Ven
  { id: hfId(), employee_id: 'emp-004', day_of_week: 0, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 1, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 2, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 3, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 4, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-004', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'odd', is_active: true, label: 'Sam matin' },

  // emp-005 Sophie LAURENT (28h) — Lun-Mer-Jeu-Ven
  { id: hfId(), employee_id: 'emp-005', day_of_week: 0, start_time: '09:00', end_time: '17:00', break_duration: 30, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-005', day_of_week: 2, start_time: '09:00', end_time: '17:00', break_duration: 30, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-005', day_of_week: 3, start_time: '09:00', end_time: '17:00', break_duration: 30, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-005', day_of_week: 4, start_time: '09:00', end_time: '17:00', break_duration: 30, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-006 Antoine MOREAU — Après-midi Lun-Ven + Sam matin
  { id: hfId(), employee_id: 'emp-006', day_of_week: 0, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 1, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 2, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 3, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 4, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-006', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'even', is_active: true, label: 'Sam matin' },

  // ═══ Préparateurs (12 employés — on en fait 8 principaux) ═══

  // emp-007 Jean MARTIN — Journée Lun-Ven
  { id: hfId(), employee_id: 'emp-007', day_of_week: 0, start_time: '08:30', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 1, start_time: '08:30', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 2, start_time: '08:30', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 3, start_time: '08:30', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-007', day_of_week: 4, start_time: '08:30', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-008 Lucie PETIT — Journée Lun-Ven + Sam alternées
  { id: hfId(), employee_id: 'emp-008', day_of_week: 0, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 1, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 2, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 3, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 4, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-008', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'odd', is_active: true, label: 'Sam matin' },

  // emp-009 Pierre ROBERT — Matin Lun-Sam
  { id: hfId(), employee_id: 'emp-009', day_of_week: 0, start_time: '08:30', end_time: '14:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 1, start_time: '08:30', end_time: '14:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 2, start_time: '08:30', end_time: '14:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 3, start_time: '08:30', end_time: '14:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 4, start_time: '08:30', end_time: '14:30', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-009', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Sam matin' },

  // emp-011 Nicolas DURAND — Après-midi Lun-Ven
  { id: hfId(), employee_id: 'emp-011', day_of_week: 0, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-011', day_of_week: 1, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-011', day_of_week: 2, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-011', day_of_week: 3, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-011', day_of_week: 4, start_time: '13:00', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },

  // emp-012 Émilie LEROY — Journée Lun-Ven
  { id: hfId(), employee_id: 'emp-012', day_of_week: 0, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-012', day_of_week: 1, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-012', day_of_week: 2, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-012', day_of_week: 3, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-012', day_of_week: 4, start_time: '09:00', end_time: '18:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-013 Thomas SIMON — Journée Lun-Ven + Sam alternées
  { id: hfId(), employee_id: 'emp-013', day_of_week: 0, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-013', day_of_week: 1, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-013', day_of_week: 2, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-013', day_of_week: 3, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-013', day_of_week: 4, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-013', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'even', is_active: true, label: 'Sam matin' },

  // emp-015 Mathieu GARCIA — Matin Lun-Ven
  { id: hfId(), employee_id: 'emp-015', day_of_week: 0, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-015', day_of_week: 1, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-015', day_of_week: 2, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-015', day_of_week: 3, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-015', day_of_week: 4, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },

  // emp-016 Laura DAVID — Après-midi Lun-Ven + Sam matin alternées
  { id: hfId(), employee_id: 'emp-016', day_of_week: 0, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-016', day_of_week: 1, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-016', day_of_week: 2, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-016', day_of_week: 3, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-016', day_of_week: 4, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-016', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'odd', is_active: true, label: 'Sam matin' },

  // ═══ Rayonnistes (6 — on en fait 4 principaux) ═══

  // emp-019 Alain FOURNIER — Journée Lun-Ven
  { id: hfId(), employee_id: 'emp-019', day_of_week: 0, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-019', day_of_week: 1, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-019', day_of_week: 2, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-019', day_of_week: 3, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-019', day_of_week: 4, start_time: '08:30', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-020 Nathalie MOREL — Matin Lun-Ven + Sam
  { id: hfId(), employee_id: 'emp-020', day_of_week: 0, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-020', day_of_week: 1, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-020', day_of_week: 2, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-020', day_of_week: 3, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-020', day_of_week: 4, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-020', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Sam matin' },

  // emp-022 Céline ANDRE — Après-midi Lun-Ven
  { id: hfId(), employee_id: 'emp-022', day_of_week: 0, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-022', day_of_week: 1, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-022', day_of_week: 2, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-022', day_of_week: 3, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-022', day_of_week: 4, start_time: '13:30', end_time: '19:30', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },

  // emp-023 David LEFEVRE — Journée Mar-Sam
  { id: hfId(), employee_id: 'emp-023', day_of_week: 1, start_time: '09:00', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-023', day_of_week: 2, start_time: '09:00', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-023', day_of_week: 3, start_time: '09:00', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-023', day_of_week: 4, start_time: '09:00', end_time: '17:00', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-023', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Sam matin' },

  // ═══ Apprentis ═══

  // emp-025 Léa BONNET — Lun-Mar-Mer entreprise, Jeu-Ven école
  { id: hfId(), employee_id: 'emp-025', day_of_week: 0, start_time: '09:00', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-025', day_of_week: 1, start_time: '09:00', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-025', day_of_week: 2, start_time: '09:00', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // emp-026 Hugo LAMBERT — Lun-Mer entreprise, Jeu-Ven école
  { id: hfId(), employee_id: 'emp-026', day_of_week: 0, start_time: '09:00', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-026', day_of_week: 1, start_time: '09:00', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },
  { id: hfId(), employee_id: 'emp-026', day_of_week: 2, start_time: '09:00', end_time: '17:30', break_duration: 60, shift_type: 'regular', alternate_weeks: null, is_active: true, label: 'Journée' },

  // ═══ Étudiants (horaires réduits) ═══

  // emp-027 Chloé FONTAINE (20h) — Mar-Mer-Sam matin
  { id: hfId(), employee_id: 'emp-027', day_of_week: 1, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-027', day_of_week: 2, start_time: '08:30', end_time: '14:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Matin' },
  { id: hfId(), employee_id: 'emp-027', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: null, is_active: true, label: 'Sam matin' },

  // emp-028 Maxime CHEVALIER (20h) — Lun-Jeu après-midi
  { id: hfId(), employee_id: 'emp-028', day_of_week: 0, start_time: '14:00', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-028', day_of_week: 3, start_time: '14:00', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-028', day_of_week: 4, start_time: '14:00', end_time: '19:00', break_duration: 0, shift_type: 'afternoon', alternate_weeks: null, is_active: true, label: 'Après-midi' },
  { id: hfId(), employee_id: 'emp-028', day_of_week: 5, start_time: '08:30', end_time: '13:00', break_duration: 0, shift_type: 'morning', alternate_weeks: 'even', is_active: true, label: 'Sam matin' },
];
