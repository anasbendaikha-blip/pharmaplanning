/**
 * Données mock : Disponibilités des employés
 * Génère des disponibilités réalistes pour une semaine donnée
 *
 * Convention: ~60% des employés ont des disponibilités déclarées
 * Les pharmaciens titulaires sont toujours disponibles (full-time)
 * Les étudiants ont des dispos partielles (cours universitaires)
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
 * Génère les disponibilités mock pour une semaine (Lun-Sam)
 * @param weekDates - Tableau de 7 dates ISO (lundi à dimanche)
 */
export function generateMockDisponibilites(weekDates: string[]): Disponibilite[] {
  dispoCounter = 0;
  const dispos: Disponibilite[] = [];
  const workDays = weekDates.slice(0, 6); // Lun-Sam

  // ─── Pharmaciens Titulaires : full dispo ───
  // emp-001 (Isabelle MAURER) : disponible tous les jours
  for (const date of workDays) {
    dispos.push(makeDispo('emp-001', date, 'available', '08:00', '20:00'));
  }

  // emp-002 (François WEBER) : disponible Lun-Ven
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-002', date, 'available', '08:00', '20:00'));
  }

  // ─── Pharmaciens Adjoints : la plupart avec dispos ───
  // emp-003 (Marie DUPONT) : Lun-Ven, préfère le matin
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-003', date, 'preferred', '08:00', '14:00', 'Préfère le matin'));
    dispos.push(makeDispo('emp-003', date, 'available', '14:00', '19:30'));
  }

  // emp-004 (Claire BERNARD) : Lun-Sam full
  for (const date of workDays) {
    dispos.push(makeDispo('emp-004', date, 'available', '08:30', '19:30'));
  }

  // emp-005 (Sophie LAURENT) : temps partiel - Lun, Mar, Jeu seulement
  const sophieDays = [workDays[0], workDays[1], workDays[3]]; // Lun, Mar, Jeu
  for (const date of sophieDays) {
    dispos.push(makeDispo('emp-005', date, 'available', '08:30', '17:00', 'Temps partiel 28h'));
  }

  // emp-006 (Antoine MOREAU) : Lun-Ven, indisponible mercredi après-midi
  for (let i = 0; i < 5; i++) {
    if (i === 2) { // Mercredi
      dispos.push(makeDispo('emp-006', workDays[i], 'available', '08:30', '13:00', 'Indispo mercredi PM'));
      dispos.push(makeDispo('emp-006', workDays[i], 'unavailable', '13:00', '19:30', 'Enfants'));
    } else {
      dispos.push(makeDispo('emp-006', workDays[i], 'available', '08:30', '19:30'));
    }
  }

  // ─── Préparateurs : dispos variées ───
  // emp-007 (Jean MARTIN) : Lun-Sam full
  for (const date of workDays) {
    dispos.push(makeDispo('emp-007', date, 'available', '08:30', '19:30'));
  }

  // emp-008 (Lucie PETIT) : Lun-Ven, indispo samedi
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-008', date, 'available', '08:30', '19:30'));
  }

  // emp-009 (Pierre ROBERT) : Lun-Sam, préfère l'après-midi
  for (const date of workDays) {
    dispos.push(makeDispo('emp-009', date, 'available', '08:30', '13:00'));
    dispos.push(makeDispo('emp-009', date, 'preferred', '13:00', '19:30', 'Préfère après-midi'));
  }

  // emp-010 (Camille RICHARD) : temps partiel 28h, Lun-Mer-Ven
  const camilleDays = [workDays[0], workDays[2], workDays[4]]; // Lun, Mer, Ven
  for (const date of camilleDays) {
    dispos.push(makeDispo('emp-010', date, 'available', '08:30', '19:00'));
  }

  // emp-011 (Nicolas DURAND) : Lun-Ven full
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-011', date, 'available', '08:30', '19:30'));
  }

  // emp-012 (Émilie LEROY) : Lun-Sam, indispo jeudi
  for (let i = 0; i < 6; i++) {
    if (i === 3) continue; // Jeudi : pas de dispo
    dispos.push(makeDispo('emp-012', workDays[i], 'available', '08:30', '19:30'));
  }

  // emp-013 (Thomas SIMON) : Lun-Ven, disponible seulement matin le mercredi
  for (let i = 0; i < 5; i++) {
    if (i === 2) { // Mercredi
      dispos.push(makeDispo('emp-013', workDays[i], 'available', '08:00', '13:00'));
    } else {
      dispos.push(makeDispo('emp-013', workDays[i], 'available', '08:00', '19:30'));
    }
  }
  // Sam : disponible
  dispos.push(makeDispo('emp-013', workDays[5], 'available', '08:30', '14:00'));

  // emp-014 (Julie MICHEL) : temps partiel, Mar-Jeu-Sam
  const julieDays = [workDays[1], workDays[3], workDays[5]]; // Mar, Jeu, Sam
  for (const date of julieDays) {
    dispos.push(makeDispo('emp-014', date, 'available', '08:30', '18:00'));
  }

  // emp-015 (Mathieu GARCIA) : pas de dispo déclarée (on ne le met pas)
  // → sera détecté par l'analytique comme "aucune dispo"

  // emp-016 (Laura DAVID) : pas de dispo déclarée
  // → sera détecté par l'analytique

  // emp-017 (Sébastien BERTRAND) : Lun-Ven
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-017', date, 'available', '09:00', '19:30'));
  }

  // emp-018 (Pauline ROUX) : temps partiel, Lun-Mar-Mer
  for (const date of workDays.slice(0, 3)) {
    dispos.push(makeDispo('emp-018', date, 'available', '08:30', '17:30'));
  }

  // ─── Rayonnistes : dispos variables ───
  // emp-019 (Alain FOURNIER) : Lun-Sam full
  for (const date of workDays) {
    dispos.push(makeDispo('emp-019', date, 'available', '08:30', '19:30'));
  }

  // emp-020 (Nathalie MOREL) : Lun-Ven, préfère matin
  for (const date of workDays.slice(0, 5)) {
    dispos.push(makeDispo('emp-020', date, 'preferred', '08:30', '14:00', 'Matin préféré'));
  }

  // emp-021 (Vincent GIRARD) : temps partiel, pas de dispo déclarée
  // → sera détecté par l'analytique

  // emp-022 (Céline ANDRE) : Lun-Sam
  for (const date of workDays) {
    dispos.push(makeDispo('emp-022', date, 'available', '08:30', '19:30'));
  }

  // emp-023 (David LEFEVRE) : pas de dispo
  // → sera détecté par l'analytique

  // emp-024 (Stéphanie MERCIER) : temps partiel, Mar-Jeu-Sam
  const stephDays = [workDays[1], workDays[3], workDays[5]];
  for (const date of stephDays) {
    dispos.push(makeDispo('emp-024', date, 'available', '08:30', '17:00'));
  }

  // ─── Apprentis ───
  // emp-025 (Léa BONNET) : Lun-Mar-Jeu-Ven (mercredi = école)
  const leaDays = [workDays[0], workDays[1], workDays[3], workDays[4]];
  for (const date of leaDays) {
    dispos.push(makeDispo('emp-025', date, 'available', '08:30', '18:00'));
  }
  dispos.push(makeDispo('emp-025', workDays[2], 'unavailable', '08:00', '19:30', 'École'));

  // emp-026 (Hugo LAMBERT) : Lun-Mer-Ven (alternance)
  const hugoDays = [workDays[0], workDays[2], workDays[4]];
  for (const date of hugoDays) {
    dispos.push(makeDispo('emp-026', date, 'available', '08:30', '18:00'));
  }

  // ─── Étudiants ───
  // emp-027 (Chloé FONTAINE) : seulement après-midi Lun-Mer-Ven + samedi matin
  const chloePM = [workDays[0], workDays[2], workDays[4]]; // Lun, Mer, Ven
  for (const date of chloePM) {
    dispos.push(makeDispo('emp-027', date, 'available', '13:00', '19:00', 'Cours le matin'));
  }
  dispos.push(makeDispo('emp-027', workDays[5], 'available', '08:30', '13:00', 'Samedi matin'));

  // emp-028 (Maxime CHEVALIER) : Mar-Jeu après-midi + samedi
  const maximePM = [workDays[1], workDays[3]]; // Mar, Jeu
  for (const date of maximePM) {
    dispos.push(makeDispo('emp-028', date, 'available', '14:00', '19:30', 'Cours le matin'));
  }
  dispos.push(makeDispo('emp-028', workDays[5], 'available', '08:30', '16:00', 'Samedi'));

  return dispos;
}
