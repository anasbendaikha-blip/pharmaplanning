/**
 * API Route — GET /api/analytics/overtime
 *
 * Calcule les heures normales vs supplementaires pour chaque employe
 * sur les N dernieres semaines. Utilise le service_role.
 *
 * Params: organizationId (requis), weeks (defaut 4)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  computeWeeklyHoursSplit,
  getMonday,
  addDays,
  toDateStr,
} from '@/lib/analytics/hours-calculator';
import type { HoursSplit, OvertimeStats } from '@/lib/analytics/hours-calculator';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const weeksCount = parseInt(searchParams.get('weeks') || '4', 10);

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Employes actifs
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, name, role, contract_hours')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('name');

    if (empError) {
      console.error('Erreur employes:', empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ results: [], stats: { totalOvertimeHours: 0, employeesWithOvertime: 0, weeksAnalyzed: weeksCount, maxWeeklyHours: 0, complianceIssues: 0 } });
    }

    // Calculer la plage de dates couvrant les N dernieres semaines
    const now = new Date();
    const currentMonday = getMonday(now);
    const firstMonday = addDays(currentMonday, -(weeksCount - 1) * 7);
    const lastSunday = addDays(currentMonday, 6);

    const rangeStart = toDateStr(firstMonday);
    const rangeEnd = toDateStr(lastSunday);

    // Charger tous les shifts de la plage en un seul appel
    const { data: allShifts, error: shiftError } = await supabase
      .from('shifts')
      .select('employee_id, date, start_time, end_time, hours, type')
      .eq('organization_id', organizationId)
      .gte('date', rangeStart)
      .lte('date', rangeEnd)
      .order('date');

    if (shiftError) {
      console.error('Erreur shifts:', shiftError);
      return NextResponse.json({ error: shiftError.message }, { status: 500 });
    }

    const shifts = allShifts || [];

    // Calculer pour chaque employe x semaine
    const results: HoursSplit[] = [];

    for (let weekOffset = 0; weekOffset < weeksCount; weekOffset++) {
      const weekStart = addDays(currentMonday, -weekOffset * 7);
      const weekEnd = addDays(weekStart, 6);
      const weekStartStr = toDateStr(weekStart);
      const weekEndStr = toDateStr(weekEnd);

      for (const emp of employees) {
        // Filtrer les shifts de cet employe pour cette semaine
        const empWeekShifts = shifts.filter(
          s => s.employee_id === emp.id && s.date >= weekStartStr && s.date <= weekEndStr,
        );

        const split = computeWeeklyHoursSplit(emp, empWeekShifts, weekStartStr);
        results.push(split);
      }
    }

    // Stats globales
    const employeesWithOvertimeSet = new Set(
      results.filter(r => r.overtimeHours > 0).map(r => r.employeeId),
    );

    const stats: OvertimeStats = {
      totalOvertimeHours: Math.round(results.reduce((sum, r) => sum + r.overtimeHours, 0) * 10) / 10,
      employeesWithOvertime: employeesWithOvertimeSet.size,
      weeksAnalyzed: weeksCount,
      maxWeeklyHours: Math.round(Math.max(...results.map(r => r.totalHours), 0) * 10) / 10,
      complianceIssues: results.filter(r => r.compliance === 'OVERTIME' && r.totalHours > 48).length,
    };

    return NextResponse.json({ results, stats, employees });
  } catch (error) {
    console.error('Erreur analytics overtime:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 },
    );
  }
}
