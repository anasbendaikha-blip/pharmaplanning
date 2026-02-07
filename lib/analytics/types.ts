/**
 * Types Analytics — Sprint 3
 *
 * Types pour le dashboard analytics, KPIs, graphiques et exports.
 */

// ─── KPI ───

export interface KPIMetric {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number; // % variation vs periode precedente
  previousValue: number;
}

// ─── Time Series ───

export interface TimeSeriesData {
  label: string; // ex: "Sem. 4", "Lun", "Jan"
  value: number;
  value2?: number; // pour comparaison (ex: periode precedente)
}

// ─── Employee Analytics ───

export interface EmployeeAnalytics {
  employeeId: string;
  employeeName: string;
  role: string;
  totalHours: number;
  contractHours: number;
  shiftsCount: number;
  overtime: number;
  leaveDays: number;
  complianceRate: number;
}

// ─── Period ───

export type AnalyticsPeriod = '7d' | '30d' | '90d' | '12m';

export interface AnalyticsPeriodRange {
  start: string; // ISO date
  end: string;
  previousStart: string; // periode precedente pour comparaison
  previousEnd: string;
}

// ─── Charts ───

export interface ChartDataset {
  label: string;
  data: TimeSeriesData[];
  color?: string;
}

// ─── Predictions ───

export interface Prediction {
  type: 'trend' | 'recommendation' | 'alert';
  title: string;
  description: string;
  confidence: number; // 0-100
  metric?: string;
  predictedValue?: number;
}

// ─── Distribution ───

export interface DistributionItem {
  name: string;
  value: number;
  color: string;
}

// ─── Dashboard ───

export interface AnalyticsDashboard {
  period: AnalyticsPeriodRange;
  kpis: {
    totalHours: KPIMetric;
    totalShifts: KPIMetric;
    averageHoursPerEmployee: KPIMetric;
    overtimeHours: KPIMetric;
    leaveDays: KPIMetric;
    complianceRate: KPIMetric;
  };
  charts: {
    hoursPerWeek: TimeSeriesData[];
    shiftsPerDay: TimeSeriesData[];
    hoursPerEmployee: EmployeeAnalytics[];
    shiftTypeDistribution: DistributionItem[];
    leaveTypeDistribution: DistributionItem[];
  };
  predictions: Prediction[];
  topEmployees: EmployeeAnalytics[];
}

// ─── Filters ───

export interface AnalyticsFilters {
  period: AnalyticsPeriod;
  employeeId?: string;
  role?: string;
}

// ─── Report ───

export interface AnalyticsReport {
  title: string;
  generatedAt: string;
  organizationName: string;
  period: AnalyticsPeriodRange;
  kpis: AnalyticsDashboard['kpis'];
  charts: AnalyticsDashboard['charts'];
  predictions: Prediction[];
}
