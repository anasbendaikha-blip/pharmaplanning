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
import { NotificationService } from '@/lib/notifications/notification-service';

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
  console.log('🔵 [API] POST /api/shifts');

  const body = await request.json();
  const supabase = getServiceClient();

  // ─── Mode batch : body est un tableau ───
  if (Array.isArray(body)) {
    console.log(`📝 [API] Batch mode: ${body.length} shifts`);

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
      console.error('❌ [API] Missing required fields in batch');
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
      console.error('❌ [API] Batch insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ [API] ${data?.length || 0} shifts created`);

    // Notification non-bloquante pour chaque employe unique
    try {
      const orgId = shifts[0]?.organization_id;
      if (orgId && data) {
        const uniqueEmployeeIds = [...new Set(data.map((s: Record<string, unknown>) => s.employee_id as string))];
        console.log(`📧 [API] Notifying ${uniqueEmployeeIds.length} unique employees...`);

        for (const empId of uniqueEmployeeIds) {
          const empShifts = data.filter((s: Record<string, unknown>) => s.employee_id === empId);
          const empInfo = await lookupEmployee(supabase, empId);
          if (empInfo) {
            console.log(`📧 [API] Triggering notification for ${empInfo.name} (${empInfo.email})`);
            await NotificationService.send({
              type: 'shift_created',
              priority: 'normal',
              organizationId: orgId,
              employeeId: empId,
              recipientEmail: empInfo.email,
              recipientName: empInfo.name,
              title: 'Nouveaux shifts planifies',
              message: `${empShifts.length} shift(s) planifie(s) pour vous`,
              actionUrl: '/planning',
              data: {
                count: empShifts.length,
                date: (empShifts[0] as Record<string, unknown>).date as string,
                startTime: (empShifts[0] as Record<string, unknown>).start_time as string,
                endTime: (empShifts[0] as Record<string, unknown>).end_time as string,
                hours: (empShifts[0] as Record<string, unknown>).hours as number,
              },
            });
            console.log(`✅ [API] Notification triggered for ${empInfo.name}`);
          } else {
            console.warn(`⚠️ [API] Employee not found for ID: ${empId}, skipping notification`);
          }
        }
      }
    } catch (notifErr) {
      console.error('❌ [API] Notification batch error (non-blocking):', notifErr);
    }

    return NextResponse.json(data || []);
  }

  // ─── Mode simple : body est un objet ───
  console.log('📝 [API] Single shift mode');

  const { organizationId, employee_id, date, start_time, end_time, hours } = body;

  if (!organizationId || !employee_id || !date || !start_time || !end_time) {
    console.error('❌ [API] Missing required fields');
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
    console.error('❌ [API] Shift creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('✅ [API] Shift created:', data.id);

  // Notification non-bloquante
  try {
    const empInfo = await lookupEmployee(supabase, employee_id);
    if (empInfo) {
      console.log(`📧 [API] Triggering notification for ${empInfo.name} (${empInfo.email})`);
      await NotificationService.send({
        type: 'shift_created',
        priority: 'normal',
        organizationId,
        employeeId: employee_id,
        recipientEmail: empInfo.email,
        recipientName: empInfo.name,
        title: 'Nouveau shift planifie',
        message: `Shift le ${date} de ${start_time} a ${end_time}`,
        actionUrl: '/planning',
        data: { date, startTime: start_time, endTime: end_time, hours: hours || 0 },
      });
      console.log('✅ [API] Notification triggered');
    } else {
      console.warn('⚠️ [API] Employee not found, skipping notification');
    }
  } catch (notifErr) {
    console.error('❌ [API] Notification error (non-blocking):', notifErr);
  }

  return NextResponse.json(data);
}

/** PUT — Mettre à jour un shift */
export async function PUT(request: NextRequest) {
  console.log('🟡 [API] PUT /api/shifts');

  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('id');

  if (!shiftId) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  console.log('📝 [API] Updating shift:', shiftId);

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
    console.error('❌ [API] Shift update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('✅ [API] Shift updated');

  // Notification non-bloquante : shift modifie
  try {
    if (data) {
      const shiftData = data as Record<string, unknown>;
      const empId = shiftData.employee_id as string;
      const orgId = shiftData.organization_id as string;
      const empInfo = await lookupEmployee(supabase, empId);
      if (empInfo) {
        console.log(`📧 [API] Triggering shift_updated notification for ${empInfo.name}`);
        await NotificationService.send({
          type: 'shift_updated',
          priority: 'normal',
          organizationId: orgId,
          employeeId: empId,
          recipientEmail: empInfo.email,
          recipientName: empInfo.name,
          title: 'Shift modifie',
          message: `Votre shift du ${shiftData.date} a ete modifie`,
          actionUrl: '/planning',
          data: {
            date: shiftData.date as string,
            startTime: shiftData.start_time as string,
            endTime: shiftData.end_time as string,
            hours: (shiftData.hours as number) || 0,
          },
        });
        console.log('✅ [API] Notification sent');
      } else {
        console.warn('⚠️ [API] Employee not found, skipping notification');
      }
    }
  } catch (notifErr) {
    console.error('❌ [API] Notification PUT error (non-blocking):', notifErr);
  }

  return NextResponse.json(data);
}

/** DELETE — Supprimer un shift */
export async function DELETE(request: NextRequest) {
  console.log('🔴 [API] DELETE /api/shifts');

  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('id');

  if (!shiftId) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  console.log('🗑️ [API] Deleting shift:', shiftId);

  const supabase = getServiceClient();

  // Lookup le shift AVANT suppression pour la notification
  let shiftInfo: Record<string, unknown> | null = null;
  let empInfo: EmployeeInfo | null = null;
  try {
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('employee_id, organization_id, date, start_time, end_time')
      .eq('id', shiftId)
      .single();

    if (shiftData) {
      shiftInfo = shiftData;
      empInfo = await lookupEmployee(supabase, shiftData.employee_id);
      console.log('✅ [API] Shift info fetched before deletion');
    } else {
      console.warn('⚠️ [API] Shift not found for pre-delete lookup');
    }
  } catch {
    console.warn('⚠️ [API] Could not lookup shift before deletion');
  }

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', shiftId);

  if (error) {
    console.error('❌ [API] Shift deletion error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('✅ [API] Shift deleted');

  // Notification non-bloquante : shift supprime
  try {
    if (shiftInfo && empInfo) {
      console.log(`📧 [API] Triggering shift_deleted notification for ${empInfo.name}`);
      await NotificationService.send({
        type: 'shift_deleted',
        priority: 'normal',
        organizationId: shiftInfo.organization_id as string,
        employeeId: shiftInfo.employee_id as string,
        recipientEmail: empInfo.email,
        recipientName: empInfo.name,
        title: 'Shift supprime',
        message: `Votre shift du ${shiftInfo.date} a ete supprime`,
        actionUrl: '/planning',
        data: {
          date: shiftInfo.date as string,
          startTime: shiftInfo.start_time as string,
          endTime: shiftInfo.end_time as string,
        },
      });
      console.log('✅ [API] Notification sent');
    } else {
      console.warn('⚠️ [API] Missing shift/employee info, skipping notification');
    }
  } catch (notifErr) {
    console.error('❌ [API] Notification DELETE error (non-blocking):', notifErr);
  }

  return NextResponse.json({ success: true });
}

// ─── Helpers ───

interface EmployeeInfo {
  name: string;
  email: string;
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
  const email = `${firstName.toLowerCase().replace(/\s/g, '')}@pharmacie-maurer.fr`;

  return { name, email };
}
