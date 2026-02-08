/**
 * API Route — GET /api/leaves/annual?organizationId=xxx&year=2026
 * Retourne tous les conges d'une annee avec les infos employes
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const employeeId = searchParams.get('employeeId');
  const type = searchParams.get('type');
  const status = searchParams.get('status') || 'approved';

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Requete conges de l'annee
  let query = supabase
    .from('leave_requests')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('end_date', yearStart)
    .lte('start_date', yearEnd)
    .order('start_date', { ascending: true });

  if (employeeId && employeeId !== 'all') {
    query = query.eq('employee_id', employeeId);
  }

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: leaves, error } = await query;

  if (error) {
    console.error('Erreur chargement conges annuels:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Charger les employes pour enrichir les donnees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, first_name, last_name, role')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name');

  // Map employes par ID
  const empMap = new Map<string, { name: string; first_name: string; last_name: string; role: string }>();
  for (const emp of employees || []) {
    empMap.set(emp.id, {
      name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      role: emp.role || '',
    });
  }

  // Enrichir les conges avec les infos employe
  const enrichedLeaves = (leaves || []).map(leave => ({
    ...leave,
    employee: empMap.get(leave.employee_id) || { name: 'Inconnu', first_name: '', last_name: '', role: '' },
  }));

  // Stats
  const stats = {
    total: enrichedLeaves.length,
    byType: {} as Record<string, number>,
    byMonth: Array(12).fill(0) as number[],
    totalDays: 0,
  };

  enrichedLeaves.forEach(leave => {
    stats.byType[leave.type] = (stats.byType[leave.type] || 0) + 1;
    stats.totalDays += leave.business_days || 0;
    const startMonth = new Date(leave.start_date + 'T12:00:00').getMonth();
    stats.byMonth[startMonth]++;
  });

  return NextResponse.json({
    leaves: enrichedLeaves,
    employees: employees || [],
    stats,
    year,
  });
}
