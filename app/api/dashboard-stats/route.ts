/**
 * API Route — GET /api/dashboard-stats?organizationId=xxx&weekStart=YYYY-MM-DD&weekEnd=YYYY-MM-DD
 * Calcule les statistiques du dashboard pour une semaine donnée
 * Utilise le service_role pour bypasser le RLS
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface DayOverview {
  date: string;
  dayLabel: string;
  employees: number;
  hours: number;
  hasPharmacist: boolean;
  hasConflict: boolean;
}

interface Alert {
  type: 'error' | 'warning' | 'info';
  message: string;
  employeeName?: string;
  day?: string;
}

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Formate une date locale en YYYY-MM-DD sans décalage UTC */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const weekStart = searchParams.get('weekStart');
  const weekEnd = searchParams.get('weekEnd');

  if (!organizationId || !weekStart || !weekEnd) {
    return NextResponse.json(
      { error: 'organizationId, weekStart et weekEnd requis' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // Récupérer shifts + employés en parallèle
  const [shiftsResult, employeesResult] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, employee_id, date, start_time, end_time, hours, type, validated')
      .eq('organization_id', organizationId)
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date'),
    supabase
      .from('employees')
      .select('id, name, first_name, last_name, role, contract_hours, status')
      .eq('organization_id', organizationId)
      .eq('status', 'active'),
  ]);

  const shifts = shiftsResult.data || [];
  const employees = employeesResult.data || [];

  // ─── Stats de base ───
  const totalHours = shifts.reduce((sum, s) => sum + (s.hours || 0), 0);
  const activeEmployees = employees.length;
  const shiftsCount = shifts.length;
  const workingEmployeeIds = new Set(shifts.map(s => s.employee_id));

  // ─── Employés par rôle ───
  const employeesByRole: Record<string, number> = {};
  for (const emp of employees) {
    employeesByRole[emp.role] = (employeesByRole[emp.role] || 0) + 1;
  }

  // ─── Heures par jour ───
  const hoursByDay: Record<string, number> = {};
  for (const shift of shifts) {
    const date = new Date(shift.date + 'T00:00:00');
    const dayIndex = (date.getDay() + 6) % 7; // Lundi = 0
    const dayName = DAYS_SHORT[dayIndex];
    hoursByDay[dayName] = (hoursByDay[dayName] || 0) + (shift.hours || 0);
  }

  // ─── Lookup employee par id pour les alertes ───
  const empById = new Map(employees.map(e => [e.id, e]));

  // ─── Vue par jour (7 jours) ───
  const weekOverview: DayOverview[] = [];
  const start = new Date(weekStart + 'T00:00:00');

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = toLocalDateStr(d);
    const dayShifts = shifts.filter(s => s.date === dateStr);

    const dayEmployeeIds = new Set(dayShifts.map(s => s.employee_id));
    const dayHours = dayShifts.reduce((sum, s) => sum + (s.hours || 0), 0);

    // Vérifier si au moins 1 pharmacien est planifié ce jour
    const hasPharmacist = dayShifts.some(s => {
      const emp = empById.get(s.employee_id);
      return emp?.role === 'Pharmacien';
    });

    weekOverview.push({
      date: dateStr,
      dayLabel: DAYS_SHORT[i],
      employees: dayEmployeeIds.size,
      hours: Math.round(dayHours * 10) / 10,
      hasPharmacist,
      hasConflict: false, // sera mis à jour ci-dessous
    });
  }

  // ─── Couverture pharmacien (% jours ouvrés avec au moins 1 pharmacien) ───
  const openDays = weekOverview.slice(0, 6); // Lun-Sam (jours ouvrés)
  const daysWithPharmacist = openDays.filter(d => d.hasPharmacist).length;
  const pharmacistCoverage = openDays.length > 0
    ? Math.round((daysWithPharmacist / openDays.length) * 100)
    : 100;

  // ─── Détection des conflits et alertes ───
  const alerts: Alert[] = [];
  let conflictsCount = 0;

  // Grouper shifts par employé
  const shiftsByEmployee = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    if (!shiftsByEmployee.has(shift.employee_id)) {
      shiftsByEmployee.set(shift.employee_id, []);
    }
    shiftsByEmployee.get(shift.employee_id)!.push(shift);
  }

  // Vérifier contraintes par employé
  shiftsByEmployee.forEach((empShifts, empId) => {
    const emp = empById.get(empId);
    if (!emp) return;

    const empName = `${emp.first_name || ''} ${emp.last_name || emp.name}`.trim();
    const totalEmpHours = empShifts.reduce((sum, s) => sum + (s.hours || 0), 0);

    // Alerte si > 44h hebdo (convention pharmacie)
    if (totalEmpHours > 44) {
      alerts.push({
        type: 'error',
        message: `Dépassement 44h hebdo : ${Math.round(totalEmpHours * 10) / 10}h`,
        employeeName: empName,
      });
      conflictsCount++;
    }

    // Vérifier limite 10h/jour
    const shiftsByDay = new Map<string, number>();
    for (const shift of empShifts) {
      const current = shiftsByDay.get(shift.date) || 0;
      shiftsByDay.set(shift.date, current + (shift.hours || 0));
    }

    shiftsByDay.forEach((dayHours, dateStr) => {
      if (dayHours > 10) {
        const date = new Date(dateStr + 'T00:00:00');
        const dayIndex = (date.getDay() + 6) % 7;
        alerts.push({
          type: 'error',
          message: `Dépassement 10h/jour : ${Math.round(dayHours * 10) / 10}h`,
          employeeName: empName,
          day: DAYS_SHORT[dayIndex],
        });
        conflictsCount++;

        // Marquer le jour en conflit
        const overviewDay = weekOverview.find(d => d.date === dateStr);
        if (overviewDay) overviewDay.hasConflict = true;
      }
    });
  });

  // Vérifier couverture pharmacien par jour ouvré
  for (let i = 0; i < 6; i++) {
    const day = weekOverview[i];
    if (day.employees > 0 && !day.hasPharmacist) {
      alerts.push({
        type: 'error',
        message: 'Aucun pharmacien planifié',
        day: day.dayLabel,
      });
      conflictsCount++;
      day.hasConflict = true;
    }
  }

  return NextResponse.json({
    totalHours: Math.round(totalHours * 10) / 10,
    activeEmployees,
    scheduledEmployees: workingEmployeeIds.size,
    pharmacistCoverage,
    conflictsCount,
    shiftsCount,
    employeesByRole,
    hoursByDay,
    weekOverview,
    alerts: alerts.slice(0, 10),
  });
}
