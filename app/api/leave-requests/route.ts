/**
 * API Route — Leave Requests (Congés) CRUD
 * GET    /api/leave-requests?organizationId=xxx[&startDate=...&endDate=...]
 * POST   /api/leave-requests   { organizationId, employee_id, start_date, end_date, type, ... }
 * PUT    /api/leave-requests?id=xxx  { start_date?, end_date?, type?, status?, ... }
 * DELETE /api/leave-requests?id=xxx
 *
 * Utilise le service_role pour bypasser le RLS
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** GET — Liste des congés */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('leave_requests')
    .select('*')
    .eq('organization_id', organizationId);

  if (startDate) query = query.gte('end_date', startDate);
  if (endDate) query = query.lte('start_date', endDate);

  query = query.order('start_date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Erreur chargement congés:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/** POST — Créer un congé */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, employee_id, start_date, end_date, type, status, business_days, notes } = body;

  if (!organizationId || !employee_id || !start_date || !end_date || !type) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      organization_id: organizationId,
      employee_id,
      start_date,
      end_date,
      type,
      status: status || 'pending',
      business_days: business_days || 0,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur création congé:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** PUT — Mettre à jour un congé */
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.start_date) updates.start_date = body.start_date;
  if (body.end_date) updates.end_date = body.end_date;
  if (body.type) updates.type = body.type;
  if (body.status) updates.status = body.status;
  if (body.business_days !== undefined) updates.business_days = body.business_days;
  if (body.notes !== undefined) updates.notes = body.notes;
  updates.updated_at = new Date().toISOString();

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('leave_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur mise à jour congé:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** DELETE — Supprimer un congé */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur suppression congé:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
