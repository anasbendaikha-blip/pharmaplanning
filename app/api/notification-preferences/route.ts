/**
 * API Route — Notification Preferences
 * GET  /api/notification-preferences?organizationId=xxx&employeeId=xxx
 * POST /api/notification-preferences  { organizationId, employeeId, ... }
 * PUT  /api/notification-preferences?id=xxx  { email_enabled?, in_app_enabled?, types? }
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

/** GET — Recuperer les preferences d'un employe */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const employeeId = searchParams.get('employeeId');

  if (!organizationId || !employeeId) {
    return NextResponse.json(
      { error: 'organizationId et employeeId requis' },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (pas une erreur)
    console.error('Erreur chargement preferences:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Retourner null si pas de preferences (le client creera les defaut)
  return NextResponse.json(data || null);
}

/** POST — Creer les preferences initiales */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, employeeId, email_enabled, in_app_enabled, types } = body;

  if (!organizationId || !employeeId) {
    return NextResponse.json(
      { error: 'organizationId et employeeId requis' },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('notification_preferences')
    .insert({
      organization_id: organizationId,
      employee_id: employeeId,
      email_enabled: email_enabled ?? true,
      in_app_enabled: in_app_enabled ?? true,
      types: types || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur creation preferences:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** PUT — Mettre a jour les preferences */
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.email_enabled !== undefined) updates.email_enabled = body.email_enabled;
  if (body.in_app_enabled !== undefined) updates.in_app_enabled = body.in_app_enabled;
  if (body.types !== undefined) updates.types = body.types;
  updates.updated_at = new Date().toISOString();

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('notification_preferences')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur mise a jour preferences:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
