/**
 * API Route — Availabilities CRUD
 * GET    /api/availabilities?organizationId=xxx&employeeId=xxx&weekStart=YYYY-MM-DD
 * POST   /api/availabilities   { organizationId, employeeId, weekStart, days: [...] }
 * DELETE /api/availabilities?employeeId=xxx&weekStart=YYYY-MM-DD
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

/** GET — Disponibilites d'un employe pour une semaine */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const employeeId = searchParams.get('employeeId');
  const weekStart = searchParams.get('weekStart');

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('availabilities')
    .select('*')
    .eq('organization_id', organizationId);

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (weekStart) query = query.eq('week_start', weekStart);

  query = query.order('day_of_week');

  const { data, error } = await query;

  if (error) {
    console.error('Erreur chargement disponibilites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/** POST — Soumettre les disponibilites d'une semaine (upsert) */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, employeeId, weekStart, days } = body;

  if (!organizationId || !employeeId || !weekStart || !Array.isArray(days)) {
    return NextResponse.json(
      { error: 'organizationId, employeeId, weekStart et days[] requis' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // Supprimer les anciennes dispos de cette semaine (sauf si locked)
  const { data: existing } = await supabase
    .from('availabilities')
    .select('locked')
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart)
    .limit(1);

  if (existing && existing.length > 0 && existing[0].locked) {
    return NextResponse.json(
      { error: 'Disponibilites verrouillees pour cette semaine' },
      { status: 403 }
    );
  }

  // Supprimer anciennes
  await supabase
    .from('availabilities')
    .delete()
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart);

  // Inserer nouvelles
  const records = days.map((day: {
    dayOfWeek: number;
    status: string;
    startTime?: string;
    endTime?: string;
    comment?: string;
  }) => ({
    employee_id: employeeId,
    organization_id: organizationId,
    week_start: weekStart,
    day_of_week: day.dayOfWeek,
    status: day.status,
    start_time: day.startTime || null,
    end_time: day.endTime || null,
    comment: day.comment || null,
    submitted_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('availabilities')
    .insert(records)
    .select();

  if (error) {
    console.error('Erreur insertion disponibilites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/** DELETE — Supprimer les dispos d'une semaine */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const weekStart = searchParams.get('weekStart');

  if (!employeeId || !weekStart) {
    return NextResponse.json({ error: 'employeeId et weekStart requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('availabilities')
    .delete()
    .eq('employee_id', employeeId)
    .eq('week_start', weekStart);

  if (error) {
    console.error('Erreur suppression disponibilites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
