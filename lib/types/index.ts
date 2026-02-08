/**
 * Exports centralisés des types PharmaPlanning
 */

// Organization (multi-tenant)
export type {
  Organization,
  OrganizationSettings,
  WeeklyOpeningHours,
  DayOpeningHours,
  TimeSlot,
  EmployeeCategory,
  SubscriptionPlan,
  UserOrganization,
  OrganizationRole,
} from './organization';

// Employee
export type {
  Employee,
  EmployeeRole,
  ContractType,
  Availability,
  AvailabilityType,
  EmployeePreferences,
  EmployeeSummary,
  EmployeeWeeklyStats,
} from './employee';

// Planning
export type {
  Shift,
  ShiftType,
  ShiftStatus,
  WeeklyPlanning,
  PlanningStatus,
  WeeklyPlanningStats,
  Conflict,
  ConflictType,
  ConflictSeverity,
  PlanningCell,
  ShiftTemplate,
} from './planning';

// Disponibilités (Planning V2)
export type {
  Disponibilite,
  DispoType,
  DispoStatus,
  DispoAlert,
  DispoStats,
  DispoTimelineItem,
} from './disponibilite';

// Quick Assign (Planning V2 Phase 3)
export type {
  QuickAssignPanelProps,
  SuggestedSlot,
  QuickAssignState,
  ValidationResult,
  ValidationMessage,
  QuickAssignTarget,
} from './quick-assign';

// Gardes
export type {
  GardeDuty,
  GardeType,
  GardeStatus,
  MonthlyGardeSchedule,
  GardeStats,
  GardeDistribution,
  JourFerie,
  GardeRotation,
} from './garde';
