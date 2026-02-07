// ============================================================
// Algorithme de Génération Intelligente de Planning
// ============================================================

import type {
  WizardConfig,
  GeneratedSchedule,
  GeneratedShift,
  Conflict,
  ScheduleStats,
  Shift as WizardShift,
} from './types';
import type { Employee } from '@/lib/types';
import { calculateShiftHours } from './validation';

// ─── Types internes ───

interface EmployeeWorkload {
  employeeId: string;
  totalHours: number;
  shiftsCount: number;
  weeklyHours: Record<string, number>; // Clé = ISO week "2025-W24"
}

// ─── Mapping catégorie Employee → rôle ShiftRoles ───

const CATEGORY_TO_SHIFT_ROLE: Record<string, string> = {
  pharmacien_titulaire: 'Pharmacien',
  pharmacien_adjoint: 'Pharmacien',
  preparateur: 'Preparateur',
  rayonniste: 'Conditionneur',
  apprenti: 'Apprenti',
  etudiant: 'Etudiant',
};

function employeeMatchesRole(emp: Employee, shiftRole: string): boolean {
  const mappedRole = CATEGORY_TO_SHIFT_ROLE[emp.category];
  return mappedRole === shiftRole;
}

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

export function generateSchedule(
  config: WizardConfig,
  employees: Employee[]
): GeneratedSchedule {
  const generatedShifts: GeneratedShift[] = [];
  const conflicts: Conflict[] = [];

  // Filtrer employés actifs
  const activeEmployees = employees.filter((e) => e.is_active);

  if (activeEmployees.length === 0) {
    return {
      success: false,
      shifts: [],
      stats: emptyStats(),
      conflicts: [{ type: 'error', message: 'Aucun employé actif disponible' }],
    };
  }

  // Initialiser workloads
  const workloads = new Map<string, EmployeeWorkload>();
  activeEmployees.forEach((emp) => {
    workloads.set(emp.id, {
      employeeId: emp.id,
      totalHours: 0,
      shiftsCount: 0,
      weeklyHours: {},
    });
  });

  // Générer dates de la période
  const dates = generateDateRange(config.startDate, config.endDate, config.activeDays);

  if (dates.length === 0) {
    return {
      success: false,
      shifts: [],
      stats: emptyStats(),
      conflicts: [{ type: 'error', message: 'Aucun jour ouvré dans la période sélectionnée' }],
    };
  }

  // ─── Pour chaque jour ───
  let shiftCounter = 0;

  for (const date of dates) {
    const weekKey = getISOWeek(date);

    // Pour chaque créneau configuré
    for (const shift of config.shifts) {
      const shiftHours = calculateShiftHours(shift.startTime, shift.endTime);

      // Pour chaque rôle du créneau
      for (const [roleName, roleConfig] of Object.entries(shift.roles)) {
        if (roleConfig.max === 0) continue;

        // Trouver employés éligibles pour ce rôle
        const eligible = findEligibleEmployees(
          activeEmployees,
          roleName,
          date,
          weekKey,
          shift,
          shiftHours,
          config,
          workloads,
          generatedShifts
        );

        if (eligible.length === 0 && roleConfig.min > 0) {
          conflicts.push({
            type: 'error',
            message: `Aucun ${roleName} disponible pour "${shift.name}"`,
            date,
            solution: 'Vérifier contraintes ou ajouter des employés',
          });
          continue;
        }

        if (eligible.length === 0) continue;

        // Calculer scores de priorité
        const scored = eligible.map((emp) => ({
          employee: emp,
          score: calculatePriorityScore(emp, shift, date, weekKey, config, workloads.get(emp.id)!),
        }));

        // Trier par score décroissant (meilleurs en premier)
        scored.sort((a, b) => b.score - a.score);

        // Assigner les meilleurs candidats (entre min et max)
        const toAssign = Math.min(roleConfig.max, scored.length);

        for (let i = 0; i < toAssign; i++) {
          const { employee } = scored[i];
          shiftCounter++;

          const generatedShift: GeneratedShift = {
            id: `gen-${shiftCounter}`,
            date,
            shiftTemplateId: shift.id,
            employeeId: employee.id,
            startTime: shift.startTime,
            endTime: shift.endTime,
            hours: shiftHours,
          };

          generatedShifts.push(generatedShift);

          // Mettre à jour workload
          const workload = workloads.get(employee.id)!;
          workload.totalHours += shiftHours;
          workload.shiftsCount += 1;
          if (!workload.weeklyHours[weekKey]) {
            workload.weeklyHours[weekKey] = 0;
          }
          workload.weeklyHours[weekKey] += shiftHours;
        }

        // Vérifier minimum respecté
        if (toAssign < roleConfig.min) {
          conflicts.push({
            type: 'warning',
            message: `Seulement ${toAssign}/${roleConfig.min} ${roleName} pour "${shift.name}"`,
            date,
            solution: 'Augmenter disponibilités ou réduire minimum requis',
          });
        }
      }
    }
  }

  // ─── Validation finale ───
  const finalConflicts = validateGeneratedSchedule(
    generatedShifts,
    activeEmployees,
    config,
    workloads
  );
  conflicts.push(...finalConflicts);

  // ─── Statistiques ───
  const stats = calculateStats(generatedShifts, activeEmployees, config, workloads, dates);

  const hasErrors = conflicts.some((c) => c.type === 'error');

  return {
    success: !hasErrors,
    shifts: generatedShifts,
    stats,
    conflicts,
  };
}

