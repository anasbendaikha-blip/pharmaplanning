'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Navigation from '@/components/layout/Navigation';

/** Routes où on n'affiche PAS le shell (Header + Nav) */
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/auth/activate'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Header />
      <Navigation />
      <main className="app-main">{children}</main>
    </div>
  );
}
