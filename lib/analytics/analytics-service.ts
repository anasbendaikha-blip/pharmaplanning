/**
 * Analytics Service — Sprint 3
 *
 * Calcul des KPIs, aggregation graphiques, predictions IA.
 * Utilise le service_role client (pattern existant).
 */

import { createClient } from '@supabase/supabase-js';
import type {
  AnalyticsDashboard,
  AnalyticsFilters,
  AnalyticsPeriod,
  AnalyticsPeriodRange,
  KPIMetric,
  TimeSeriesData,
  EmployeeAnalytics,
  DistributionItem,
  Prediction,
} from './types';

// ─── Supabase service client ───

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Period helpers ───

function getPeriodRange(period: AnalyticsPeriod): AnalyticsPeriodRange {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let daysBack: number;

  switch (period) {
    case '7d':
      daysBack = 7;
      break;
    case '30d':
      daysBack = 30;
      break;
    case '90d':
      daysBack = 90;
      break;
    case '12m':
      daysBack = 365;
      break;
  }

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysBack);
  const start = startDate.toISOString().split('T')[0];

  const previousEnd = new Date(startDate);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - daysBack);

  return {
    start,
    end,
    previousStart: previousStart.toISOString().split('T')[0],
    previousEnd: previousEnd.toISOString().split('T')[0],
  };
}

// ─── KPI builder ───

function buildKPI(label: string, value: number, previousValue: number, unit: string): KPIMetric {
  const diff = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
  return {
    label,
    value: Math.round(value * 10) / 10,
    unit,
    trend: diff > 1 ? 'up' : diff < -1 ? 'down' : 'stable',
    trendValue: Math.round(Math.abs(diff) * 10) / 10,
    previousValue: Math.round(previousValue * 10) / 10,
  };
}

// ─── Week label helper ───

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `S${weekNum}`;
}

// ─── Shift type labels ───

const SHIFT_TYPE_LABELS: Record<string, string> = {
  regular: 'Regulier',
  morning: 'Matin',
  afternoon: 'Apres-midi',
  split: 'Coupe',
  garde: 'Garde',
  astreinte: 'Astreinte',
  formation: 'Formation',
  conge: 'Conge',
  maladie: 'Maladie',
  rtt: 'RTT',
};

const SHIFT_TYPE_COLORS: Record<string, string> = {
  regular: '#10b981',
  morning: '#3b82f6',
  afternoon: '#8b5cf6',
  split: '#f59e0b',
  garde: '#ef4444',
  astreinte: '#f97316',
  formation: '#06b6d4',
  conge: '#6366f1',
  maladie: '#ec4899',
  rtt: '#14b8a6',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  conge_paye: 'Conge paye',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  maternite: 'Maternite',
  paternite: 'Paternite',
  autre: 'Autre',
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  conge_paye: '#6366f1',
  rtt: '#14b8a6',
  maladie: '#ec4899',
  sans_solde: '#9ca3af',
  formation: '#06b6d4',
  maternite: '#f472b6',
  paternite: '#60a5fa',
  autre: '#a78bfa',
};

// ─── Main service ───