// ============================================================
// GÉNÉRATION DATES
// ============================================================

function generateDateRange(
  startDate: string,
  endDate: string,
  activeDays: boolean[]
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  const d = new Date(start);
  while (d <= end) {
    const dayIndex = (d.getDay() + 6) % 7; // Lundi = 0
    if (activeDays[dayIndex]) {
      // Format local YYYY-MM-DD (éviter bug timezone UTC)
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }
    d.setDate(d.getDate() + 1);
  }

  return dates;
}

function getISOWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayNum = date.getDay() || 7; // Dimanche = 7
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 4 - dayNum);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

// ============================================================
// FILTRAGE EMPLOYÉS ÉLIGIBLES
// ============================================================

function findEligibleEmployees(
  employees: Employee[],
  role: string,
  date: string,
  weekKey: string,
  shift: WizardShift,
  shiftHours: number,
  config: WizardConfig,
  workloads: Map<string, EmployeeWorkload>,
  existingShifts: GeneratedShift[]
): Employee[] {
  return employees.filter((emp) => {
    // 1. Vérifier rôle correspond
    if (!employeeMatchesRole(emp, role)) return false;

    const constraint = config.employeeConstraints[emp.id];

    // 2. Vérifier jour de repos fixe
    if (constraint) {
      const dateObj = new Date(date + 'T00:00:00');
      const dayIndex = (dateObj.getDay() + 6) % 7; // Lundi = 0
      if (constraint.restDays.includes(dayIndex)) return false;
    }

    // 3. Vérifier indisponibilité spécifique
    if (constraint && constraint.unavailableDates.includes(date)) return false;

    // 4. Vérifier pas déjà assigné sur ce créneau ce jour
    const alreadyOnShift = existingShifts.some(
      (s) => s.employeeId === emp.id && s.date === date && s.shiftTemplateId === shift.id
    );
    if (alreadyOnShift) return false;

    // 5. Vérifier amplitude max 10h/jour
    const todayHours = existingShifts
      .filter((s) => s.employeeId === emp.id && s.date === date)
      .reduce((sum, s) => sum + s.hours, 0);
    if (todayHours + shiftHours > 10) return false;

    // 6. Vérifier heures max semaine (48h légal)
    const workload = workloads.get(emp.id)!;
    const weekHours = workload.weeklyHours[weekKey] || 0;
    if (weekHours + shiftHours > 48) return false;

    // 7. Vérifier heures max personnalisées
    if (constraint && weekHours + shiftHours > constraint.maxHoursPerWeek) return false;

    return true;
  });
}

