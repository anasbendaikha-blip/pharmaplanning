import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const EMPLOYEES = [
  { firstName: 'Mustafa', lastName: 'UNLU', initials: 'MU', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Tolga', lastName: 'PHARMACIEN', initials: 'TP', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Lea', lastName: 'PREPARATRICE', initials: 'LP', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Hanife', lastName: 'PREPARATRICE', initials: 'HP', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Myriam', lastName: 'APPRENTIE', initials: 'MA', role: 'Apprenti', contractHours: 35 },
  { firstName: 'Selena', lastName: 'APPRENTIE', initials: 'SA', role: 'Apprenti', contractHours: 35 },
  { firstName: 'Ensar', lastName: 'ETUDIANT', initials: 'EE', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Nisa', lastName: 'ETUDIANTE', initials: 'NE', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Mervenur', lastName: 'ETUDIANTE', initials: 'ME', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Mohamed', lastName: 'ETUDIANT', initials: 'MoE', role: 'Etudiant', contractHours: 20 },
];

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verifier l'organisation
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', ORG_ID)
      .single();

    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organisation non trouvee' },
        { status: 404 }
      );
    }

    // Mettre a jour le nom de l'organisation
    await supabase
      .from('organizations')
      .update({ name: 'Pharmacie des Coquelicots' })
      .eq('id', ORG_ID);

    // Nettoyer les anciens employes
    await supabase.from('employees').delete().eq('organization_id', ORG_ID);

    // Inserer les 10 employes
    let inserted = 0;
    const errors: string[] = [];

    for (const emp of EMPLOYEES) {
      const { error } = await supabase.from('employees').insert({
        organization_id: ORG_ID,
        name: `${emp.firstName} ${emp.lastName}`,
        first_name: emp.firstName,
        last_name: emp.lastName,
        initials: emp.initials,
        role: emp.role,
        contract_hours: emp.contractHours,
        status: 'active',
      });

      if (error) {
        errors.push(`${emp.firstName} ${emp.lastName}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    // Verification
    const { data: check } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', ORG_ID);

    return NextResponse.json({
      success: true,
      message: `${inserted} employes inseres`,
      total_in_db: check?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