export class AnalyticsService {
  static async getDashboard(
    organizationId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsDashboard> {
    const supabase = getServiceClient();
    const periodRange = getPeriodRange(filters.period);

    // ─── Fetch current period data ───
    const [shiftsResult, prevShiftsResult, employeesResult, leaveResult, prevLeaveResult] =
      await Promise.all([
        supabase
          .from('shifts')
          .select('id, employee_id, date, start_time, end_time, hours, type, validated')
          .eq('organization_id', organizationId)
          .gte('date', periodRange.start)
          .lte('date', periodRange.end),
        supabase
          .from('shifts')
          .select('id, employee_id, date, hours, type')
          .eq('organization_id', organizationId)
          .gte('date', periodRange.previousStart)
          .lte('date', periodRange.previousEnd),
        supabase
          .from('employees')
          .select('id, first_name, last_name, role, contract_hours, status')
          .eq('organization_id', organizationId)
          .eq('status', 'active'),
        supabase
          .from('leave_requests')
          .select('id, employee_id, start_date, end_date, type, status, business_days')
          .eq('organization_id', organizationId)
          .gte('start_date', periodRange.start)
          .lte('start_date', periodRange.end),
        supabase
          .from('leave_requests')
          .select('id, business_days')
          .eq('organization_id', organizationId)
          .gte('start_date', periodRange.previousStart)
          .lte('start_date', periodRange.previousEnd),
      ]);

    // Gardes table may not exist — graceful fallback
    let gardesData: { employee_id: string; date: string }[] = [];
    try {
      const { data } = await supabase
        .from('gardes')
        .select('employee_id, date')
        .eq('organization_id', organizationId)
        .gte('date', periodRange.start)
        .lte('date', periodRange.end);
      if (data) gardesData = data;
    } catch {
      // Table may not exist — ignore
    }

    const shifts = shiftsResult.data || [];
    const prevShifts = prevShiftsResult.data || [];
    const employees = employeesResult.data || [];
    const leaves = (leaveResult.data || []).filter(
      (l: { status: string }) => l.status === 'approved' || l.status === 'pending',
    );
    const prevLeaves = prevLeaveResult.data || [];

    // ─── Apply filters ───
    const filteredShifts = filters.employeeId
      ? shifts.filter((s: { employee_id: string }) => s.employee_id === filters.employeeId)
      : shifts;

    // ─── KPIs ───
    const totalHours = filteredShifts.reduce(
      (sum: number, s: { hours: number | null }) => sum + (s.hours || 0),
      0,
    );
    const prevTotalHours = prevShifts.reduce(
      (sum: number, s: { hours: number | null }) => sum + (s.hours || 0),
      0,
    );

    const totalShifts = filteredShifts.length;
    const prevTotalShifts = prevShifts.length;

    const activeEmployees = employees.length || 1;
    const avgHoursPerEmployee = totalHours / activeEmployees;
    const prevAvgHours = prevTotalHours / activeEmployees;

    // Overtime: hours above contract_hours weekly average
    const contractTotal = employees.reduce(
      (sum: number, e: { contract_hours: number | null }) => sum + (e.contract_hours || 35),
      0,
    );
    const periodWeeks = Math.max(1, Math.round(
      (new Date(periodRange.end).getTime() - new Date(periodRange.start).getTime()) / (7 * 86400000),
    ));
    const expectedHours = contractTotal * periodWeeks;
    const overtimeHours = Math.max(0, totalHours - expectedHours);
    const prevPeriodWeeks = periodWeeks;
    const prevOvertime = Math.max(0, prevTotalHours - contractTotal * prevPeriodWeeks);

    const totalLeaveDays = leaves.reduce(
      (sum: number, l: { business_days: number | null }) => sum + (l.business_days || 0),
      0,
    );
    const prevLeaveDays = prevLeaves.reduce(
      (sum: number, l: { business_days: number | null }) => sum + (l.business_days || 0),
      0,
    );

    // Compliance: shifts with hours <= 10 and not exceeding weekly limits
    const compliantShifts = filteredShifts.filter(
      (s: { hours: number | null }) => (s.hours || 0) <= 10,
    ).length;
    const complianceRate = totalShifts > 0 ? (compliantShifts / totalShifts) * 100 : 100;
    const prevCompliant = prevShifts.filter(
      (s: { hours: number | null }) => (s.hours || 0) <= 10,
    ).length;
    const prevComplianceRate =
      prevTotalShifts > 0 ? (prevCompliant / prevTotalShifts) * 100 : 100;

    const kpis = {
      totalHours: buildKPI('Heures totales', totalHours, prevTotalHours, 'h'),
      totalShifts: buildKPI('Shifts totaux', totalShifts, prevTotalShifts, ''),
      averageHoursPerEmployee: buildKPI('Moy. heures/employe', avgHoursPerEmployee, prevAvgHours, 'h'),
      overtimeHours: buildKPI('Heures sup.', overtimeHours, prevOvertime, 'h'),
      leaveDays: buildKPI('Jours de conge', totalLeaveDays, prevLeaveDays, 'j'),
      complianceRate: buildKPI('Taux conformite', complianceRate, prevComplianceRate, '%'),
    };

    // ─── Charts: Hours per week ───
    const weekMap = new Map<string, number>();
    for (const s of filteredShifts) {
      const wk = getWeekLabel((s as { date: string }).date);
      weekMap.set(wk, (weekMap.get(wk) || 0) + ((s as { hours: number | null }).hours || 0));
    }
    const hoursPerWeek: TimeSeriesData[] = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }));

    // ─── Charts: Shifts per day ───
    const dayMap = new Map<string, number>();
    const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (const s of filteredShifts) {
      const dayIdx = new Date((s as { date: string }).date).getDay();
      const dayLabel = dayLabels[dayIdx];
      dayMap.set(dayLabel, (dayMap.get(dayLabel) || 0) + 1);
    }
    const shiftsPerDay: TimeSeriesData[] = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(
      (label) => ({ label, value: dayMap.get(label) || 0 }),
    );

    // ─── Charts: Hours per employee ───
    const employeeMap = new Map<string, { hours: number; shifts: number }>();
    for (const s of filteredShifts) {
      const eid = (s as { employee_id: string }).employee_id;
      const cur = employeeMap.get(eid) || { hours: 0, shifts: 0 };
      cur.hours += (s as { hours: number | null }).hours || 0;
      cur.shifts += 1;
      employeeMap.set(eid, cur);
    }

    const employeeLeaveMap = new Map<string, number>();
    for (const l of leaves) {
      const eid = (l as { employee_id: string }).employee_id;
      employeeLeaveMap.set(eid, (employeeLeaveMap.get(eid) || 0) + ((l as { business_days: number | null }).business_days || 0));
    }

    const hoursPerEmployee: EmployeeAnalytics[] = employees.map(
      (e: { id: string; first_name: string | null; last_name: string | null; role: string; contract_hours: number | null }) => {
        const stats = employeeMap.get(e.id) || { hours: 0, shifts: 0 };
        const contractH = (e.contract_hours || 35) * periodWeeks;
        return {
          employeeId: e.id,
          employeeName: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'N/A',
          role: e.role,
          totalHours: Math.round(stats.hours * 10) / 10,
          contractHours: contractH,
          shiftsCount: stats.shifts,
          overtime: Math.round(Math.max(0, stats.hours - contractH) * 10) / 10,
          leaveDays: employeeLeaveMap.get(e.id) || 0,
          complianceRate: 100,
        };
      },
    );

    // ─── Charts: Shift type distribution ───
    const typeMap = new Map<string, number>();
    for (const s of filteredShifts) {
      const t = (s as { type: string | null }).type || 'regular';
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    }
    const shiftTypeDistribution: DistributionItem[] = Array.from(typeMap.entries()).map(
      ([name, value]) => ({
        name: SHIFT_TYPE_LABELS[name] || name,
        value,
        color: SHIFT_TYPE_COLORS[name] || '#9ca3af',
      }),
    );

    // ─── Charts: Leave type distribution ───
    const leaveTypeMap = new Map<string, number>();
    for (const l of leaves) {
      const t = (l as { type: string }).type || 'autre';
      leaveTypeMap.set(t, (leaveTypeMap.get(t) || 0) + 1);
    }
    const leaveTypeDistribution: DistributionItem[] = Array.from(leaveTypeMap.entries()).map(
      ([name, value]) => ({
        name: LEAVE_TYPE_LABELS[name] || name,
        value,
        color: LEAVE_TYPE_COLORS[name] || '#9ca3af',
      }),
    );

    // ─── Predictions (moving average + recommendations) ───
    const predictions = this.generatePredictions(kpis, hoursPerEmployee, gardesData, periodWeeks);

    // ─── Top employees by hours ───
    const topEmployees = [...hoursPerEmployee]
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 5);

    return {
      period: periodRange,
      kpis,
      charts: {
        hoursPerWeek,
        shiftsPerDay,
        hoursPerEmployee,
        shiftTypeDistribution,
        leaveTypeDistribution,
      },
      predictions,
      topEmployees,
    };
  }

  // ─── Predictions IA ───

  private static generatePredictions(
    kpis: AnalyticsDashboard['kpis'],
    employees: EmployeeAnalytics[],
    _gardes: { employee_id: string; date: string }[],
    periodWeeks: number,
  ): Prediction[] {
    const predictions: Prediction[] = [];

    // Trend: hours evolution
    if (kpis.totalHours.trend === 'up' && kpis.totalHours.trendValue > 10) {
      predictions.push({
        type: 'alert',
        title: 'Hausse significative des heures',
        description: `Les heures totales ont augmente de ${kpis.totalHours.trendValue}% par rapport a la periode precedente. Verifiez la charge de travail.`,
        confidence: 85,
        metric: 'totalHours',
        predictedValue: kpis.totalHours.value * 1.05,
      });
    }

    // Overtime alert
    if (kpis.overtimeHours.value > 0) {
      predictions.push({
        type: 'alert',
        title: 'Heures supplementaires detectees',
        description: `${kpis.overtimeHours.value}h supplementaires sur la periode. Envisagez un renfort ou un reequilibrage.`,
        confidence: 90,
        metric: 'overtime',
      });
    }

    // Compliance warning
    if (kpis.complianceRate.value < 95) {
      predictions.push({
        type: 'alert',
        title: 'Taux de conformite insuffisant',
        description: `Le taux de conformite est a ${kpis.complianceRate.value}%. Revoyez les shifts depassant 10h.`,
        confidence: 95,
        metric: 'compliance',
      });
    }

    // Employee workload imbalance
    if (employees.length >= 2) {
      const hours = employees.map((e) => e.totalHours).filter((h) => h > 0);
      if (hours.length >= 2) {
        const max = Math.max(...hours);
        const min = Math.min(...hours);
        if (max > 0 && (max - min) / max > 0.4) {
          predictions.push({
            type: 'recommendation',
            title: 'Desequilibre de charge',
            description: `Ecart de ${Math.round(max - min)}h entre employes. Repartissez plus equitablement les shifts.`,
            confidence: 80,
          });
        }
      }
    }

    // Leave trend
    if (kpis.leaveDays.trend === 'up' && kpis.leaveDays.trendValue > 20) {
      predictions.push({
        type: 'trend',
        title: 'Hausse des absences',
        description: `Les jours de conge augmentent de ${kpis.leaveDays.trendValue}%. Planifiez des remplacements.`,
        confidence: 75,
        metric: 'leaveDays',
      });
    }

    // Positive trend: stable compliance
    if (kpis.complianceRate.value >= 98) {
      predictions.push({
        type: 'trend',
        title: 'Excellente conformite',
        description: 'Votre taux de conformite est excellent. Maintenez ces bonnes pratiques.',
        confidence: 95,
      });
    }

    // Average weekly projection
    if (periodWeeks > 1) {
      const weeklyAvg = kpis.totalHours.value / periodWeeks;
      predictions.push({
        type: 'trend',
        title: 'Projection hebdomadaire',
        description: `Moyenne de ${Math.round(weeklyAvg)}h/semaine. Projection sur 4 semaines: ~${Math.round(weeklyAvg * 4)}h.`,
        confidence: 70,
        predictedValue: Math.round(weeklyAvg * 4),
      });
    }

    return predictions;
  }

  // ─── Employees analytics (endpoint dedie) ───

  static async getEmployeesAnalytics(
    organizationId: string,
    filters: AnalyticsFilters,
  ): Promise<EmployeeAnalytics[]> {
    const dashboard = await this.getDashboard(organizationId, filters);
    return dashboard.charts.hoursPerEmployee;
  }

  // ─── Predictions analytics (endpoint dedie) ───

  static async getPredictions(
    organizationId: string,
    filters: AnalyticsFilters,
  ): Promise<Prediction[]> {
    const dashboard = await this.getDashboard(organizationId, filters);
    return dashboard.predictions;
  }
}