// ============================================================
// SYSTÈME DE SCORING
// ============================================================

function calculatePriorityScore(
  employee: Employee,
  shift: WizardShift,
  _date: string,
  weekKey: string,
  config: WizardConfig,
  workload: EmployeeWorkload
): number {
  let score = 0;
  const constraint = config.employeeConstraints[employee.id];

  if (!constraint) return 100; // Score neutre par défaut

  const weekHours = workload.weeklyHours[weekKey] || 0;

  // PRIORITÉ 1 : Employé en dessous de son minimum (poids ×20)
  // Favorise fortement les employés qui n'ont pas atteint leur minimum
  if (weekHours < constraint.minHoursPerWeek) {
    const underMin = constraint.minHoursPerWeek - weekHours;
    score += underMin * 20;
  }

  // PRIORITÉ 2 : Équilibrage heures (poids ×10)
  // Plus l'employé a de marge avant son max, plus il est favorisé
  const hoursGap = constraint.maxHoursPerWeek - weekHours;
  score += hoursGap * 10;

  // PRIORITÉ 3 : Préférence créneau (+50)
  if (constraint.preferredShifts.includes(shift.id)) {
    score += 50;
  }

  // PRIORITÉ 4 : Rôle critique - Pharmacien titulaire (+30)
  if (employee.category === 'pharmacien_titulaire') {
    score += 30;
  }

  // PRIORITÉ 5 : Rotation équitable (poids ×2)
  // Favorise les employés avec moins de shifts déjà assignés
  score += Math.max(0, 20 - workload.shiftsCount) * 2;

  // PRIORITÉ 6 : Heures contractuelles
  // Favorise les employés dont les heures contractuelles sont élevées
  // (ils ont plus besoin de travailler)
  const contractRatio = employee.contract_hours > 0
    ? Math.max(0, (employee.contract_hours - workload.totalHours) / employee.contract_hours)
    : 0;
  score += contractRatio * 15;

  return score;
}

// ============================================================
// VALIDATION FINALE
// ============================================================

function validateGeneratedSchedule(
  shifts: GeneratedShift[],
  employees: Employee[],
  config: WizardConfig,
  workloads: Map<string, EmployeeWorkload>
): Conflict[] {
  const conflicts: Conflict[] = [];

  // 1. Vérifier heures minimum par employé
  employees.forEach((emp) => {
    const constraint = config.employeeConstraints[emp.id];
    if (!constraint) return;

    const workload = workloads.get(emp.id)!;
    const weeks = Object.keys(workload.weeklyHours).length;
    if (weeks === 0) return;

    const avgWeeklyHours = workload.totalHours / weeks;

    if (avgWeeklyHours < constraint.minHoursPerWeek * 0.8) {
      // Tolérance 20% en dessous du min
      conflicts.push({
        type: 'warning',
        message: `Heures insuffisantes (${Math.round(avgWeeklyHours)}h moy/sem vs ${constraint.minHoursPerWeek}h min)`,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        solution: 'Ajuster contraintes ou augmenter créneaux disponibles',
      });
    }
  });

  // 2. Vérifier amplitude 10h max par jour
  const shiftsByEmpDay = new Map<string, number>();
  shifts.forEach((s) => {
    const key = `${s.employeeId}|${s.date}`;
    shiftsByEmpDay.set(key, (shiftsByEmpDay.get(key) || 0) + s.hours);
  });

  shiftsByEmpDay.forEach((totalHours, key) => {
    if (totalHours > 10) {
      const [empId, date] = key.split('|');
      const emp = employees.find((e) => e.id === empId);
      conflicts.push({
        type: 'error',
        message: `Amplitude > 10h : ${totalHours.toFixed(1)}h`,
        employeeName: emp ? `${emp.first_name} ${emp.last_name}` : empId,
        date,
        solution: 'Réduire nombre de shifts ce jour',
      });
    }
  });

  // 3. Vérifier 48h max par semaine
  employees.forEach((emp) => {
    const workload = workloads.get(emp.id)!;
    Object.entries(workload.weeklyHours).forEach(([week, hours]) => {
      if (hours > 48) {
        conflicts.push({
          type: 'error',
          message: `Semaine ${week} : ${hours.toFixed(1)}h (> 48h légal)`,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          solution: 'Réduire shifts cette semaine',
        });
      }
    });
  });

  // 4. Vérifier qu'on a au moins 1 pharmacien par jour
  const shiftsByDate = new Map<string, GeneratedShift[]>();
  shifts.forEach((s) => {
    if (!shiftsByDate.has(s.date)) shiftsByDate.set(s.date, []);
    shiftsByDate.get(s.date)!.push(s);
  });

  shiftsByDate.forEach((dayShifts, date) => {
    const pharmacistShifts = dayShifts.filter((s) => {
      const emp = employees.find((e) => e.id === s.employeeId);
      return emp && (emp.category === 'pharmacien_titulaire' || emp.category === 'pharmacien_adjoint');
    });

    if (pharmacistShifts.length === 0) {
      conflicts.push({
        type: 'error',
        message: 'Aucun pharmacien planifié (obligation légale)',
        date,
        solution: 'Un pharmacien doit être présent chaque jour d\'ouverture',
      });
    }
  });

  return conflicts;
}

