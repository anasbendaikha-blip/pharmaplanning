/**
 * API Route — POST /api/employees/resend-invite
 * Renvoie une invitation email à un employé en attente
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

export async function POST(request: NextRequest) {
  try {
    const { employeeId } = await request.json();

    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID employe requis' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Récupérer employé
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: 'Employe non trouve' },
        { status: 404 }
      );
    }

    if (!employee.email) {
      return NextResponse.json(
        { error: 'Cet employe n\'a pas d\'adresse email' },
        { status: 400 }
      );
    }

    // Vérifier que l'invitation n'a pas déjà été acceptée
    if (employee.account_status === 'active' || employee.invitation_accepted_at) {
      return NextResponse.json(
        { error: 'Le compte est deja actif' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pharmaplanning.vercel.app';

    // Renvoyer invitation Supabase
    const { data: authData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      employee.email,
      {
        data: {
          employee_id: employee.id,
          organization_id: employee.organization_id,
          role: employee.role,
          name: employee.name,
        },
        redirectTo: `${appUrl}/auth/activate`,
      }
    );

    if (inviteError) {
      console.error('Erreur renvoi invitation:', inviteError);
      return NextResponse.json(
        { error: 'Erreur lors du renvoi de l\'invitation: ' + inviteError.message },
        { status: 500 }
      );
    }

    // Mettre à jour date invitation
    await supabase
      .from('employees')
      .update({ invitation_sent_at: new Date().toISOString() })
      .eq('id', employeeId);

    // S'assurer que le mapping user_organizations existe
    const userId = authData?.user?.id;
    if (userId) {
      await supabase
        .from('user_organizations')
        .upsert({
          user_id: userId,
          organization_id: employee.organization_id,
          role: 'employee',
        }, { onConflict: 'user_id' });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Erreur API resend-invite:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
