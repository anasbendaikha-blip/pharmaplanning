/**
 * Calculateur d'heures et gardes — Analytics V2
 *
 * Calcul heures normales vs supplementaires, detection gardes,
 * analyse equite distribution. Pas de date-fns, natif uniquement.
 */

// ─── Types ───

export interface HoursSplit {
  employeeId: string;
  employeeName: string;
  role: string;
  weekStart: string;
  contractHours: number;
  normalHours: number;
  overtimeHours: number;
  totalHours: number;
  compliance: 'OK' | 'OVERTIME' | 'UNDERTIME';
  overtimeRate?: '25%' | '50%';
  warning?: string;
}

export interface GuardInfo {
  employeeId: string;
  employeeName: string;
  role: string;
  month: string;
  eveningGuards: number;
  nightGuards: number;
  sundayGuards: number;
  totalGuards: number;
  totalGuardHours: number;
  distribution: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface OvertimeStats {
  totalOvertimeHours: number;
  employeesWithOvertime: number;
  weeksAnalyzed: number;
  maxWeeklyHours: number;
  complianceIssues: number;
}

export interface GuardStats {
  totalGuards: number;
  avgGuardsPerEmployee: number;
  imbalancedEmployees: number;
  eveningTotal: number;
  nightTotal: number;
  sundayTotal: number;
}

// ─── Date helpers (pas de date-fns) ───

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// ─── Calcul duree shift ───

export function calculateShiftDuration(
  startTime: string,
  endTime: string,
  pauseMinutes: number = 0,
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + (startM || 0);
  let endMinutes = endH * 60 + (endM || 0);

  // Si end < start, shift passe minuit
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const totalMinutes = endMinutes - startMinutes - pauseMinutes;
  return Math.max(0, totalMinutes / 60);
}

// ─── Detection type garde ───

export function detectGuardType(
  endTime: string,
  dayOfWeek: number,
): 'evening' | 'night' | 'sunday' | null {
  // Dimanche (dayOfWeek === 0 dans JS)
  if (dayOfWeek === 0) {
    return 'sunday';
  }

  const [endH] = endTime.split(':').map(Number);

  // Garde nuit: termine apres 23h ou shift de nuit (0h-6h)
  if (endTime >= '23:00' || (endH >= 0 && endH < 6 && endTime < '06:00')) {
    return 'night';
  }

  // Garde soir: termine entre 20h30 et 23h
  if (endTime >= '20:30' && endTime < '23:00') {
    return 'evening';
  }

  return null;
}

// ─── Calcul heures hebdomadaires par employe (serveur) ───

interface ShiftRow {
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number | null;
  type: string | null;
}

interface EmployeeRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name?: string;
  role: string;
  contract_hours: number | null;
}

export function computeWeeklyHoursSplit(
  employee: EmployeeRow,
  shifts: ShiftRow[],
  weekStartStr: string,
): HoursSplit {
  const contractHours = employee.contract_hours || 35;
  const employeeName = (employee.first_name && employee.last_name)
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : employee.name || 'Inconnu';

  // Calculer total heures travaillees
  let totalWorked = 0;
  for (const shift of shifts) {
    // Utiliser le champ hours si disponible, sinon calculer
    if (shift.hours && shift.hours > 0) {
      totalWorked += shift.hours;
    } else if (shift.start_time && shift.end_time) {
      totalWorked += calculateShiftDuration(shift.start_time, shift.end_time);
    }
  }

  // Split normales vs sup
  const normalHours = Math.min(totalWorked, contractHours);
  const overtimeHours = Math.max(0, totalWorked - contractHours);

  // Taux majore (droit du travail francais pharmacie)
  let overtimeRate: '25%' | '50%' | undefined;
  if (overtimeHours > 0) {
    // 8 premieres heures sup (36h-43h) = 25%
    // Au-dela de 43h = 50%
    overtimeRate = totalWorked <= 43 ? '25%' : '50%';
  }

  // Conformite
  let compliance: 'OK' | 'OVERTIME' | 'UNDERTIME' = 'OK';
  let warning: string | undefined;

  if (totalWorked > 48) {
    compliance = 'OVERTIME';
    warning = `Depasse limite legale 48h/semaine (${Math.round(totalWorked * 10) / 10}h)`;
  } else if (overtimeHours > 0) {
    compliance = 'OVERTIME';
    warning = `Heures sup : ${Math.round(overtimeHours * 10) / 10}h`;
  } else if (totalWorked > 0 && totalWorked < contractHours * 0.8) {
    compliance = 'UNDERTIME';
    warning = `Sous-utilise : ${Math.round(totalWorked * 10) / 10}h / ${contractHours}h`;
  }

  return {
    employeeId: employee.id,
    employeeName,
    role: employee.role || '',
    weekStart: weekStartStr,
    contractHours,
    normalHours: Math.round(normalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalHours: Math.round(totalWorked * 100) / 100,
    compliance,
    overtimeRate,
    warning,
  };
}

// ─── Calcul gardes mensuelles par employe ───

export function computeMonthlyGuards(
  employee: EmployeeRow,
  shifts: ShiftRow[],
  monthStr: string,
): GuardInfo {
  const employeeName = (employee.first_name && employee.last_name)
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : employee.name || 'Inconnu';

  const counts = {
    evening: 0,
    night: 0,
    sunday: 0,
    total: 0,
    totalHours: 0,
  };

  for (const shift of shifts) {
    const shiftDate = new Date(shift.date + 'T12:00:00');
    const dayOfWeek = shiftDate.getDay();

    // Detecter si c'est un shift de type garde explicite
    const isExplicitGarde = shift.type === 'garde' || shift.type === 'astreinte';

    // Ou detecter par horaire (soir/nuit/dimanche)
    const guardType = detectGuardType(shift.end_time, dayOfWeek);

    if (isExplicitGarde || guardType) {
      counts.total++;

      const duration = (shift.hours && shift.hours > 0)
        ? shift.hours
        : calculateShiftDuration(shift.start_time, shift.end_time);
      counts.totalHours += duration;

      if (dayOfWeek === 0) {
        counts.sunday++;
      } else if (guardType === 'night' || (isExplicitGarde && !guardType)) {
        counts.night++;
      } else if (guardType === 'evening') {
        counts.evening++;
      }
    }
  }

  return {
    employeeId: employee.id,
    employeeName,
    role: employee.role || '',
    month: monthStr,
    eveningGuards: counts.evening,
    nightGuards: counts.night,
    sundayGuards: counts.sunday,
    totalGuards: counts.total,
    totalGuardHours: Math.round(counts.totalHours * 100) / 100,
    distribution: 'NORMAL', // sera recalcule par analyzeGuardDistribution
  };
}

// ─── Analyse equite distribution gardes ───

export function analyzeGuardDistribution(guardInfos: GuardInfo[]): GuardInfo[] {
  if (guardInfos.length === 0) return [];

  const withGuards = guardInfos.filter(g => g.totalGuards > 0);
  if (withGuards.length === 0) return guardInfos;

  const avgGuards = guardInfos.reduce((sum, g) => sum + g.totalGuards, 0) / guardInfos.length;

  return guardInfos.map(info => {
    let distribution: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL';

    if (avgGuards > 0) {
      if (info.totalGuards < avgGuards * 0.6) {
        distribution = 'LOW';
      } else if (info.totalGuards > avgGuards * 1.4) {
        distribution = 'HIGH';
      }
    }

    return { ...info, distribution };
  });
}

// ─── Utilitaires pour les API routes ───

export { toDateStr, getMonday, addDays, startOfMonth, endOfMonth };
