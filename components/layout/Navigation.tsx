'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  /** Icône SVG inline */
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
    label: 'Récapitulatif',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    href: '/gardes',
    label: 'Gardes',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/employes',
    label: 'Employés',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    href: '/calendrier-conges',
    label: 'Congés',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    href: '/portail-employe',
    label: 'Portail Employé',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="app-nav" aria-label="Navigation principale">
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
        .app-nav {
          position: sticky;
          top: var(--header-height);
          width: var(--nav-width);
          height: calc(100vh - var(--header-height));
          background-color: white;
          border-right: 1px solid var(--color-neutral-200);
          padding: var(--spacing-4) 0;
          overflow-y: auto;
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
      `}</style>
    </>
  );
}
