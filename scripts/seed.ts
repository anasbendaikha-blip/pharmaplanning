/**
 * Script de seed : insere les 10 employes de la Pharmacie des Coquelicots dans Supabase
 *
 * Usage : npx tsx scripts/seed.ts
 *
 * Schema DB employees:
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
  // Pharmacien Titulaire (1) — role='Pharmacien', TITULAIRE_NAMES=['UNLU']
  { firstName: 'Mustafa', lastName: 'UNLU', initials: 'MU', role: 'Pharmacien', contractHours: 35 },

  // Pharmacien Adjoint (1) — role='Pharmacien'
  { firstName: 'Tolga', lastName: 'PHARMACIEN', initials: 'TP', role: 'Pharmacien', contractHours: 35 },

  // Preparateurs (2)
  { firstName: 'Lea', lastName: 'PREPARATRICE', initials: 'LP', role: 'Preparateur', contractHours: 35 },
  { firstName: 'Hanife', lastName: 'PREPARATRICE', initials: 'HP', role: 'Preparateur', contractHours: 35 },

  // Apprentis (2)
  { firstName: 'Myriam', lastName: 'APPRENTIE', initials: 'MA', role: 'Apprenti', contractHours: 35 },
  { firstName: 'Selena', lastName: 'APPRENTIE', initials: 'SA', role: 'Apprenti', contractHours: 35 },

  // Etudiants (4)
  { firstName: 'Ensar', lastName: 'ETUDIANT', initials: 'EE', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Nisa', lastName: 'ETUDIANTE', initials: 'NE', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Mervenur', lastName: 'ETUDIANTE', initials: 'ME', role: 'Etudiant', contractHours: 20 },
  { firstName: 'Mohamed', lastName: 'ETUDIANT', initials: 'MoE', role: 'Etudiant', contractHours: 20 },
];

async function seed() {
  console.log('Seed PharmaPlanning — Pharmacie des Coquelicots');
  console.log(`Organization ID: ${ORG_ID}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Verifier que l'organisation existe
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', ORG_ID)
    .single();

  if (orgError || !org) {
    console.error('Organisation non trouvee. Creation...');
    const { error: createErr } = await supabase.from('organizations').insert({
      id: ORG_ID,
      name: 'Pharmacie des Coquelicots',
      slug: 'pharmacie-des-coquelicots',
      primary_color: '#10b981',
      subscription_plan: 'trial',
    });
    if (createErr) {
      console.error('Impossible de creer l\'organisation:', createErr);
      process.exit(1);
    }
    console.log('Organisation creee');
  } else {
    console.log(`Organisation trouvee: ${org.name}`);
  }

  // 2. Supprimer les anciens employes de cette organisation (si relance)
  const { error: delErr } = await supabase
    .from('employees')
    .delete()
    .eq('organization_id', ORG_ID);

  if (delErr) {
    console.warn('Impossible de nettoyer les anciens employes:', delErr.message);
  } else {
    console.log('Anciens employes nettoyes');
  }

  // 3. Inserer les 10 employes
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
      console.error(`  [ERREUR] ${emp.firstName} ${emp.lastName}: ${error.message}`);
      errors++;
    } else {
      console.log(`  [OK] ${emp.firstName} ${emp.lastName} (${emp.role})`);
      inserted++;
    }
  }

  console.log('');
  console.log(`Resultat: ${inserted} inseres, ${errors} erreurs`);

  // 4. Verification
  const { data: check, error: checkErr } = await supabase
    .from('employees')
    .select('id, name, role, contract_hours')
    .eq('organization_id', ORG_ID)
    .order('role')
    .order('name');

  if (checkErr) {
    console.error('Erreur verification:', checkErr);
  } else {
    console.log(`\nVerification: ${check.length} employes en base`);
    check.forEach((e: { name: string; role: string; contract_hours: number }) => {
      console.log(`   ${e.role}: ${e.name} (${e.contract_hours}h)`);
    });
  }

  console.log('\nSeed termine !');
}

seed().catch(console.error);
