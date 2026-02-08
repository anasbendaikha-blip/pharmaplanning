'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Tableau de bord',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
  },
  {
    href: '/planning',
    label: 'Planning',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/recap',
    label: 'Recapitulatif',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/gardes',
    label: 'Gardes',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/employes',
    label: 'Employes',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    href: '/equipe',
    label: 'Equipe & Horaires',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0zM17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857',
  },
  {
    href: '/calendrier-conges',
    label: 'Conges',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    href: '/titulaire/conges-annuel',
    label: 'Conges Annuel',
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  },
  {
    href: '/employe',
    label: 'Espace Employe',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    href: '/titulaire/recap-hebdo',
    label: 'Recap. Hebdo',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/titulaire/analytics',
    label: 'Analytics',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    href: '/titulaire/conformite',
    label: 'Conformite',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/titulaire/assistant-planning',
    label: 'Assistant Planning',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    href: '/preferences/notifications',
    label: 'Notifications',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileOpen(false), []);

  // Close on escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  const toggle = useCallback(() => setMobileOpen(prev => !prev), []);

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button
        className="hamburger-btn"
        onClick={toggle}
        type="button"
        aria-label="Menu de navigation"
        aria-expanded={mobileOpen}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {mobileOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>

      {/* Backdrop - mobile only */}
      {mobileOpen && (
        <div className="nav-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <nav className={`app-nav ${mobileOpen ? 'app-nav--open' : ''}`} aria-label="Navigation principale">
        <ul className="nav-list">
          {NAV_ITEMS.map(item => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link ${isActive ? 'nav-link--active' : ''}`}
                  onClick={closeMobileNav}
                >
                  <svg
                    className="nav-icon"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={item.icon} />
                  </svg>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <style jsx>{`
        .hamburger-btn {
          display: none;
          position: fixed;
          bottom: var(--spacing-4);
          right: var(--spacing-4);
          z-index: calc(var(--z-modal) + 1);
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          background-color: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: var(--shadow-lg);
          transition: background-color var(--transition-fast);
        }

        .hamburger-btn:hover {
          background-color: var(--color-primary-700);
        }

        .nav-backdrop {
          display: none;
        }

        .app-nav {
          position: sticky;
          top: var(--header-height);
          width: var(--nav-width);
          height: calc(100vh - var(--header-height));
          background-color: white;
          border-right: 1px solid var(--color-neutral-200);
          padding: var(--spacing-4) 0;
          overflow-y: auto;
          flex-shrink: 0;
        }

        .nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .nav-list :global(.nav-link) {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-2) var(--spacing-4);
          margin: 0 var(--spacing-2);
          border-radius: var(--radius-md);
          color: var(--color-neutral-600);
          text-decoration: none;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          transition: all var(--transition-fast);
        }

        .nav-list :global(.nav-link:hover) {
          background-color: var(--color-neutral-50);
          color: var(--color-neutral-900);
        }

        .nav-list :global(.nav-link--active) {
          background-color: var(--color-primary-50);
          color: var(--color-primary-800);
        }

        .nav-list :global(.nav-link--active:hover) {
          background-color: var(--color-primary-100);
        }

        .nav-list :global(.nav-icon) {
          flex-shrink: 0;
        }

        .nav-list :global(.nav-label) {
          white-space: nowrap;
        }

        /* ─── Mobile ─── */
        @media (max-width: 768px) {
          .hamburger-btn {
            display: flex;
          }

          .nav-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.4);
            z-index: var(--z-modal-backdrop);
          }

          .app-nav {
            position: fixed;
            top: 0;
            left: 0;
            width: 280px;
            height: 100vh;
            z-index: var(--z-modal);
            padding-top: var(--spacing-6);
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            box-shadow: var(--shadow-xl);
          }

          .app-nav.app-nav--open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