// ============================================================
// CALCUL STATISTIQUES
// ============================================================

function calculateStats(
  shifts: GeneratedShift[],
  employees: Employee[],
  config: WizardConfig,
  workloads: Map<string, EmployeeWorkload>,
  dates: string[]
): ScheduleStats {
  // Total
  const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const totalShifts = shifts.length;

  // Couverture : shifts assignés vs slots théoriques (min requis)
  const expectedMinShifts = dates.length * config.shifts.reduce((sum, shift) => {
    return sum + Object.values(shift.roles).reduce((roleSum, role) => roleSum + role.min, 0);
  }, 0);
  const coverageRate = expectedMinShifts > 0
    ? Math.round((totalShifts / expectedMinShifts) * 100)
    : 100;

  // Conformité légale
  let legalChecks = 0;
  let legalPassed = 0;

  workloads.forEach((workload, empId) => {
    const constraint = config.employeeConstraints[empId];

    // Check 48h max/semaine
    Object.values(workload.weeklyHours).forEach((hours) => {
      legalChecks++;
      if (hours <= 48) legalPassed++;
    });

    // Check heures min respectées
    if (constraint) {
      const weeks = Object.keys(workload.weeklyHours).length;
      if (weeks > 0) {
        legalChecks++;
        const avg = workload.totalHours / weeks;
        if (avg >= constraint.minHoursPerWeek * 0.8) legalPassed++;
      }
    }
  });

  const legalCompliance = legalChecks > 0
    ? Math.round((legalPassed / legalChecks) * 100)
    : 100;

  // Équilibrage : écart-type des heures totales
  const hoursList = Array.from(workloads.values())
    .map((w) => w.totalHours)
    .filter((h) => h > 0); // Exclure employés non planifiés

  let balanceScore = 0;
  if (hoursList.length > 1) {
    const avg = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
    const variance = hoursList.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hoursList.length;
    balanceScore = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalShifts,
    coverageRate: Math.min(coverageRate, 100),
    legalCompliance: Math.max(0, Math.min(100, legalCompliance)),
    balanceScore,
  };
}

function emptyStats(): ScheduleStats {
  return {
    totalHours: 0,
    totalShifts: 0,
    coverageRate: 0,
    legalCompliance: 100,
    balanceScore: 0,
  };
}
