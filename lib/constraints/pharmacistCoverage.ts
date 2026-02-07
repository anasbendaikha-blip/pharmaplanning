/**
 * Contrainte : Couverture pharmacien titulaire/adjoint
 *
 * Réglementation :
 * - Au moins 1 pharmacien (titulaire ou adjoint) doit être présent
 *   pendant TOUTES les heures d'ouverture de la pharmacie
 * - Le pharmacien titulaire a la responsabilité finale
 * - Sans pharmacien, la pharmacie ne peut pas ouvrir (violation légale grave)
 *
 * Algorithme :
 * 1. Récupérer les horaires d'ouverture de la pharmacie
 * 2. Pour chaque créneau d'ouverture, vérifier qu'au moins 1 pharmacien est planifié
 * 3. Signaler les créneaux non couverts comme erreur critique
 */

import type { Shift, Conflict, ConflictSeverity } from '@/lib/types';
import type { DayOpeningHours, EmployeeCategory } from '@/lib/types';
import type { Employee } from '@/lib/types';
import { timeToMinutes } from '@/lib/utils/hourUtils';

/** Catégories considérées comme "pharmacien" pour la couverture */
const PHARMACIST_CATEGORIES: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
];

interface CoverageResult {
  valid: boolean;
  /** Pourcentage de couverture (0-100) */
  coveragePercent: number;
  /** Créneaux non couverts */
  uncoveredSlots: UncoveredSlot[];
  conflicts: Conflict[];
}

interface UncoveredSlot {
  date: string;
  start: string;
  end: string;
  durationMinutes: number;
}

/**
 * Valide la couverture pharmacien pour une journée donnée
 */
export function validatePharmacistCoverage(
  date: string,
  shifts: Shift[],
  employees: Employee[],
  openingHours: DayOpeningHours,
  organizationId: string,
  minPharmacists: number = 1
): CoverageResult {
  // Si la pharmacie est fermée ce jour, pas de vérification
  if (!openingHours.is_open || openingHours.slots.length === 0) {
    return { valid: true, coveragePercent: 100, uncoveredSlots: [], conflicts: [] };
  }

  // Identifier les pharmaciens
  const pharmacistIds = new Set(
    employees
      .filter(e => PHARMACIST_CATEGORIES.includes(e.category) && e.is_active)
      .map(e => e.id)
  );

  // Filtrer les shifts des pharmaciens pour cette date (travail effectif uniquement)
  const pharmacistShifts = shifts.filter(
    s =>
      s.date === date &&
      pharmacistIds.has(s.employee_id) &&
      s.type !== 'conge' &&
      s.type !== 'maladie' &&
      s.type !== 'rtt' &&
      s.status !== 'cancelled'
  );

  // Construire la timeline de couverture en résolution de 15 minutes
  const RESOLUTION = 15; // minutes
  const uncoveredSlots: UncoveredSlot[] = [];
  let totalOpenMinutes = 0;
  let coveredMinutes = 0;

  for (const slot of openingHours.slots) {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    totalOpenMinutes += slotEnd - slotStart;

    // Vérifier chaque créneau de 15 minutes
    let uncoveredStart: number | null = null;

    for (let t = slotStart; t < slotEnd; t += RESOLUTION) {
      const pharmacistsPresent = countPharmacistsAt(pharmacistShifts, t);

      if (pharmacistsPresent >= minPharmacists) {
        coveredMinutes += RESOLUTION;

        // Si on était dans une période non couverte, la fermer
        if (uncoveredStart !== null) {
          uncoveredSlots.push({
            date,
            start: minutesToTimeStr(uncoveredStart),
            end: minutesToTimeStr(t),
            durationMinutes: t - uncoveredStart,
          });
          uncoveredStart = null;
        }
      } else {
        // Début d'une période non couverte
        if (uncoveredStart === null) {
          uncoveredStart = t;
        }
      }
    }

    // Fermer la dernière période non couverte
    if (uncoveredStart !== null) {
      uncoveredSlots.push({
        date,
        start: minutesToTimeStr(uncoveredStart),
        end: slot.end,
        durationMinutes: slotEnd - uncoveredStart,
      });
    }
  }

  const coveragePercent = totalOpenMinutes > 0
    ? Math.round((coveredMinutes / totalOpenMinutes) * 100)
    : 100;

  const valid = uncoveredSlots.length === 0;
  const conflicts: Conflict[] = [];

  if (!valid) {
    // Créer un conflit pour chaque créneau non couvert
    for (const slot of uncoveredSlots) {
      conflicts.push({
        id: `pharmacist-coverage-${date}-${slot.start}`,
        organization_id: organizationId,
        type: 'no_pharmacist_coverage',
        severity: 'error' as ConflictSeverity,
        employee_ids: [],
        shift_ids: pharmacistShifts.map(s => s.id),
        message: `Aucun pharmacien présent le ${date} de ${slot.start} à ${slot.end} (${slot.durationMinutes} min non couvertes)`,
        date,
        is_resolved: false,
        resolution: null,
      });
    }
  }

  return { valid, coveragePercent, uncoveredSlots, conflicts };
}

/**
 * Valide la couverture pharmacien pour une semaine entière
 */
export function validateWeeklyPharmacistCoverage(
  weekDates: string[],
  shifts: Shift[],
  employees: Employee[],
  weeklyOpeningHours: Record<number, DayOpeningHours>,
  organizationId: string,
  minPharmacists: number = 1
): CoverageResult {
  let totalCoverage = 0;
  let totalDays = 0;
  const allUncovered: UncoveredSlot[] = [];
  const allConflicts: Conflict[] = [];

  for (let i = 0; i < weekDates.length; i++) {
    const date = weekDates[i];
    const dayOpeningHours = weeklyOpeningHours[i];

    if (!dayOpeningHours || !dayOpeningHours.is_open) continue;

    const dayShifts = shifts.filter(s => s.date === date);
    const result = validatePharmacistCoverage(
      date, dayShifts, employees, dayOpeningHours, organizationId, minPharmacists
    );

    totalCoverage += result.coveragePercent;
    totalDays++;
    allUncovered.push(...result.uncoveredSlots);
    allConflicts.push(...result.conflicts);
  }

  return {
    valid: allConflicts.filter(c => c.severity === 'error').length === 0,
    coveragePercent: totalDays > 0 ? Math.round(totalCoverage / totalDays) : 100,
    uncoveredSlots: allUncovered,
    conflicts: allConflicts,
  };
}

/**
 * Compte le nombre de pharmaciens présents à un instant donné
 */
function countPharmacistsAt(pharmacistShifts: Shift[], timeMinutes: number): number {
  let count = 0;
  for (const shift of pharmacistShifts) {
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    if (timeMinutes >= start && timeMinutes < end) {
      count++;
    }
  }
  return count;
}

/**
 * Convertit des minutes en string HH:MM
 */
function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
