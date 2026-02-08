/**
 * API Route — /api/employees
 * GET  : Liste les employés d'une organisation
 * POST : Crée un employé (sans invitation)
 * PUT  : Met à jour un employé
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
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('role')
    .order('name');

  if (error) {
    console.error('Erreur chargement employes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const body = await request.json();
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('employees')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erreur mise a jour employe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
