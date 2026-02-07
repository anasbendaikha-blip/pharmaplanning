// ─── Types globaux Assistant Planning ───

export type WizardStep = 1 | 2 | 3 | 4;

export interface Shift {
  id: string;
  name: string;
  startTime: string; // Format HH:MM
  endTime: string;   // Format HH:MM
  roles: ShiftRoles;
}

export interface ShiftRoles {
  Pharmacien: RoleConfig;
  Preparateur: RoleConfig;
  Apprenti: RoleConfig;
  Etudiant: RoleConfig;
  Conditionneur: RoleConfig;
}

export interface RoleConfig {
  min: number; // Nombre minimum requis
  max: number; // Nombre maximum autorisé
}

export interface EmployeeConstraint {
  employeeId: string;
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  unavailableDates: string[];  // ISO dates
  preferredShifts: string[];   // IDs des shifts préférés
  restDays: number[];          // 0-6 (0=Lundi, 6=Dimanche)
}

export interface WizardConfig {
  // Step 1 - Période
  startDate: string;
  endDate: string;
  activeDays: boolean[]; // [Lun, Mar, Mer, Jeu, Ven, Sam, Dim]

  // Step 2 - Créneaux
  shifts: Shift[];

  // Step 3 - Contraintes employés
  employeeConstraints: Record<string, EmployeeConstraint>;

  // Step 4 - Résultats
  generatedSchedule: GeneratedSchedule | null;
}

export interface GeneratedSchedule {
  success: boolean;
  shifts: GeneratedShift[];
  stats: ScheduleStats;
  conflicts: Conflict[];
}

export interface GeneratedShift {
  id: string;
  date: string;
  shiftTemplateId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  hours: number;
}

export interface ScheduleStats {
  totalHours: number;
  totalShifts: number;
  coverageRate: number;    // 0-100%
  legalCompliance: number; // 0-100%
  balanceScore: number;    // Écart-type heures entre employés
}

export interface Conflict {
  type: 'error' | 'warning' | 'info';
  message: string;
  employeeName?: string;
  date?: string;
  solution?: string;
}
