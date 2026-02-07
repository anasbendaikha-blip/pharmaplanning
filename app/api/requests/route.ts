/**
 * API Route — Requests CRUD (demandes employes)
 * GET    /api/requests?organizationId=xxx[&employeeId=xxx][&status=pending]
 * POST   /api/requests  { organizationId, employeeId, type, startDate, endDate?, targetEmployeeId?, reason? }
 * PUT    /api/requests?id=xxx  { status?, managerComment? }
 * DELETE /api/requests?id=xxx
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

/** GET — Liste des demandes */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status');

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  let query = supabase
    .from('requests')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    console.error('Erreur chargement demandes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrichir avec noms des employes cibles (pour shift_swap)
  if (data && data.length > 0) {
    const targetIds = data
      .filter((r) => r.target_employee_id)
      .map((r) => r.target_employee_id);

    if (targetIds.length > 0) {
      const { data: targets } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .in('id', targetIds);

      if (targets) {
        const targetMap = new Map(targets.map((t) => [
          t.id,
          `${t.first_name || ''} ${t.last_name || ''}`.trim()
        ]));
        for (const req of data) {
          if (req.target_employee_id) {
            (req as Record<string, unknown>).target_employee_name = targetMap.get(req.target_employee_id) || '';
          }
        }
      }
    }
  }

  return NextResponse.json(data || []);
}

/** POST — Creer une nouvelle demande */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { organizationId, employeeId, type, startDate, endDate, targetEmployeeId, reason } = body;

  if (!organizationId || !employeeId || !type || !startDate) {
    return NextResponse.json(
      { error: 'organizationId, employeeId, type et startDate requis' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('requests')
    .insert({
      organization_id: organizationId,
      employee_id: employeeId,
      type,
      start_date: startDate,
      end_date: endDate || startDate,
      target_employee_id: targetEmployeeId || null,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Erreur creation demande:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** PUT — Modifier une demande (status, commentaire manager) */
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.status) updates.status = body.status;
  if (body.managerComment !== undefined) updates.manager_comment = body.managerComment;
  updates.updated_at = new Date().toISOString();

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur mise a jour demande:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** DELETE — Supprimer une demande */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erreur suppression demande:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
