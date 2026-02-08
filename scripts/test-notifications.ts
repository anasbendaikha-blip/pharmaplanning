/**
 * Script de test des notifications
 * Usage: npm run test:notifications
 *        npx tsx scripts/test-notifications.ts
 *
 * Teste l'envoi de notifications (email + in-app) pour chaque type.
 * Necessite les variables d'environnement :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import dynamique du service (necessite les env vars)
async function getNotificationService() {
  const mod = await import('../lib/notifications/notification-service');
  return mod.NotificationService;
}

async function testNotifications() {
  console.log('🧪 ═══════════════════════════════════════════════');
  console.log('   TESTS NOTIFICATIONS PharmaPlanning');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Verifier connexion Supabase
  console.log('1️⃣  Verification connexion Supabase...');
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(1)
    .single();

  if (orgError || !orgData) {
    console.error('❌ Impossible de se connecter a Supabase:', orgError?.message);
    process.exit(1);
  }
  console.log(`✅ Connecte a Supabase — Org: ${orgData.name}\n`);

  // 2. Trouver un employe de test
  console.log('2️⃣  Recherche employe de test...');
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('organization_id', orgData.id)
    .limit(1);

  if (empError || !employees || employees.length === 0) {
    console.error('❌ Aucun employe trouve:', empError?.message);
    process.exit(1);
  }

  const testEmployee = employees[0];
  const testName = `${testEmployee.first_name} ${testEmployee.last_name}`.trim();
  const testEmail = `${testEmployee.first_name.toLowerCase().replace(/\s/g, '')}@pharmacie-coquelicots.fr`;
  console.log(`✅ Employe de test: ${testName} (${testEmail})`);
  console.log(`   ID: ${testEmployee.id}\n`);

  const NotificationService = await getNotificationService();

  let passed = 0;
  let failed = 0;

  // 3. Test shift_created
  console.log('3️⃣  Test shift_created...');
  try {
    await NotificationService.send({
      type: 'shift_created',
      priority: 'normal',
      organizationId: orgData.id,
      employeeId: testEmployee.id,
      recipientEmail: testEmail,
      recipientName: testName,
      title: '[TEST] Nouveau shift planifie',
      message: 'Shift de test le 2026-02-15',
      actionUrl: '/planning',
      data: {
        employeeName: testName,
        date: '2026-02-15',
        startTime: '09:00',
        endTime: '17:00',
        hours: 8,
      },
    });
    console.log('✅ shift_created OK\n');
    passed++;
  } catch (error) {
    console.error('❌ shift_created FAILED:', error, '\n');
    failed++;
  }

  // 4. Test shift_updated
  console.log('4️⃣  Test shift_updated...');
  try {
    await NotificationService.send({
      type: 'shift_updated',
      priority: 'normal',
      organizationId: orgData.id,
      employeeId: testEmployee.id,
      recipientEmail: testEmail,
      recipientName: testName,
      title: '[TEST] Shift modifie',
      message: 'Shift modifie pour le 2026-02-15',
      actionUrl: '/planning',
      data: {
        employeeName: testName,
        date: '2026-02-15',
        startTime: '10:00',
        endTime: '18:00',
        hours: 8,
      },
    });
    console.log('✅ shift_updated OK\n');
    passed++;
  } catch (error) {
    console.error('❌ shift_updated FAILED:', error, '\n');
    failed++;
  }

  // 5. Test shift_deleted
  console.log('5️⃣  Test shift_deleted...');
  try {
    await NotificationService.send({
      type: 'shift_deleted',
      priority: 'high',
      organizationId: orgData.id,
      employeeId: testEmployee.id,
      recipientEmail: testEmail,
      recipientName: testName,
      title: '[TEST] Shift supprime',
      message: 'Shift du 2026-02-15 supprime',
      actionUrl: '/planning',
      data: {
        employeeName: testName,
        date: '2026-02-15',
        startTime: '09:00',
        endTime: '17:00',
      },
    });
    console.log('✅ shift_deleted OK\n');
    passed++;
  } catch (error) {
    console.error('❌ shift_deleted FAILED:', error, '\n');
    failed++;
  }

  // 6. Test leave_approved
  console.log('6️⃣  Test leave_approved...');
  try {
    await NotificationService.send({
      type: 'leave_approved',
      priority: 'normal',
      organizationId: orgData.id,
      employeeId: testEmployee.id,
      recipientEmail: testEmail,
      recipientName: testName,
      title: '[TEST] Conge approuve',
      message: 'Conge du 01/03 au 07/03 approuve',
      actionUrl: '/conges',
      data: {
        employeeName: testName,
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        days: 5,
        leaveType: 'Conges payes',
      },
    });
    console.log('✅ leave_approved OK\n');
    passed++;
  } catch (error) {
    console.error('❌ leave_approved FAILED:', error, '\n');
    failed++;
  }

  // 7. Test compliance_alert
  console.log('7️⃣  Test compliance_alert...');
  try {
    await NotificationService.send({
      type: 'compliance_alert',
      priority: 'urgent',
      organizationId: orgData.id,
      employeeId: testEmployee.id,
      recipientEmail: testEmail,
      recipientName: testName,
      title: '[TEST] Alerte conformite',
      message: 'Depassement heures hebdomadaires',
      actionUrl: '/titulaire/conformite',
      data: {
        violationType: 'Heures hebdomadaires',
        message: 'Un employe depasse le seuil de 48h/semaine',
        suggestion: 'Reduire les shifts de la semaine prochaine',
      },
    });
    console.log('✅ compliance_alert OK\n');
    passed++;
  } catch (error) {
    console.error('❌ compliance_alert FAILED:', error, '\n');
    failed++;
  }

  // 8. Test weekly_summary
  console.log('8️⃣  Test weekly_summary...');
  try {
    await NotificationService.send({
      type: 'weekly_summary',
      priority: 'low',
      organizationId: orgData.id,
      employeeId: testEmployee.id,
      recipientEmail: testEmail,
      recipientName: testName,
      title: '[TEST] Resume hebdomadaire',
      message: 'Resume de la semaine 7',
      actionUrl: '/recap',
      data: {
        weekNumber: 7,
        year: 2026,
        totalHours: 280,
        totalShifts: 35,
        employeesCount: 8,
      },
    });
    console.log('✅ weekly_summary OK\n');
    passed++;
  } catch (error) {
    console.error('❌ weekly_summary FAILED:', error, '\n');
    failed++;
  }

  // 9. Verifier notifications in-app en BDD
  console.log('9️⃣  Verification notifications en BDD...');
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('id, type, title, read, created_at')
    .eq('employee_id', testEmployee.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (notifError) {
    console.error('❌ Erreur lecture BDD:', notifError);
  } else {
    console.log(`✅ ${notifications.length} notifications trouvees en BDD:`);
    notifications.forEach((n) => {
      const status = n.read ? '📖' : '🆕';
      console.log(`   ${status} [${n.type}] ${n.title} — ${n.created_at}`);
    });
  }

  // Resume
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`   RESULTATS: ${passed} OK / ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  Certains tests ont echoue. Verifiez:');
    console.log('   - RESEND_API_KEY est bien configuree');
    console.log('   - Les tables notifications et notification_preferences existent');
    console.log('   - Les templates email sont complets');
  } else {
    console.log('\n🎉 Tous les tests sont passes!');
  }

  console.log(`\n📧 Verifiez les emails envoyes a: ${testEmail}`);
  console.log('🔔 Verifiez le centre de notifications dans l\'app\n');
}

testNotifications().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
