/**
 * API Route — POST /api/employees/activate
 * Lie un user_id Supabase Auth à un employé lors de l'activation du compte
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
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId et email requis' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const normalizedEmail = email.toLowerCase().trim();

    // Trouver l'employé par email
    const { data: employee, error: findError } = await supabase
      .from('employees')
      .select('id, organization_id, user_id, account_status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (findError || !employee) {
      console.error('Employe non trouve pour email:', normalizedEmail, findError);
      return NextResponse.json(
        { error: 'Aucun employe trouve avec cet email' },
        { status: 404 }
      );
    }

    // Si déjà activé avec un autre user_id, erreur
    if (employee.user_id && employee.user_id !== userId) {
      return NextResponse.json(
        { error: 'Ce compte est deja lie a un autre utilisateur' },
        { status: 400 }
      );
    }

    // Lier le user_id et activer le compte
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        user_id: userId,
        account_status: 'active',
        invitation_accepted_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (updateError) {
      console.error('Erreur activation employe:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de l\'activation du compte' },
        { status: 500 }
      );
    }

    // S'assurer que le mapping user_organizations existe
    await supabase
      .from('user_organizations')
      .upsert({
        user_id: userId,
        organization_id: employee.organization_id,
        role: 'employee',
      }, { onConflict: 'user_id' });

    return NextResponse.json({
      success: true,
      employeeId: employee.id,
      organizationId: employee.organization_id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Erreur API activate:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
