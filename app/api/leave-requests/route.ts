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
import { NotificationService } from '@/lib/notifications/notification-service';

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

  // Notification non-bloquante : prevenir le manager
  try {
    const empInfo = await lookupEmployee(supabase, employee_id);
    const manager = await lookupManager(supabase, organizationId);
    if (empInfo && manager) {
      await NotificationService.send({
        type: 'leave_requested',
        priority: 'normal',
        organizationId,
        employeeId: manager.employeeId || employee_id,
        recipientEmail: manager.email,
        recipientName: manager.name,
        title: 'Nouvelle demande de conge',
        message: `${empInfo.name} demande un conge du ${start_date} au ${end_date}`,
        actionUrl: '/conges',
        data: {
          employeeName: empInfo.name,
          startDate: start_date,
          endDate: end_date,
          days: business_days || 0,
          leaveType: type,
        },
      });
    }
  } catch (notifErr) {
    console.error('[LeaveRequests] Erreur notification POST (non-bloquante):', notifErr);
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

  // Notification non-bloquante : si le statut change vers approved/rejected
  try {
    if (body.status && (body.status === 'approved' || body.status === 'rejected') && data) {
      const leaveData = data as Record<string, unknown>;
      const empId = leaveData.employee_id as string;
      const orgId = leaveData.organization_id as string;
      const empInfo = await lookupEmployee(supabase, empId);

      if (empInfo) {
        const notifType = body.status === 'approved' ? 'leave_approved' : 'leave_rejected';
        await NotificationService.send({
          type: notifType,
          priority: 'normal',
          organizationId: orgId,
          employeeId: empId,
          recipientEmail: empInfo.email,
          recipientName: empInfo.name,
          title: body.status === 'approved' ? 'Conge approuve' : 'Conge refuse',
          message: body.status === 'approved'
            ? `Votre conge du ${leaveData.start_date} au ${leaveData.end_date} a ete approuve`
            : `Votre conge du ${leaveData.start_date} au ${leaveData.end_date} a ete refuse`,
          actionUrl: '/conges',
          data: {
            startDate: leaveData.start_date as string,
            endDate: leaveData.end_date as string,
            days: (leaveData.business_days as number) || 0,
            leaveType: leaveData.type as string,
          },
        });
      }
    }
  } catch (notifErr) {
    console.error('[LeaveRequests] Erreur notification PUT (non-bloquante):', notifErr);
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

// ─── Helpers ───

interface EmployeeInfo {
  name: string;
  email: string;
}

interface ManagerInfo {
  name: string;
  email: string;
  employeeId: string | null;
}

/** Lookup employee name & email (generated) by ID */
async function lookupEmployee(
  supabase: ReturnType<typeof getServiceClient>,
  employeeId: string,
): Promise<EmployeeInfo | null> {
  const { data } = await supabase
    .from('employees')
    .select('first_name, last_name')
    .eq('id', employeeId)
    .single();

  if (!data) return null;

  const firstName = data.first_name || '';
  const lastName = data.last_name || '';
  const name = `${firstName} ${lastName}`.trim();
  const email = `${firstName.toLowerCase().replace(/\s/g, '')}@pharmacie-coquelicots.fr`;

  return { name, email };
}

/** Lookup le manager (owner) de l'organisation */
async function lookupManager(
  supabase: ReturnType<typeof getServiceClient>,
  organizationId: string,
): Promise<ManagerInfo | null> {
  // Chercher le owner via user_organizations
  const { data: userOrg } = await supabase
    .from('user_organizations')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  if (!userOrg) return null;

  // Chercher les infos auth
  const { data: authData } = await supabase.auth.admin.getUserById(userOrg.user_id);

  if (!authData?.user?.email) return null;

  // Essayer de trouver l'employee correspondant (pour l'ID)
  const { data: emp } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('organization_id', organizationId)
    .eq('role', 'Pharmacien')
    .limit(1)
    .single();

  return {
    name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Manager',
    email: authData.user.email,
    employeeId: emp?.id || null,
  };
}
