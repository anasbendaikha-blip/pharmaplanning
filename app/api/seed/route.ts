import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const EMPLOYEES = [
  { firstName: 'Isabelle', lastName: 'MAURER', initials: 'IM', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'François', lastName: 'WEBER', initials: 'FW', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Marie', lastName: 'DUPONT', initials: 'MD', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Claire', lastName: 'BERNARD', initials: 'CB', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Sophie', lastName: 'LAURENT', initials: 'SL', role: 'Pharmacien', contractHours: 28 },
  { firstName: 'Antoine', lastName: 'MOREAU', initials: 'AM', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Jean', lastName: 'MARTIN', initials: 'JM', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Lucie', lastName: 'PETIT', initials: 'LP', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Pierre', lastName: 'ROBERT', initials: 'PR', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Camille', lastName: 'RICHARD', initials: 'CR', role: 'Preparateur', contractHours: 28 },
  { firstName: 'Nicolas', lastName: 'DURAND', initials: 'ND', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Émilie', lastName: 'LEROY', initials: 'EL', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Thomas', lastName: 'SIMON', initials: 'TS', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Julie', lastName: 'MICHEL', initials: 'JMi', role: 'Preparateur', contractHours: 28 },
  { firstName: 'Mathieu', lastName: 'GARCIA', initials: 'MG', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Laura', lastName: 'DAVID', initials: 'LD', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Sébastien', lastName: 'BERTRAND', initials: 'SB', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Pauline', lastName: 'ROUX', initials: 'PRo', role: 'Preparateur', contractHours: 28 },
  { firstName: 'Alain', lastName: 'FOURNIER', initials: 'AF', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'Nathalie', lastName: 'MOREL', initials: 'NM', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'Vincent', lastName: 'GIRARD', initials: 'VG', role: 'Conditionneur', contractHours: 28 },
  { firstName: 'Céline', lastName: 'ANDRE', initials: 'CA', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'David', lastName: 'LEFEVRE', initials: 'DL', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'Stéphanie', lastName: 'MERCIER', initials: 'SM', role: 'Conditionneur', contractHours: 28 },
  { firstName: 'Léa', lastName: 'BONNET', initials: 'LB', role: 'Apprenti', contractHours: 35 },
  { firstName: 'Hugo', lastName: 'LAMBERT', initials: 'HL', role: 'Apprenti', contractHours: 35 },
  { firstName: 'Chloé', lastName: 'FONTAINE', initials: 'CF', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Maxime', lastName: 'CHEVALIER', initials: 'MC', role: 'Etudiant', contractHours: 20 },
];

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Vérifier l'organisation
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', ORG_ID)
      .single();

    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organisation non trouvée' },
        { status: 404 }
      );
    }

    // Nettoyer les anciens employés
    await supabase.from('employees').delete().eq('organization_id', ORG_ID);

    // Insérer les 28 employés
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

    // Vérification
    const { data: check } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', ORG_ID);

    return NextResponse.json({
      success: true,
      message: `${inserted} employés insérés`,
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
