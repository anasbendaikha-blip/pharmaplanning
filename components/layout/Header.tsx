'use client';

/**
 * Header principal - Affiche le nom de la pharmacie, l'utilisateur et le bouton déconnexion
 * Client Component : utilise useOrganization() pour le branding dynamique et l'auth
 */

import { useOrganization } from '@/lib/supabase/client';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function Header() {
  const { organization, userRole, user, signOut } = useOrganization();
  const pharmacyName = organization?.name ?? 'Pharmacie';

  /** Label du rôle en français */
  const roleLabel = (() => {
    switch (userRole) {
      case 'owner': return 'Titulaire';
      case 'admin': return 'Administrateur';
      case 'manager': return 'Responsable';
      case 'employee': return 'Employé';
      default: return 'Utilisateur';
    }
  })();

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-logo">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
              >
                <rect width="28" height="28" rx="6" fill="#2e7d32" />
                <path
                  d="M14 6v16M6 14h16"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="header-titles">
              <span className="header-app-name">PharmaPlanning</span>
              <span className="header-pharmacy-name">{pharmacyName}</span>
            </div>
          </div>

          <div className="header-actions">
            {user && (
              <span className="header-user-email">{user.email}</span>
            )}
            <span className="header-user-label">{roleLabel}</span>
            {user && <NotificationBell />}
            {user && (
              <button
                className="header-logout-btn"
                onClick={signOut}
                type="button"
                title="Déconnexion"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 14H3.333A1.333 1.333 0 012 12.667V3.333A1.333 1.333 0 013.333 2H6M10.667 11.333L14 8l-3.333-3.333M14 8H6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </header>

      <style jsx>{`
        .app-header {
          position: sticky;
          top: 0;
          height: var(--header-height);
          background-color: white;
          border-bottom: 1px solid var(--color-neutral-200);
          z-index: var(--z-sticky);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          padding: 0 var(--spacing-6);
          max-width: var(--content-max-width);
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
        }

        .header-logo {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .header-titles {
          display: flex;
          align-items: baseline;
          gap: var(--spacing-2);
        }

        .header-app-name {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-800);
        }

        .header-pharmacy-name {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-600);
          font-weight: var(--font-weight-medium);
        }

        .header-pharmacy-name::before {
          content: '—';
          margin-right: var(--spacing-2);
          color: var(--color-neutral-400);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
        }

        .header-user-email {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-user-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-500);
          padding: var(--spacing-1) var(--spacing-3);
          background-color: var(--color-neutral-100);
          border-radius: var(--radius-full);
        }

        .header-logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: none;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .header-logout-btn:hover {
          background: var(--color-danger-50);
          border-color: var(--color-danger-200);
          color: var(--color-danger-600);
        }
      `}</style>
    </>
  );
}
