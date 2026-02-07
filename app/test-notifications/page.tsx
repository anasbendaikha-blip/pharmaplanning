'use client';

import { useState } from 'react';
import { useOrganization } from '@/lib/supabase/client';

type TestResult = {
  type: string;
  status: 'success' | 'error' | 'pending';
  message: string;
};

export default function TestNotificationsPage() {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  async function runTest(
    label: string,
    testFn: () => Promise<Response>,
  ) {
    setResults((prev) => [
      ...prev,
      { type: label, status: 'pending', message: 'En cours...' },
    ]);

    try {
      const response = await testFn();
      const data = await response.json();

      setResults((prev) =>
        prev.map((r) =>
          r.type === label && r.status === 'pending'
            ? {
                ...r,
                status: response.ok ? 'success' : 'error',
                message: response.ok
                  ? `OK — ${JSON.stringify(data).slice(0, 100)}`
                  : `Erreur ${response.status}: ${data.error || JSON.stringify(data)}`,
              }
            : r,
        ),
      );

      return response.ok;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setResults((prev) =>
        prev.map((r) =>
          r.type === label && r.status === 'pending'
            ? { ...r, status: 'error', message }
            : r,
        ),
      );
      return false;
    }
  }

  async function testCreateShift() {
    if (!organizationId) {
      alert('Connectez-vous d\'abord pour avoir un organizationId');
      return;
    }

    setLoading(true);
    setResults([]);

    // Fetch un employe de test
    const empResponse = await fetch(
      `/api/employees?organizationId=${organizationId}`,
    );
    if (!empResponse.ok) {
      setResults([
        {
          type: 'Fetch employee',
          status: 'error',
          message: 'Impossible de charger les employes',
        },
      ]);
      setLoading(false);
      return;
    }

    const employees = await empResponse.json();
    if (!employees || employees.length === 0) {
      setResults([
        {
          type: 'Fetch employee',
          status: 'error',
          message: 'Aucun employe trouve',
        },
      ]);
      setLoading(false);
      return;
    }

    const testEmp = employees[0];
    setResults([
      {
        type: 'Fetch employee',
        status: 'success',
        message: `Employe: ${testEmp.first_name} ${testEmp.last_name} (${testEmp.id})`,
      },
    ]);

    // Test POST shift
    await runTest('POST /api/shifts (shift_created)', () =>
      fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          employee_id: testEmp.id,
          date: '2026-02-15',
          start_time: '09:00',
          end_time: '17:00',
          hours: 8,
        }),
      }),
    );

    // Check notifications
    await runTest('GET /api/notifications', () =>
      fetch(
        `/api/notifications?organizationId=${organizationId}&employeeId=${testEmp.id}`,
      ),
    );

    setLoading(false);
  }

  async function testNotificationsList() {
    if (!organizationId) return;

    setLoading(true);
    setResults([]);

    const empResponse = await fetch(
      `/api/employees?organizationId=${organizationId}`,
    );
    const employees = await empResponse.json();
    if (!employees?.length) {
      setResults([{ type: 'Error', status: 'error', message: 'Aucun employe' }]);
      setLoading(false);
      return;
    }

    await runTest('GET /api/notifications', () =>
      fetch(
        `/api/notifications?organizationId=${organizationId}&employeeId=${employees[0].id}`,
      ),
    );

    setLoading(false);
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Test Notifications</h1>
      <p style={{ color: '#64748b', marginBottom: '8px' }}>
        Page de test interne pour valider le systeme de notifications.
      </p>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '32px' }}>
        Organization ID: {organizationId || 'non connecte'}
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={testCreateShift}
          disabled={loading || !organizationId}
          style={{
            padding: '12px 24px',
            background: loading ? '#94a3b8' : '#2e7d32',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {loading ? 'Test en cours...' : 'Test Shift Created + Notification'}
        </button>

        <button
          onClick={testNotificationsList}
          disabled={loading || !organizationId}
          style={{
            padding: '12px 24px',
            background: loading ? '#94a3b8' : '#1e40af',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Lister Notifications
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Resultats
          </h2>
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '8px',
                background:
                  r.status === 'success'
                    ? '#d1fae5'
                    : r.status === 'error'
                      ? '#fee2e2'
                      : '#f0f9ff',
                border: `1px solid ${
                  r.status === 'success'
                    ? '#6ee7b7'
                    : r.status === 'error'
                      ? '#fca5a5'
                      : '#93c5fd'
                }`,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                {r.status === 'success' && '✅ '}
                {r.status === 'error' && '❌ '}
                {r.status === 'pending' && '⏳ '}
                {r.type}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  marginTop: '4px',
                  wordBreak: 'break-all',
                }}
              >
                {r.message}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: '40px',
          padding: '20px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          Checklist apres test
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '2' }}>
          <li>- Console terminal : logs [NotificationService], [Email], [InApp]</li>
          <li>- Email recu dans la boite mail</li>
          <li>- Badge notification dans le header</li>
          <li>- Notification in-app visible dans le centre de notifications</li>
          <li>- Preferences respectees (opt-out fonctionne)</li>
        </ul>
      </div>
    </div>
  );
}
