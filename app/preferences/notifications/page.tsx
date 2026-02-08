'use client';

/**
 * Page Preferences de notification
 *
 * Permet a chaque utilisateur de configurer ses preferences :
 *  - Activer/desactiver email et in-app globalement
 *  - Configurer par type de notification
 */

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import type { NotificationType, NotificationPreferences } from '@/lib/notifications/types';
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types';

const ALL_TYPES: NotificationType[] = [
  'shift_created',
  'shift_updated',
  'shift_deleted',
  'leave_requested',
  'leave_approved',
  'leave_rejected',
  'compliance_alert',
  'weekly_summary',
];

interface TypePrefs {
  email: boolean;
  inApp: boolean;
}

export default function NotificationPreferencesPage() {
  const { organizationId, user } = useOrganization();
  const [prefsId, setPrefsId] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [types, setTypes] = useState<Record<string, TypePrefs>>({});
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Resoudre employeeId
  const resolveEmployeeId = useCallback(async () => {
    if (!organizationId || !user?.email) return;

    try {
      const res = await fetch(`/api/employees?organizationId=${organizationId}`);
      if (!res.ok) return;
      const employees = await res.json();

      if (employees.length > 0) {
        const matched = employees.find(
          (emp: Record<string, unknown>) => {
            const fn = (emp.first_name as string || '').toLowerCase().replace(/\s/g, '');
            return `${fn}@pharmacie-coquelicots.fr` === user.email;
          },
        );
        setEmployeeId(matched ? (matched.id as string) : (employees[0].id as string));
      }
    } catch {
      // Silencieux
    }
  }, [organizationId, user?.email]);

  useEffect(() => {
    resolveEmployeeId();
  }, [resolveEmployeeId]);

  // Charger les preferences
  const loadPreferences = useCallback(async () => {
    if (!organizationId || !employeeId) return;

    try {
      const res = await fetch(
        `/api/notification-preferences?organizationId=${organizationId}&employeeId=${employeeId}`,
      );
      const data: NotificationPreferences | null = await res.json();

      if (data) {
        setPrefsId(data.id);
        setEmailEnabled(data.email_enabled);
        setInAppEnabled(data.in_app_enabled);
        setTypes((data.types as Record<string, TypePrefs>) || {});
      } else {
        // Preferences par defaut
        const defaultTypes: Record<string, TypePrefs> = {};
        ALL_TYPES.forEach(t => { defaultTypes[t] = { email: true, inApp: true }; });
        setTypes(defaultTypes);
      }
    } catch {
      // Utiliser les defaults
      const defaultTypes: Record<string, TypePrefs> = {};
      ALL_TYPES.forEach(t => { defaultTypes[t] = { email: true, inApp: true }; });
      setTypes(defaultTypes);
    } finally {
      setLoading(false);
    }
  }, [organizationId, employeeId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Sauvegarder
  const handleSave = async () => {
    if (!organizationId || !employeeId) return;

    setSaving(true);
    setSaved(false);

    try {
      if (prefsId) {
        // Update existant
        await fetch(`/api/notification-preferences?id=${prefsId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_enabled: emailEnabled, in_app_enabled: inAppEnabled, types }),
        });
      } else {
        // Creer
        const res = await fetch('/api/notification-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            employeeId,
            email_enabled: emailEnabled,
            in_app_enabled: inAppEnabled,
            types,
          }),
        });
        const data = await res.json();
        if (data?.id) setPrefsId(data.id);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Silencieux
    } finally {
      setSaving(false);
    }
  };

  // Toggle un type
  const toggleType = (type: string, channel: 'email' | 'inApp') => {
    setTypes(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channel]: !(prev[type]?.[channel] ?? true),
      },
    }));
  };

  if (loading) {
    return (
      <div className="prefs-loading">
        <p>Chargement des preferences...</p>
        <style jsx>{`
          .prefs-loading {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
            color: var(--color-neutral-500);
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="prefs-page">
        <div className="prefs-header">
          <h1 className="prefs-title">Preferences de notification</h1>
          <p className="prefs-subtitle">
            Configurez comment et quand vous souhaitez etre notifie.
          </p>
        </div>

        {/* Canaux globaux */}
        <section className="prefs-section">
          <h2 className="section-title">Canaux de notification</h2>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={e => setEmailEnabled(e.target.checked)}
            />
            <div className="toggle-info">
              <span className="toggle-label">Notifications par email</span>
              <span className="toggle-desc">Recevoir des emails pour les evenements importants</span>
            </div>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={inAppEnabled}
              onChange={e => setInAppEnabled(e.target.checked)}
            />
            <div className="toggle-info">
              <span className="toggle-label">Notifications in-app</span>
              <span className="toggle-desc">Voir les notifications dans la cloche du header</span>
            </div>
          </label>
        </section>

        {/* Types de notification */}
        <section className="prefs-section">
          <h2 className="section-title">Types de notification</h2>

          <div className="types-grid">
            <div className="types-header-row">
              <span className="types-col-label">Type</span>
              <span className="types-col-check">Email</span>
              <span className="types-col-check">In-app</span>
            </div>

            {ALL_TYPES.map(type => (
              <div key={type} className="types-row">
                <span className="type-name">{NOTIFICATION_TYPE_LABELS[type]}</span>

                <label className="type-checkbox">
                  <input
                    type="checkbox"
                    checked={types[type]?.email ?? true}
                    onChange={() => toggleType(type, 'email')}
                    disabled={!emailEnabled}
                  />
                </label>

                <label className="type-checkbox">
                  <input
                    type="checkbox"
                    checked={types[type]?.inApp ?? true}
                    onChange={() => toggleType(type, 'inApp')}
                    disabled={!inAppEnabled}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Bouton sauvegarder */}
        <button
          className={`btn-save${saved ? ' btn-saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {saving ? 'Enregistrement...' : saved ? 'Preferences enregistrees' : 'Enregistrer les preferences'}
        </button>
      </div>

      <style jsx>{`
        .prefs-page {
          max-width: 800px;
          margin: 0 auto;
          padding: var(--spacing-8) var(--spacing-6);
        }

        .prefs-header {
          margin-bottom: var(--spacing-8);
        }

        .prefs-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
          margin: 0 0 var(--spacing-2);
        }

        .prefs-subtitle {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin: 0;
        }

        .prefs-section {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-6);
          margin-bottom: var(--spacing-6);
        }

        .section-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
          margin: 0 0 var(--spacing-4);
          padding-bottom: var(--spacing-3);
          border-bottom: 1px solid var(--color-neutral-100);
        }

        .toggle-row {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-3);
          padding: var(--spacing-3) 0;
          cursor: pointer;
        }

        .toggle-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          cursor: pointer;
          accent-color: var(--color-primary-600);
        }

        .toggle-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .toggle-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
        }

        .toggle-desc {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .types-grid {
          display: flex;
          flex-direction: column;
        }

        .types-header-row,
        .types-row {
          display: grid;
          grid-template-columns: 2fr 80px 80px;
          gap: var(--spacing-3);
          padding: var(--spacing-3) 0;
          align-items: center;
        }

        .types-header-row {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--color-neutral-200);
          padding-bottom: var(--spacing-2);
          margin-bottom: var(--spacing-1);
        }

        .types-col-check {
          text-align: center;
        }

        .types-row {
          border-bottom: 1px solid var(--color-neutral-100);
        }

        .types-row:last-child {
          border-bottom: none;
        }

        .type-name {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
        }

        .type-checkbox {
          display: flex;
          justify-content: center;
          cursor: pointer;
        }

        .type-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--color-primary-600);
        }

        .type-checkbox input[type="checkbox"]:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-save {
          width: 100%;
          padding: var(--spacing-4);
          background: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-base);
          cursor: pointer;
          transition: all var(--transition-normal);
        }

        .btn-save:hover:not(:disabled) {
          background: var(--color-primary-700);
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-saved {
          background: var(--color-primary-800);
        }

        @media (max-width: 640px) {
          .prefs-page {
            padding: var(--spacing-4);
          }
        }
      `}</style>
    </>
  );
}
