/**
 * API Route — Daily Tasks CRUD
 * GET    /api/daily-tasks?organizationId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&employeeId=xxx]
 * POST   /api/daily-tasks  { organizationId, taskName, date, assignedEmployeeId }
 *
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

/** GET — Taches d'une periode */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const employeeId = searchParams.get('employeeId');

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('daily_tasks')
    .select('*')
    .eq('organization_id', organizationId);

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  if (employeeId) query = query.eq('assigned_employee_id', employeeId);

  query = query.order('date').order('task_name');

  const { data, error } = await query;

  if (error) {
    console.error('Erreur chargement taches:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/** POST — Creer ou mettre a jour une tache */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, taskName, date, assignedEmployeeId } = body;

  if (!organizationId || !taskName || !date) {
    return NextResponse.json(
      { error: 'organizationId, taskName et date requis' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // Upsert (la contrainte UNIQUE gere les conflits)
  const { data, error } = await supabase
    .from('daily_tasks')
    .upsert({
      organization_id: organizationId,
      task_name: taskName,
      date,
      assigned_employee_id: assignedEmployeeId || null,
    }, {
      onConflict: 'organization_id,task_name,date',
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur creation tache:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
