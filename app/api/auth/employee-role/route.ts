/**
 * API Route — GET /api/auth/employee-role?userId=xxx
 * Retourne le rôle de l'employé lié à un user Supabase Auth
 * Utilisé pour les redirections selon le rôle (manager vs employé)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Chercher l'employé par user_id
  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, role, account_status, organization_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Erreur recherche employe par user_id:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!employee) {
    // Pas d'employé lié — c'est probablement un manager/admin via user_organizations
    return NextResponse.json({
      isEmployee: false,
      role: null,
      accountStatus: null,
    });
  }

  const isManager = employee.role === 'Pharmacien';

  return NextResponse.json({
    isEmployee: true,
    isManager,
    role: employee.role,
    accountStatus: employee.account_status,
    organizationId: employee.organization_id,
  });
}
