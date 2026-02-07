/**
 * Algorithme de rotation des gardes pharmacie
 *
 * Fonctions PURES : prennent des Employee[] et Shift[] typés depuis @/lib/types,
 * retournent des assignments et conflits.
 *
 * Logique :
 *  1. Filtrer les pharmaciens éligibles (category = pharmacien_titulaire ou pharmacien_adjoint)
 *  2. Générer les dates de garde selon la config (dimanches, fériés, nuits)
 *  3. Assigner en rotation équitable (le moins chargé en premier)
 *  4. Détecter les conflits (shift existant ou garde déjà assignée)
 */

import type { Employee, Shift } from '@/lib/types';
import type {
  GardeAssignment,
  PharmacienStats,
  GardeConflict,
  RotationConfig,
  GardeType,
} from './types';
import { JOURS_FERIES } from './types';
import {
  toISODateString,
  addDays,
  parseISODate,
  getDayOfWeekFr,
} from '@/lib/utils/dateUtils';

// ─── Helpers ───

/** Nom complet d'un employé */
function fullName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`.trim();
}

/** Vérifie si un employé est pharmacien (titulaire ou adjoint) */
function isPharmacien(emp: Employee): boolean {
  return emp.category === 'pharmacien_titulaire' || emp.category === 'pharmacien_adjoint';
}

/** Date d'aujourd'hui en YYYY-MM-DD */
function todayStr(): string {
  return toISODateString(new Date());
}

// ─── Types internes ───

interface GardeDateInfo {
  date: string;
  dayName: string;
  type: GardeType;
  heureDebut: string;
  heureFin: string;
}

// ─── Génération des dates de garde ───

function generateGardeDates(config: RotationConfig): GardeDateInfo[] {
  const dates: GardeDateInfo[] = [];
  const start = parseISODate(config.startDate);
  const end = parseISODate(config.endDate);

  // Itérer jour par jour sans muter l'objet Date
  let current = start;
  while (current <= end) {
    const dateStr = toISODateString(current);
    const dayOfWeek = current.getDay(); // 0=dimanche

    // Fériés (priorité sur dimanche pour éviter le doublon)
    if (config.includeFeries && JOURS_FERIES.includes(dateStr)) {
      dates.push({
        date: dateStr,
        dayName: getDayOfWeekFr(current),
        type: 'ferie',
        heureDebut: config.heureDebutDimanche,
        heureFin: config.heureFinDimanche,
      });
    }
    // Dimanches (seulement si pas déjà férié)
    else if (config.includeDimanches && dayOfWeek === 0) {
      dates.push({
        date: dateStr,
        dayName: 'Dimanche',
        type: 'dimanche',
        heureDebut: config.heureDebutDimanche,
        heureFin: config.heureFinDimanche,
      });
    }

    // Nuits (tous les jours, en plus du dimanche/férié)
    if (config.includeNuits) {
      dates.push({
        date: dateStr,
        dayName: getDayOfWeekFr(current),
        type: 'nuit',
        heureDebut: config.heureDebutNuit,
        heureFin: config.heureFinNuit,
      });
    }

    current = addDays(current, 1);
  }

  return dates;
}

// ─── Vérification des conflits ───

function checkConflict(
  emp: Employee,
  date: string,
  shifts: Shift[],
  existingAssignments: GardeAssignment[],
): GardeConflict | null {
  const name = fullName(emp);

  // Shift planifié le même jour
  const hasShift = shifts.some(
    s => s.employee_id === emp.id && s.date === date,
  );
  if (hasShift) {
    return {
      date,
      pharmacienId: emp.id,
      pharmacienName: name,
      type: 'planning',
      description: `${name} a déjà un shift planifié le ${date}`,
    };
  }

  // Garde déjà assignée ce jour
  const hasGarde = existingAssignments.some(
    g => g.pharmacienId === emp.id && g.date === date,
  );
  if (hasGarde) {
    return {
      date,
      pharmacienId: emp.id,
      pharmacienName: name,
      type: 'autre_garde',
      description: `${name} a déjà une garde le ${date}`,
    };
  }

  return null;
}

// ─── Génération de la rotation ───

/**
 * Génère la rotation des gardes de façon équitable.
 *
 * @param config - Configuration de la période et types de gardes
 * @param employees - Tous les employés (sera filtré pour ne garder que les pharmaciens)
 * @param existingGardes - Gardes déjà assignées (pour équilibrage et détection conflits)
 * @param shifts - Shifts existants (pour détection conflits)
 */
export function generateGardeRotation(
  config: RotationConfig,
  employees: Employee[],
  existingGardes: GardeAssignment[],
  shifts: Shift[],
): {
  assignments: GardeAssignment[];
  conflicts: GardeConflict[];
} {
  const assignments: GardeAssignment[] = [];
  const conflicts: GardeConflict[] = [];

  // Filtrer les pharmaciens éligibles
  const pharmaciens = employees.filter(isPharmacien);

  if (pharmaciens.length === 0) {
    return { assignments, conflicts };
  }

  // Calculer stats existantes pour équilibrage
  const stats = calculateStats(pharmaciens, existingGardes);

  // Trier par nombre total de gardes (le moins chargé en premier)
  const sorted = [...pharmaciens].sort((a, b) => {
    const statsA = stats.find(s => s.pharmacienId === a.id);
    const statsB = stats.find(s => s.pharmacienId === b.id);
    return (statsA?.totalGardes ?? 0) - (statsB?.totalGardes ?? 0);
  });

  // Générer les dates de garde
  const gardeDates = generateGardeDates(config);

  let rotationIndex = 0;

  for (const dateInfo of gardeDates) {
    let assigned = false;
    let attempts = 0;

    // Essayer chaque pharmacien en rotation
    while (!assigned && attempts < pharmaciens.length) {
      const pharmacien = sorted[rotationIndex % sorted.length];

      // Vérifier conflit avec les shifts ET les gardes déjà assignées dans cette rotation
      const conflict = checkConflict(
        pharmacien,
        dateInfo.date,
        shifts,
        [...existingGardes, ...assignments],
      );

      if (!conflict) {
        assignments.push({
          date: dateInfo.date,
          dayName: dateInfo.dayName,
          type: dateInfo.type,
          pharmacienId: pharmacien.id,
          pharmacienName: fullName(pharmacien),
          heureDebut: dateInfo.heureDebut,
          heureFin: dateInfo.heureFin,
          hasConflict: false,
          conflictReason: null,
        });
        assigned = true;
        rotationIndex++;
      } else {
        conflicts.push(conflict);
        rotationIndex++;
        attempts++;
      }
    }

    // Aucun pharmacien disponible
    if (!assigned) {
      conflicts.push({
        date: dateInfo.date,
        pharmacienId: '',
        pharmacienName: 'Aucun',
        type: 'autre_garde',
        description: `Aucun pharmacien disponible pour la garde ${dateInfo.type} du ${dateInfo.date}`,
      });
    }
  }

  return { assignments, conflicts };
}

// ─── Calcul des statistiques ───

/**
 * Calcule les statistiques de gardes par pharmacien.
 */
export function calculateStats(
  pharmaciens: Employee[],
  gardes: GardeAssignment[],
): PharmacienStats[] {
  const today = todayStr();

  return pharmaciens.map(p => {
    const name = fullName(p);
    const pharmaGardes = gardes.filter(g => g.pharmacienId === p.id);

    // Gardes passées et futures
    const pastGardes = pharmaGardes
      .filter(g => g.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));

    const futureGardes = pharmaGardes
      .filter(g => g.date > today)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      pharmacienId: p.id,
      pharmacienName: name,
      totalGardes: pharmaGardes.length,
      gardesNuit: pharmaGardes.filter(g => g.type === 'nuit').length,
      gardesDimanche: pharmaGardes.filter(g => g.type === 'dimanche').length,
      gardesFerie: pharmaGardes.filter(g => g.type === 'ferie').length,
      lastGardeDate: pastGardes.length > 0 ? pastGardes[0].date : null,
      nextGardeDate: futureGardes.length > 0 ? futureGardes[0].date : null,
    };
  });
}
