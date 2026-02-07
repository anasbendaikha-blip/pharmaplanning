'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const TABS = [
  { href: '/employe', label: 'Mon Planning', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/employe/disponibilites', label: 'Disponibilites', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/employe/demandes', label: 'Demandes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

export default function EmployeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="employe-layout">
      <nav className="employe-tabs" aria-label="Navigation portail employe">
        {TABS.map(tab => {
          const isActive = tab.href === '/employe'
            ? pathname === '/employe'
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab-link ${isActive ? 'tab-link--active' : ''}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="employe-content">
        {children}
      </div>

      <style jsx>{`
        .employe-layout {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-5);
          max-width: 900px;
        }

        .employe-tabs {
          display: flex;
          gap: var(--spacing-2);
          border-bottom: 2px solid var(--color-neutral-200);
          padding-bottom: var(--spacing-1);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .employe-tabs :global(.tab-link) {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          border-radius: var(--radius-md) var(--radius-md) 0 0;
          color: var(--color-neutral-500);
          text-decoration: none;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          white-space: nowrap;
          transition: all var(--transition-fast);
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
        }

        .employe-tabs :global(.tab-link:hover) {
          color: var(--color-primary-700);
          background: var(--color-primary-50);
        }

        .employe-tabs :global(.tab-link--active) {
          color: var(--color-primary-800);
          border-bottom-color: var(--color-primary-600);
          background: var(--color-primary-50);
        }

        .employe-content {
          min-height: 400px;
        }

        @media (max-width: 640px) {
          .employe-tabs {
            gap: var(--spacing-1);
          }

          .employe-tabs :global(.tab-link) {
            padding: var(--spacing-2) var(--spacing-3);
            font-size: var(--font-size-xs);
          }

          .employe-tabs :global(.tab-link) span {
            display: none;
          }

          .employe-tabs :global(.tab-link--active) span {
            display: inline;
          }
        }
      `}</style>
    </div>
  );
}
