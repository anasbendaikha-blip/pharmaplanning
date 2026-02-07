/**
 * API Route — GET /api/auth/user-organization?userId=xxx
 * Récupère le mapping user → organization depuis user_organizations
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('user_organizations')
    .select('user_id, organization_id, role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Erreur chargement user_organization:', error?.message);
    return NextResponse.json(
      { error: 'Organisation non trouvée pour cet utilisateur' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
