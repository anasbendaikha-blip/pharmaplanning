/**
 * API Route — Notifications CRUD
 * GET    /api/notifications?organizationId=xxx&employeeId=xxx  : liste 50 dernieres
 * PUT    /api/notifications?id=xxx                              : marquer comme lue
 * PUT    /api/notifications?organizationId=xxx&employeeId=xxx&markAllRead=true
 * DELETE /api/notifications?id=xxx
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

/** GET — Liste des notifications */
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
    .from('notifications')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Erreur chargement notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/** PUT — Marquer comme lue ou tout marquer lu */
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const markAllRead = searchParams.get('markAllRead');
  const organizationId = searchParams.get('organizationId');
  const employeeId = searchParams.get('employeeId');

  const supabase = getServiceClient();

  // Mode "tout marquer lu"
  if (markAllRead === 'true' && organizationId && employeeId) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('organization_id', organizationId)
      .eq('employee_id', employeeId)
      .eq('read', false);

    if (error) {
      console.error('Erreur markAllRead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Mode unitaire
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.read !== undefined) updates.read = body.read;

  const { data, error } = await supabase
    .from('notifications')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur mise a jour notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** DELETE — Supprimer une notification */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur suppression notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
