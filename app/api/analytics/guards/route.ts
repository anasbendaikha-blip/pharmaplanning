/**
 * API Route — GET /api/analytics/guards
 *
 * Calcule la distribution des gardes (soir, nuit, dimanche)
 * pour chaque employe sur un mois donne. Utilise le service_role.
 *
 * Params: organizationId (requis), monthOffset (defaut 0 = mois en cours)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  computeMonthlyGuards,
  analyzeGuardDistribution,
  startOfMonth,
  endOfMonth,
  toDateStr,
} from '@/lib/analytics/hours-calculator';
import type { GuardStats } from '@/lib/analytics/hours-calculator';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const monthOffset = parseInt(searchParams.get('monthOffset') || '0', 10);

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Mois cible
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);
    const monthStartStr = toDateStr(monthStart);
    const monthEndStr = toDateStr(monthEnd);

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
      return NextResponse.json({
        guards: [],
        stats: { totalGuards: 0, avgGuardsPerEmployee: 0, imbalancedEmployees: 0, eveningTotal: 0, nightTotal: 0, sundayTotal: 0 },
        month: monthStartStr,
      });
    }

    // Charger tous les shifts du mois en un seul appel
    const { data: allShifts, error: shiftError } = await supabase
      .from('shifts')
      .select('employee_id, date, start_time, end_time, hours, type')
      .eq('organization_id', organizationId)
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .order('date');

    if (shiftError) {
      console.error('Erreur shifts:', shiftError);
      return NextResponse.json({ error: shiftError.message }, { status: 500 });
    }

    const shifts = allShifts || [];

    // Calculer gardes par employe
    const guardInfos = employees.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id);
      return computeMonthlyGuards(emp, empShifts, monthStartStr);
    });

    // Analyser equite
    const analyzed = analyzeGuardDistribution(guardInfos);

    // Stats globales
    const stats: GuardStats = {
      totalGuards: analyzed.reduce((sum, g) => sum + g.totalGuards, 0),
      avgGuardsPerEmployee: analyzed.length > 0
        ? Math.round((analyzed.reduce((sum, g) => sum + g.totalGuards, 0) / analyzed.length) * 10) / 10
        : 0,
      imbalancedEmployees: analyzed.filter(g => g.distribution !== 'NORMAL').length,
      eveningTotal: analyzed.reduce((sum, g) => sum + g.eveningGuards, 0),
      nightTotal: analyzed.reduce((sum, g) => sum + g.nightGuards, 0),
      sundayTotal: analyzed.reduce((sum, g) => sum + g.sundayGuards, 0),
    };

    // Nom du mois pour le front
    const MONTHS_FR = [
      'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
    ];
    const monthLabel = `${MONTHS_FR[targetMonth.getMonth()]} ${targetMonth.getFullYear()}`;

    return NextResponse.json({
      guards: analyzed,
      stats,
      month: monthStartStr,
      monthLabel,
    });
  } catch (error) {
    console.error('Erreur analytics guards:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 },
    );
  }
}
