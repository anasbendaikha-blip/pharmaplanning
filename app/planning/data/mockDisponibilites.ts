/**
 * Donnees mock : Disponibilites des employes
 * Pharmacie des Coquelicots — 10 employes
 *
 * Convention: ~60% des employes ont des disponibilites declarees
 * Les pharmaciens sont toujours disponibles (full-time)
 * Les etudiants ont des dispos partielles (cours universitaires)
 */

import type { Disponibilite, DispoType } from '@/lib/types';
import { ORGANIZATION_ID } from './mockEmployees';

let dispoCounter = 0;

function makeDispo(
  employeeId: string,
  date: string,
  type: DispoType,
  startTime: string,
  endTime: string,
  note: string | null = null,
): Disponibilite {
  dispoCounter++;
  return {
    id: `dispo-${String(dispoCounter).padStart(4, '0')}`,
    organization_id: ORGANIZATION_ID,
    employee_id: employeeId,
    date,
    type,
    start_time: startTime,
    end_time: endTime,
    note,
    status: 'active',
    is_recurring: false,
    recurring_day: null,
    created_at: '2024-01-15T00:00:00Z',
  };
}

/**
 * Genere les disponibilites mock pour une semaine (Lun-Sam)
 * @param weekDates - Tableau de 7 dates ISO (lundi a dimanche)
 */
export function generateMockDisponibilites(weekDates: string[]): Disponibilite[] {
  dispoCounter = 0;
  const dispos: Disponibilite[] = [];
  const workDays = weekDates.slice(0, 6); // Lun-Sam

  // --- Pharmacien Titulaire : full dispo ---
  // emp-001 (Mustafa UNLU) : disponible tous les jours
  for (const date of workDays) {
    dispos.push(makeDispo('emp-001', date, 'available', '08:00', '20:00'));
  }

  // --- Pharmacien Adjoint ---
  // emp-002 (Tolga PHARMACIEN) : disponible Lun-Sam
  for (const date of workDays) {
    dispos.push(makeDispo('emp-002', date, 'available', '08:00', '20:00'));
  }

  // --- Preparateurs ---
  // emp-003 (Lea PREPARATRICE) : Lun-Ven, prefere le matin
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-003', date, 'preferred', '08:00', '13:00', 'Prefere le matin'));
    dispos.push(makeDispo('emp-003', date, 'available', '13:00', '19:00'));
  }

  // emp-004 (Hanife PREPARATRICE) : Lun-Sam full
  for (const date of workDays) {
    dispos.push(makeDispo('emp-004', date, 'available', '08:30', '19:00'));
  }

  // --- Apprentis ---
  // emp-005 (Myriam APPRENTIE) : Lun-Mar-Mer seulement (ecole Jeu-Ven)
  for (const date of workDays.slice(0, 3)) {
    dispos.push(makeDispo('emp-005', date, 'available', '08:30', '19:00'));
  }
  // Jeu-Ven : indisponible (ecole)
  dispos.push(makeDispo('emp-005', workDays[3], 'unavailable', '08:00', '19:00', 'Ecole'));
  dispos.push(makeDispo('emp-005', workDays[4], 'unavailable', '08:00', '19:00', 'Ecole'));

  // emp-006 (Selena APPRENTIE) : Mer-Jeu-Ven seulement (ecole Lun-Mar)
  dispos.push(makeDispo('emp-006', workDays[0], 'unavailable', '08:00', '19:00', 'Ecole'));
  dispos.push(makeDispo('emp-006', workDays[1], 'unavailable', '08:00', '19:00', 'Ecole'));
  for (let i = 2; i < 5; i++) {
    dispos.push(makeDispo('emp-006', workDays[i], 'available', '08:30', '19:00'));
  }

  // --- Etudiants ---
  // emp-007 (Ensar ETUDIANT) : Lun-Mer-Ven apres-midi + Sam matin
  const ensarPM = [workDays[0], workDays[2], workDays[4]];
  for (const date of ensarPM) {
    dispos.push(makeDispo('emp-007', date, 'available', '13:00', '19:00', 'Cours le matin'));
  }
  dispos.push(makeDispo('emp-007', workDays[5], 'available', '09:00', '13:00', 'Samedi matin'));

  // emp-008 (Nisa ETUDIANTE) : Mar-Jeu apres-midi + Sam
  const nisaPM = [workDays[1], workDays[3]];
  for (const date of nisaPM) {
    dispos.push(makeDispo('emp-008', date, 'available', '13:00', '19:00', 'Cours le matin'));
  }
  dispos.push(makeDispo('emp-008', workDays[5], 'available', '09:00', '17:00', 'Samedi'));

  // emp-009 (Mervenur ETUDIANTE) : Lun-Mer-Ven matin + Sam
  const mervenurAM = [workDays[0], workDays[2], workDays[4]];
  for (const date of mervenurAM) {
    dispos.push(makeDispo('emp-009', date, 'available', '08:00', '13:00', 'Cours apres-midi'));
  }
  dispos.push(makeDispo('emp-009', workDays[5], 'available', '09:00', '17:00', 'Samedi'));

  // emp-010 (Mohamed ETUDIANT) : Mar-Jeu matin + Sam
  const mohamedAM = [workDays[1], workDays[3]];
  for (const date of mohamedAM) {
    dispos.push(makeDispo('emp-010', date, 'available', '08:00', '13:00', 'Cours apres-midi'));
  }
  dispos.push(makeDispo('emp-010', workDays[5], 'available', '09:00', '17:00', 'Samedi'));

  return dispos;
}
