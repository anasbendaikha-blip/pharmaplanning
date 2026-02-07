/**
 * Validation des contraintes légales — Code du Travail français
 *
 * Toutes les fonctions sont PURES : elles prennent des Shift[] et Employee[]
 * et retournent des violations. Aucun appel réseau ici.
 *
 * Règles validées :
 *  1. Repos hebdomadaire 35h consécutives
 *  2. Amplitude journalière 10h max
 *  3. Durée hebdomadaire 48h max
 *  4. Repos quotidien 11h min
 *  5. Pause obligatoire 20 min pour 6h+ travail continu
 */

import type { Shift, Employee } from '@/lib/types';
import type {
  LegalViolation,
  ComplianceScore,
  EmployeeCompliance,
  ComplianceReport,
  ViolationType,
} from './types';
import { timeToMinutes, hoursToReadable, LEGAL_LIMITS } from './types';

// ─── Compteur d'IDs déterministe ───

let violationCounter = 0;
function nextViolationId(): string {
  violationCounter += 1;
  return `viol-${violationCounter}`;
}

// ─── Helpers internes ───

/** Regroupe les shifts par employé */
function groupShiftsByEmployee(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = map.get(shift.employee_id) || [];
    existing.push(shift);
    map.set(shift.employee_id, existing);
  }
  return map;
}

/** Regroupe les shifts d'un employé par date */
function groupShiftsByDate(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = map.get(shift.date) || [];
    existing.push(shift);
    map.set(shift.date, existing);
  }
  return map;
}

