import type { Metadata } from 'next';
import { OrganizationProvider } from '@/lib/supabase/client';
import { ToastProvider } from '@/components/ui/Toast';
import { Toaster } from 'sonner';
import AppShell from '@/components/layout/AppShell';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'PharmaPlanning - Planning Pharmacie',
  description: 'Application de planning multi-tenant pour pharmacies. Gestion des horaires, gardes et conformite legale.',
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
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={4000}
          toastOptions={{
            style: {
              fontFamily: 'var(--font-family-primary)',
            },
          }}
        />
      </body>
    </html>
  );
}
