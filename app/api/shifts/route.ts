/**
 * API Route — Shifts CRUD
 * GET  /api/shifts?organizationId=xxx&weekStart=YYYY-MM-DD&weekEnd=YYYY-MM-DD
 * POST /api/shifts           { organizationId, employee_id, date, start_time, end_time, hours }
 * PUT  /api/shifts?id=xxx    { start_time?, end_time?, date?, hours? }
 * DELETE /api/shifts?id=xxx
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

/** GET — Liste des shifts d'une semaine */
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

  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date')
    .order('start_time');

  if (error) {
    console.error('Erreur chargement shifts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/** POST — Créer un shift (ou batch si body est un tableau) */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const supabase = getServiceClient();

  // ─── Mode batch : body est un tableau ───
  if (Array.isArray(body)) {
    const shifts = body.map((item: Record<string, unknown>) => ({
      organization_id: item.organizationId as string,
      employee_id: item.employee_id as string,
      date: item.date as string,
      start_time: item.start_time as string,
      end_time: item.end_time as string,
      hours: (item.hours as number) || 0,
      type: (item.type as string) || 'work',
      validated: false,
    }));

    // Validation
    const invalid = shifts.some(s => !s.organization_id || !s.employee_id || !s.date || !s.start_time || !s.end_time);
    if (invalid) {
      return NextResponse.json(
        { error: 'Champs requis manquants dans le batch' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert(shifts)
      .select();

    if (error) {
      console.error('Erreur batch insert shifts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  }

  // ─── Mode simple : body est un objet ───
  const { organizationId, employee_id, date, start_time, end_time, hours } = body;

  if (!organizationId || !employee_id || !date || !start_time || !end_time) {
    return NextResponse.json(
      { error: 'Champs requis manquants' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('shifts')
    .insert({
      organization_id: organizationId,
      employee_id,
      date,
      start_time,
      end_time,
      hours: hours || 0,
      type: 'work',
      validated: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur création shift:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** PUT — Mettre à jour un shift */
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('id');

  if (!shiftId) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.start_time) updates.start_time = body.start_time;
  if (body.end_time) updates.end_time = body.end_time;
  if (body.date) updates.date = body.date;
  if (body.hours !== undefined) updates.hours = body.hours;
  updates.updated_at = new Date().toISOString();

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('shifts')
    .update(updates)
    .eq('id', shiftId)
    .select()
    .single();

  if (error) {
    console.error('Erreur mise à jour shift:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** DELETE — Supprimer un shift */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('id');

  if (!shiftId) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', shiftId);

  if (error) {
    console.error('Erreur suppression shift:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
