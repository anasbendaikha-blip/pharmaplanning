import type { Metadata } from 'next';
import { OrganizationProvider } from '@/lib/supabase/client';
import { ToastProvider } from '@/components/ui/Toast';
import AppShell from '@/components/layout/AppShell';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'PharmaPlanning - Planning Pharmacie',
  description: 'Application de planning multi-tenant pour pharmacies. Gestion des horaires, gardes et conformité légale.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <OrganizationProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </OrganizationProvider>
      </body>
    </html>
  );
}
