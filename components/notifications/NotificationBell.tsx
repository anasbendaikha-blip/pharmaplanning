'use client';

/**
 * NotificationBell — Composant cloche de notifications dans le Header
 *
 * - Icone cloche SVG avec badge compteur non-lus
 * - Dropdown panel avec liste des 20 dernieres notifications
 * - Polling toutes les 30s pour rafraichir
 * - Clic sur notification → marquer lu + navigation
 * - Bouton "Tout marquer lu"
 *
 * Resolution employeeId : matche l'email du user auth avec l'email genere
 * des employes (pattern firstname@pharmacie-maurer.fr).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import Link from 'next/link';
import type { DbNotification } from '@/lib/notifications/types';

/** Icones SVG par type de notification */
function getTypeIcon(type: string): string {
  switch (type) {
    case 'shift_created':
    case 'shift_updated':
    case 'shift_deleted':
      return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
    case 'leave_requested':
    case 'leave_approved':
    case 'leave_rejected':
      return 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4';
    case 'compliance_alert':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z';
    case 'weekly_summary':
      return 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    default:
      return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
  }
}

/** Couleur de priorite */
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'var(--color-danger-500)';
    case 'high': return 'var(--color-warning-500)';
    case 'normal': return 'var(--color-secondary-500)';
    case 'low': return 'var(--color-neutral-400)';
    default: return 'var(--color-secondary-500)';
  }
}

/** Temps relatif en francais */
function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'A l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD < 7) return `Il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const { organizationId, user } = useOrganization();
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Resoudre l'employeeId a partir de l'email du user auth
  const resolveEmployeeId = useCallback(async () => {
    if (!organizationId || !user?.email) return;

    try {
      const res = await fetch(`/api/employees?organizationId=${organizationId}`);
      if (!res.ok) return;
      const employees = await res.json();

      // L'email du user auth peut correspondre a un employe
      // On prend le premier Pharmacien par defaut (titulaire)
      // car dans notre schema, seuls les titulaires ont un compte auth
      if (employees.length > 0) {
        // Essayer de matcher par email
        const matched = employees.find(
          (emp: Record<string, unknown>) => {
            const fn = (emp.first_name as string || '').toLowerCase().replace(/\s/g, '');
            const generatedEmail = `${fn}@pharmacie-maurer.fr`;
            return generatedEmail === user.email;
          },
        );

        if (matched) {
          setEmployeeId(matched.id as string);
        } else {
          // Prendre le premier employe (fallback pour demo)
          setEmployeeId(employees[0].id as string);
        }
      }
    } catch {
      // Silencieux
    }
  }, [organizationId, user?.email]);

  useEffect(() => {
    resolveEmployeeId();
  }, [resolveEmployeeId]);

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    if (!organizationId || !employeeId) return;

    try {
      const res = await fetch(
        `/api/notifications?organizationId=${organizationId}&employeeId=${employeeId}`,
      );
      if (!res.ok) return;
      const data: DbNotification[] = await res.json();

      setNotifications(data.slice(0, 20));
      setUnreadCount(data.filter(n => !n.read).length);
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
    }
  }, [organizationId, employeeId]);

  // Chargement initial + polling 30s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Fermer le panel au clic exterieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Marquer une notification comme lue
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      loadNotifications();
    } catch {
      // Silencieux
    }
  };

  // Tout marquer lu
  const markAllAsRead = async () => {
    if (!organizationId || !employeeId) return;

    try {
      await fetch(
        `/api/notifications?organizationId=${organizationId}&employeeId=${employeeId}&markAllRead=true`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      loadNotifications();
    } catch {
      // Silencieux
    }
  };

  return (
    <div className="notif-center" ref={panelRef}>
      <button
        className="notif-bell"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-panel">
          <div className="panel-header">
            <span className="panel-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="btn-mark-all" onClick={markAllAsRead} type="button">
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Chargement...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">Aucune notification</div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notif-item${!notif.read ? ' notif-unread' : ''}`}
                  onClick={() => markAsRead(notif.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') markAsRead(notif.id); }}
                >
                  <div className="notif-icon" style={{ color: getPriorityColor(notif.priority) }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={getTypeIcon(notif.type)} />
                    </svg>
                  </div>

                  <div className="notif-content">
                    <div className="notif-title">{notif.title}</div>
                    <div className="notif-message">{notif.message}</div>
                    <div className="notif-time">{getRelativeTime(notif.created_at)}</div>
                  </div>

                  {notif.action_url && (
                    <Link href={notif.action_url} className="notif-action" title="Voir" onClick={(e) => e.stopPropagation()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .notif-center {
          position: relative;
        }

        .notif-bell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: none;
          border: 1px solid var(--color-neutral-200);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .notif-bell:hover {
          background: var(--color-primary-50);
          border-color: var(--color-primary-200);
          color: var(--color-primary-700);
        }

        .notif-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--color-danger-500);
          color: white;
          font-size: 10px;
          font-weight: var(--font-weight-bold);
          padding: 1px 5px;
          border-radius: var(--radius-full);
          min-width: 16px;
          text-align: center;
          line-height: 14px;
        }

        .notif-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 380px;
          max-height: 500px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-dropdown);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-4);
          border-bottom: 1px solid var(--color-neutral-200);
          flex-shrink: 0;
        }

        .panel-title {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .btn-mark-all {
          padding: var(--spacing-1) var(--spacing-3);
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-mark-all:hover {
          background: var(--color-primary-500);
          border-color: var(--color-primary-500);
          color: white;
        }

        .notif-list {
          overflow-y: auto;
          flex: 1;
          max-height: 440px;
        }

        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: pointer;
          transition: background var(--transition-fast);
        }

        .notif-item:hover {
          background: var(--color-neutral-50);
        }

        .notif-unread {
          background: var(--color-primary-50);
        }

        .notif-unread:hover {
          background: var(--color-primary-100);
        }

        .notif-icon {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          background: var(--color-neutral-100);
        }

        .notif-content {
          flex: 1;
          min-width: 0;
        }

        .notif-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
          margin-bottom: 2px;
        }

        .notif-message {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-600);
          line-height: var(--line-height-normal);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notif-time {
          font-size: 11px;
          color: var(--color-neutral-400);
          margin-top: 2px;
        }

        .notif-item :global(.notif-action) {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          color: var(--color-neutral-400);
          text-decoration: none;
          transition: all var(--transition-fast);
        }

        .notif-item :global(.notif-action:hover) {
          background: var(--color-primary-100);
          color: var(--color-primary-700);
        }

        .notif-empty {
          padding: var(--spacing-8) var(--spacing-4);
          text-align: center;
          color: var(--color-neutral-400);
          font-size: var(--font-size-sm);
        }

        @media (max-width: 640px) {
          .notif-panel {
            width: calc(100vw - 32px);
            right: -80px;
          }
        }
      `}</style>
    </div>
  );
}
