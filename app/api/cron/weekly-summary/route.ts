/**
 * Cron Job — Resume hebdomadaire
 * Envoie un email recapitulatif au manager tous les lundis a 9h
 *
 * Protege par CRON_SECRET (header Authorization: Bearer xxx)
 * Configure dans vercel.json : schedule "0 9 * * 1"
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

/** Calcul du numero de semaine ISO */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function GET(request: NextRequest) {
  // Verifier le secret cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();

    // Semaine ecoulee : lundi dernier a dimanche dernier
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek - 6);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const weekStart = lastMonday.toISOString().split('T')[0];
    const weekEnd = lastSunday.toISOString().split('T')[0];
    const weekNumber = getISOWeekNumber(lastMonday);
    const year = lastMonday.getFullYear();

    // Recuperer toutes les organisations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name');

    if (!orgs) {
      return NextResponse.json({ sent: 0, error: 'No organizations found' });
    }

    let totalSent = 0;

    for (const org of orgs) {
      // Stats de la semaine
      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, hours, employee_id')
        .eq('organization_id', org.id)
        .gte('date', weekStart)
        .lte('date', weekEnd);

      const { data: employees } = await supabase
        .from('employees')
        .select('id')
        .eq('organization_id', org.id)
        .eq('status', 'active');

      const totalShifts = shifts?.length || 0;
      const totalHours = shifts?.reduce((sum, s) => sum + ((s.hours as number) || 0), 0) || 0;
      const employeesCount = employees?.length || 0;

      // Trouver le manager (owner)
      const { data: userOrg } = await supabase
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('role', 'owner')
        .limit(1)
        .single();

      if (!userOrg) continue;

      const { data: authData } = await supabase.auth.admin.getUserById(userOrg.user_id);
      if (!authData?.user?.email) continue;

      // Trouver un employeeId pour le manager
      const { data: managerEmp } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('organization_id', org.id)
        .eq('role', 'Pharmacien')
        .limit(1)
        .single();

      const managerName = managerEmp
        ? `${managerEmp.first_name || ''} ${managerEmp.last_name || ''}`.trim()
        : 'Manager';

      await NotificationService.send({
        type: 'weekly_summary',
        priority: 'low',
        organizationId: org.id,
        employeeId: managerEmp?.id || '',
        recipientEmail: authData.user.email,
        recipientName: managerName,
        title: `Resume semaine ${weekNumber}`,
        message: `${totalShifts} shifts, ${Math.round(totalHours)}h, ${employeesCount} employes`,
        actionUrl: '/titulaire/recap-hebdo',
        data: {
          weekNumber,
          year,
          totalHours: Math.round(totalHours),
          totalShifts,
          employeesCount,
        },
      });

      totalSent++;
    }

    return NextResponse.json({ sent: totalSent });
  } catch (error) {
    console.error('[Cron weekly-summary] Erreur:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
