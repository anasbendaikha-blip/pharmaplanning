/**
 * Script de seed : insère les 28 employés de la Pharmacie Isabelle MAURER dans Supabase
 *
 * Usage : npx tsx scripts/seed.ts
 *
 * Schéma DB employees:
 *   id (uuid auto), organization_id, name, first_name, last_name, initials, role, contract_hours, availability, preferences, status, created_at, updated_at
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aiatvwkmgzecaaudhubx.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpYXR2d2ttZ3plY2FhdWRodWJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQxMTMyNSwiZXhwIjoyMDg1OTg3MzI1fQ.vZd4XBRYSJrfGzHYMFYWFGM0WNe288zmmn-82AXI0zg';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface SeedEmployee {
  firstName: string;
  lastName: string;
  initials: string;
  role: string;
  contractHours: number;
}

const EMPLOYEES: SeedEmployee[] = [
  // Pharmaciens Titulaires (2) — role='Pharmacien'
  { firstName: 'Isabelle', lastName: 'MAURER', initials: 'IM', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'François', lastName: 'WEBER', initials: 'FW', role: 'Pharmacien', contractHours: 35 },

  // Pharmaciens Adjoints (4) — role='Pharmacien'
  { firstName: 'Marie', lastName: 'DUPONT', initials: 'MD', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Claire', lastName: 'BERNARD', initials: 'CB', role: 'Pharmacien', contractHours: 35 },
  { firstName: 'Sophie', lastName: 'LAURENT', initials: 'SL', role: 'Pharmacien', contractHours: 28 },
  { firstName: 'Antoine', lastName: 'MOREAU', initials: 'AM', role: 'Pharmacien', contractHours: 35 },

  // Préparateurs (12)
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

  // Rayonnistes (6) — DB role 'Conditionneur'
  { firstName: 'Alain', lastName: 'FOURNIER', initials: 'AF', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'Nathalie', lastName: 'MOREL', initials: 'NM', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'Vincent', lastName: 'GIRARD', initials: 'VG', role: 'Conditionneur', contractHours: 28 },
  { firstName: 'Céline', lastName: 'ANDRE', initials: 'CA', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'David', lastName: 'LEFEVRE', initials: 'DL', role: 'Conditionneur', contractHours: 35 },
  { firstName: 'Stéphanie', lastName: 'MERCIER', initials: 'SM', role: 'Conditionneur', contractHours: 28 },

  // Apprentis (2)
  { firstName: 'Léa', lastName: 'BONNET', initials: 'LB', role: 'Apprenti', contractHours: 35 },
  { firstName: 'Hugo', lastName: 'LAMBERT', initials: 'HL', role: 'Apprenti', contractHours: 35 },

  // Étudiants (2)
  { firstName: 'Chloé', lastName: 'FONTAINE', initials: 'CF', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Maxime', lastName: 'CHEVALIER', initials: 'MC', role: 'Etudiant', contractHours: 20 },
];

async function seed() {
  console.log('🏥 Seed PharmaPlanning — Pharmacie Isabelle MAURER');
  console.log(`📍 Organization ID: ${ORG_ID}`);
  console.log(`🔗 Supabase: ${SUPABASE_URL}`);
  console.log('');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Vérifier que l'organisation existe
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', ORG_ID)
    .single();

  if (orgError || !org) {
    console.error('❌ Organisation non trouvée. Création...');
    const { error: createErr } = await supabase.from('organizations').insert({
      id: ORG_ID,
      name: 'Pharmacie Isabelle MAURER',
      slug: 'pharmacie-isabelle-maurer',
      primary_color: '#10b981',
      subscription_plan: 'trial',
    });
    if (createErr) {
      console.error('❌ Impossible de créer l\'organisation:', createErr);
      process.exit(1);
    }
    console.log('✅ Organisation créée');
  } else {
    console.log(`✅ Organisation trouvée: ${org.name}`);
  }

  // 2. Supprimer les anciens employés de cette organisation (si relance)
  const { error: delErr } = await supabase
    .from('employees')
    .delete()
    .eq('organization_id', ORG_ID);

  if (delErr) {
    console.warn('⚠️  Impossible de nettoyer les anciens employés:', delErr.message);
  } else {
    console.log('🧹 Anciens employés nettoyés');
  }

  // 3. Insérer les 28 employés
  let inserted = 0;
  let errors = 0;

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
      console.error(`  ❌ ${emp.firstName} ${emp.lastName}: ${error.message}`);
      errors++;
    } else {
      console.log(`  ✅ ${emp.firstName} ${emp.lastName} (${emp.role})`);
      inserted++;
    }
  }

  console.log('');
  console.log(`📊 Résultat: ${inserted} insérés, ${errors} erreurs`);

  // 4. Vérification
  const { data: check, error: checkErr } = await supabase
    .from('employees')
    .select('id, name, role, contract_hours')
    .eq('organization_id', ORG_ID)
    .order('role')
    .order('name');

  if (checkErr) {
    console.error('❌ Erreur vérification:', checkErr);
  } else {
    console.log(`\n🔍 Vérification: ${check.length} employés en base`);
    check.forEach((e: { name: string; role: string; contract_hours: number }) => {
      console.log(`   ${e.role}: ${e.name} (${e.contract_hours}h)`);
    });
  }

  console.log('\n✅ Seed terminé !');
}

seed().catch(console.error);