/** Nom complet d'un employé */
function employeeName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`.trim();
}

/** Obtient toutes les dates uniques triées depuis des shifts */
function getSortedDates(shifts: Shift[]): string[] {
  const dates = [...new Set(shifts.map(s => s.date))];
  return dates.sort();
}

/** Parse une date string YYYY-MM-DD en Date locale (midi pour éviter timezone) */
function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

// ─── 1. Repos hebdomadaire 35h consécutives ───

/**
 * Vérifie qu'entre le dernier shift d'une semaine et le premier de la suivante,
 * il y a au moins 35h de repos consécutif.
 * On vérifie aussi le plus grand gap consécutif dans la semaine.
 */
function validate35hWeeklyRest(
  empShifts: Shift[],
  emp: Employee,
): LegalViolation[] {
  const violations: LegalViolation[] = [];
  if (empShifts.length === 0) return violations;

  const dates = getSortedDates(empShifts);
  if (dates.length <= 1) return violations;

  // Construire la timeline complète : pour chaque date, extraire fin du dernier shift
  // et début du premier shift
  const dayBoundaries: Array<{
    date: string;
    firstStartMin: number;
    lastEndMin: number;
  }> = [];

  const byDate = groupShiftsByDate(empShifts);

  for (const date of dates) {
    const dayShifts = byDate.get(date) || [];
    const starts = dayShifts.map(s => timeToMinutes(s.start_time));
    const ends = dayShifts.map(s => timeToMinutes(s.end_time));
    dayBoundaries.push({
      date,
      firstStartMin: Math.min(...starts),
      lastEndMin: Math.max(...ends),
    });
  }

  // Vérifier le repos entre chaque paire de jours consécutifs travaillés
  // Le plus grand gap sans travail doit être >= 35h pour la semaine
  let maxConsecutiveRestMinutes = 0;

  for (let i = 0; i < dayBoundaries.length - 1; i++) {
    const current = dayBoundaries[i];
    const next = dayBoundaries[i + 1];

    // Calculer le repos entre la fin du travail aujourd'hui et le début demain
    const currentDate = parseLocalDate(current.date);
    const nextDate = parseLocalDate(next.date);
    const daysBetween = Math.round(
      (nextDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Repos = (jours entre * 24h * 60) - fin_aujourd'hui + début_demain
    // Plus précisément : du lastEnd du jour i au firstStart du jour i+1
    const restMinutes =
      (daysBetween - 1) * 24 * 60 + (24 * 60 - current.lastEndMin) + next.firstStartMin;

    if (restMinutes > maxConsecutiveRestMinutes) {
      maxConsecutiveRestMinutes = restMinutes;
    }
  }

  // Si on travaille 7/7 et que le plus grand repos consécutif est < 35h
  const restHours = maxConsecutiveRestMinutes / 60;
  if (dates.length >= 6 && restHours < LEGAL_LIMITS.WEEKLY_REST_HOURS) {
    violations.push({
      id: nextViolationId(),
      type: 'repos_hebdomadaire_35h',
      severity: 'critical',
      employeeId: emp.id,
      employeeName: employeeName(emp),
      date: `${dates[0]} → ${dates[dates.length - 1]}`,
      message: `Repos hebdomadaire de ${hoursToReadable(restHours)} au lieu de ${LEGAL_LIMITS.WEEKLY_REST_HOURS}h minimum`,
      actualValue: hoursToReadable(restHours),
      legalLimit: `${LEGAL_LIMITS.WEEKLY_REST_HOURS}h`,
      relatedShiftIds: empShifts.map(s => s.id),
    });
  }

  return violations;
}

// ─── 2. Amplitude journalière 10h max ───

/**
 * L'amplitude = temps entre le début du premier shift et la fin du dernier shift
 * de la même journée. Maximum 10h.
 */
function validate10hDailyAmplitude(
  empShifts: Shift[],
  emp: Employee,
): LegalViolation[] {
  const violations: LegalViolation[] = [];
  const byDate = groupShiftsByDate(empShifts);

  for (const [date, dayShifts] of byDate.entries()) {
    const starts = dayShifts.map(s => timeToMinutes(s.start_time));
    const ends = dayShifts.map(s => timeToMinutes(s.end_time));

    const firstStart = Math.min(...starts);
    const lastEnd = Math.max(...ends);
    const amplitudeMinutes = lastEnd - firstStart;
    const amplitudeHours = amplitudeMinutes / 60;

    if (amplitudeHours > LEGAL_LIMITS.MAX_DAILY_AMPLITUDE_HOURS) {
      violations.push({
        id: nextViolationId(),
        type: 'amplitude_journaliere_10h',
        severity: 'critical',
        employeeId: emp.id,
        employeeName: employeeName(emp),
        date,
        message: `Amplitude de ${hoursToReadable(amplitudeHours)} le ${date} (max ${LEGAL_LIMITS.MAX_DAILY_AMPLITUDE_HOURS}h)`,
        actualValue: hoursToReadable(amplitudeHours),
        legalLimit: `${LEGAL_LIMITS.MAX_DAILY_AMPLITUDE_HOURS}h`,
        relatedShiftIds: dayShifts.map(s => s.id),
      });
    }
  }

  return violations;
}

// ─── 3. Durée hebdomadaire 48h max ───

/**
 * Le total d'heures effectives sur la semaine ne peut dépasser 48h.
 */
function validate48hWeeklyDuration(
  empShifts: Shift[],
  emp: Employee,
): LegalViolation[] {
  const violations: LegalViolation[] = [];
  const totalHours = empShifts.reduce((sum, s) => sum + s.effective_hours, 0);

  if (totalHours > LEGAL_LIMITS.MAX_WEEKLY_HOURS) {
    const dates = getSortedDates(empShifts);
    violations.push({
      id: nextViolationId(),
      type: 'duree_hebdomadaire_48h',
      severity: 'critical',
      employeeId: emp.id,
      employeeName: employeeName(emp),
      date: `${dates[0]} → ${dates[dates.length - 1]}`,
      message: `${hoursToReadable(totalHours)} travaillées cette semaine (max ${LEGAL_LIMITS.MAX_WEEKLY_HOURS}h)`,
      actualValue: hoursToReadable(totalHours),
      legalLimit: `${LEGAL_LIMITS.MAX_WEEKLY_HOURS}h`,
      relatedShiftIds: empShifts.map(s => s.id),
    });
  }

  return violations;
}

// ─── 4. Repos quotidien 11h min ───

/**
 * Entre la fin du dernier shift d'un jour et le début du premier shift
 * du jour suivant, il doit y avoir au minimum 11h de repos.
 */
function validate11hDailyRest(
  empShifts: Shift[],
  emp: Employee,
): LegalViolation[] {
  const violations: LegalViolation[] = [];
  const byDate = groupShiftsByDate(empShifts);
  const dates = getSortedDates(empShifts);

  for (let i = 0; i < dates.length - 1; i++) {
    const currentDate = dates[i];
    const nextDate = dates[i + 1];

    // Vérifier que les dates sont consécutives
    const d1 = parseLocalDate(currentDate);
    const d2 = parseLocalDate(nextDate);
    const daysBetween = Math.round(
      (d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (daysBetween !== 1) continue; // Pas de jours consécutifs → pas de vérification

    const currentShifts = byDate.get(currentDate) || [];
    const nextShifts = byDate.get(nextDate) || [];

    const lastEnd = Math.max(...currentShifts.map(s => timeToMinutes(s.end_time)));
    const firstStart = Math.min(...nextShifts.map(s => timeToMinutes(s.start_time)));

    // Repos = minutes restantes dans la journée + minutes avant le premier shift du lendemain
    const restMinutes = (24 * 60 - lastEnd) + firstStart;
    const restHours = restMinutes / 60;

    if (restHours < LEGAL_LIMITS.MIN_DAILY_REST_HOURS) {
      violations.push({
        id: nextViolationId(),
        type: 'repos_quotidien_11h',
        severity: 'critical',
        employeeId: emp.id,
        employeeName: employeeName(emp),
        date: `${currentDate} → ${nextDate}`,
        message: `Repos de ${hoursToReadable(restHours)} entre le ${currentDate} et le ${nextDate} (min ${LEGAL_LIMITS.MIN_DAILY_REST_HOURS}h)`,
        actualValue: hoursToReadable(restHours),
        legalLimit: `${LEGAL_LIMITS.MIN_DAILY_REST_HOURS}h`,
        relatedShiftIds: [
          ...currentShifts.map(s => s.id),
          ...nextShifts.map(s => s.id),
        ],
      });
    }
  }

  return violations;
}

// ─── 5. Pause obligatoire 20 min pour 6h+ ───

/**
 * Si un employé travaille plus de 6h continues sans pause >= 20 min,
 * c'est une violation.
 */
function validatePause6h(
  empShifts: Shift[],
  emp: Employee,
): LegalViolation[] {
  const violations: LegalViolation[] = [];
  const byDate = groupShiftsByDate(empShifts);

  for (const [date, dayShifts] of byDate.entries()) {
    // Un seul shift > 6h sans break_duration suffisant
    for (const shift of dayShifts) {
      if (
        shift.effective_hours >= LEGAL_LIMITS.CONTINUOUS_WORK_THRESHOLD_HOURS &&
        shift.break_duration < LEGAL_LIMITS.MIN_BREAK_MINUTES
      ) {
        violations.push({
          id: nextViolationId(),
          type: 'pause_6h',
          severity: 'warning',
          employeeId: emp.id,
          employeeName: employeeName(emp),
          date,
          message: `Travail de ${hoursToReadable(shift.effective_hours)} sans pause suffisante le ${date} (pause requise : ${LEGAL_LIMITS.MIN_BREAK_MINUTES} min)`,
          actualValue: `${shift.break_duration} min de pause`,
          legalLimit: `${LEGAL_LIMITS.MIN_BREAK_MINUTES} min`,
          relatedShiftIds: [shift.id],
        });
      }
    }

    // Si plusieurs shifts dans la journée, vérifier qu'il y a un gap >= 20 min
    if (dayShifts.length > 1) {
      const sorted = [...dayShifts].sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
      );
      const totalEffective = sorted.reduce((sum, s) => sum + s.effective_hours, 0);

      if (totalEffective >= LEGAL_LIMITS.CONTINUOUS_WORK_THRESHOLD_HOURS) {
        // Vérifier qu'il y a au moins un gap >= 20 min entre les shifts
        let hasAdequateBreak = false;
        for (let i = 0; i < sorted.length - 1; i++) {
          const endCurrent = timeToMinutes(sorted[i].end_time);
          const startNext = timeToMinutes(sorted[i + 1].start_time);
          if (startNext - endCurrent >= LEGAL_LIMITS.MIN_BREAK_MINUTES) {
            hasAdequateBreak = true;
            break;
          }
        }

        if (!hasAdequateBreak) {
          // Éviter les doublons avec la vérification shift individuel
          const alreadyReported = violations.some(
            v => v.type === 'pause_6h' && v.date === date && v.employeeId === emp.id,
          );
          if (!alreadyReported) {
            violations.push({
              id: nextViolationId(),
              type: 'pause_6h',
              severity: 'warning',
              employeeId: emp.id,
              employeeName: employeeName(emp),
              date,
              message: `${hoursToReadable(totalEffective)} travaillées le ${date} sans pause de ${LEGAL_LIMITS.MIN_BREAK_MINUTES} min entre les shifts`,
              actualValue: `${hoursToReadable(totalEffective)} sans pause`,
              legalLimit: `${LEGAL_LIMITS.MIN_BREAK_MINUTES} min`,
              relatedShiftIds: sorted.map(s => s.id),
            });
          }
        }
      }
    }
  }

  return violations;
}

// ─── Calcul du score de conformité ───

function computeScore(violations: LegalViolation[]): ComplianceScore {
  const bySeverity = { critical: 0, warning: 0, info: 0 };
  const byType: Record<ViolationType, number> = {
    repos_hebdomadaire_35h: 0,
    amplitude_journaliere_10h: 0,
    duree_hebdomadaire_48h: 0,
    repos_quotidien_11h: 0,
    pause_6h: 0,
  };

  for (const v of violations) {
    bySeverity[v.severity] += 1;
    byType[v.type] += 1;
  }

  // Score : part de 100 et pénalise selon sévérité
  // Critical = -15 points, Warning = -5 points, Info = -1 point
  const penalty =
    bySeverity.critical * 15 +
    bySeverity.warning * 5 +
    bySeverity.info * 1;

  const score = Math.max(0, Math.min(100, 100 - penalty));

  let label: string;
  let colorVar: string;
  if (score >= 90) {
    label = 'Excellent';
    colorVar = 'var(--color-success-500)';
  } else if (score >= 70) {
    label = 'Bon';
    colorVar = 'var(--color-success-600)';
  } else if (score >= 50) {
    label = 'Attention requise';
    colorVar = 'var(--color-warning-500)';
  } else if (score >= 30) {
    label = 'Non conforme';
    colorVar = 'var(--color-warning-600)';
  } else {
    label = 'Critique';
    colorVar = 'var(--color-danger-500)';
  }

  return {
    score,
    label,
    colorVar,
    totalViolations: violations.length,
    bySeverity,
    byType,
  };
}

// ─── Fonction principale : rapport complet ───

/**
 * Génère un rapport de conformité complet à partir des shifts et employés.
 * Fonction PURE — pas d'appel réseau.
 *
 * @param shifts - Tous les shifts de la période à analyser
 * @param employees - Tous les employés actifs
 * @param periodStart - Date de début (YYYY-MM-DD)
 * @param periodEnd - Date de fin (YYYY-MM-DD)
 */
export function generateComplianceReport(
  shifts: Shift[],
  employees: Employee[],
  periodStart: string,
  periodEnd: string,
): ComplianceReport {
  // Reset le compteur pour des IDs déterministes
  violationCounter = 0;

  const allViolations: LegalViolation[] = [];
  const employeeCompliance: EmployeeCompliance[] = [];

  // Index des employés par ID
  const empMap = new Map<string, Employee>();
  for (const emp of employees) {
    empMap.set(emp.id, emp);
  }

  // Grouper shifts par employé
  const shiftsByEmployee = groupShiftsByEmployee(shifts);

  // Analyser chaque employé
  for (const emp of employees) {
    const empShifts = shiftsByEmployee.get(emp.id) || [];
    const empViolations: LegalViolation[] = [];

    // Exécuter les 5 validations
    empViolations.push(...validate35hWeeklyRest(empShifts, emp));
    empViolations.push(...validate10hDailyAmplitude(empShifts, emp));
    empViolations.push(...validate48hWeeklyDuration(empShifts, emp));
    empViolations.push(...validate11hDailyRest(empShifts, emp));
    empViolations.push(...validatePause6h(empShifts, emp));

    // Calculer stats employé
    const weeklyHours = empShifts.reduce((sum, s) => sum + s.effective_hours, 0);
    const daysWorked = new Set(empShifts.map(s => s.date)).size;

    // Score individuel
    const empPenalty =
      empViolations.filter(v => v.severity === 'critical').length * 15 +
      empViolations.filter(v => v.severity === 'warning').length * 5 +
      empViolations.filter(v => v.severity === 'info').length * 1;
    const empScore = Math.max(0, Math.min(100, 100 - empPenalty));

    employeeCompliance.push({
      employee: emp,
      score: empScore,
      violations: empViolations,
      weeklyHours,
      daysWorked,
    });

    allViolations.push(...empViolations);
  }

  // Trier la conformité employé par score croissant (pire d'abord)
  employeeCompliance.sort((a, b) => a.score - b.score);

  // Score global
  const score = computeScore(allViolations);

  return {
    period: { start: periodStart, end: periodEnd },
    score,
    violations: allViolations,
    employeeCompliance,
    shiftsAnalyzed: shifts.length,
    employeesAnalyzed: employees.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Fonction rapide pour le widget dashboard ───

/**
 * Retourne juste le score et le nombre de violations
 * (version légère pour le widget dashboard, pas le rapport complet).
 */
export function quickComplianceCheck(
  shifts: Shift[],
  employees: Employee[],
): { score: number; label: string; colorVar: string; criticalCount: number; warningCount: number } {
  violationCounter = 0;

  const allViolations: LegalViolation[] = [];
  const empMap = new Map<string, Employee>();
  for (const emp of employees) {
    empMap.set(emp.id, emp);
  }

  const shiftsByEmployee = groupShiftsByEmployee(shifts);

  for (const emp of employees) {
    const empShifts = shiftsByEmployee.get(emp.id) || [];
    allViolations.push(...validate35hWeeklyRest(empShifts, emp));
    allViolations.push(...validate10hDailyAmplitude(empShifts, emp));
    allViolations.push(...validate48hWeeklyDuration(empShifts, emp));
    allViolations.push(...validate11hDailyRest(empShifts, emp));
    allViolations.push(...validatePause6h(empShifts, emp));
  }

  const scoreData = computeScore(allViolations);

  return {
    score: scoreData.score,
    label: scoreData.label,
    colorVar: scoreData.colorVar,
    criticalCount: scoreData.bySeverity.critical,
    warningCount: scoreData.bySeverity.warning,
  };
}
