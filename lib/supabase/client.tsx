'use client';

import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Organization, OrganizationRole } from '@/lib/types';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

/* ---- Client Supabase browser (singleton) ---- */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}

/** @deprecated — utiliser createClient() */
export function getSupabaseClient() {
  return createClient();
}

/* ---- Types du contexte ---- */
interface OrganizationContextValue {
  organizationId: string | null;
  organization: Organization | null;
  organizationName: string | null;
  userRole: OrganizationRole | null;
  isLoading: boolean;
  user: User | null;
  signOut: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organizationId: null,
  organization: null,
  organizationName: null,
  userRole: null,
  isLoading: true,
  user: null,
  signOut: async () => {},
});

/* ---- Provider ---- */
interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<OrganizationRole | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  /** Charge l'organisation d'un user authentifié via l'API Route */
  const loadUserOrganization = useCallback(async (authUser: User) => {
    try {
      // Charger le mapping user → organization via API Route
      const res = await fetch(`/api/auth/user-organization?userId=${encodeURIComponent(authUser.id)}`);

      if (res.ok) {
        const data = await res.json();
        setOrganizationId(data.organization_id);
        setUserRole(data.role || 'employee');

        // Charger les détails de l'organisation
        const orgRes = await fetch(`/api/organizations?id=${encodeURIComponent(data.organization_id)}`);
        if (orgRes.ok) {
          const org = await orgRes.json();
          setOrganization({
            id: org.id,
            name: org.name,
            slug: org.slug || '',
            address: '',
            phone: '',
            email: '',
            logo_url: org.logo_url || null,
            finess_number: null,
            license_number: null,
            settings: {
              opening_hours: {},
              min_pharmacists_on_duty: 1,
              weekly_rest_hours: 35,
              max_daily_hours: 10,
              max_weekly_hours: 44,
              employee_categories: [
                'pharmacien_titulaire', 'pharmacien_adjoint',
                'preparateur', 'rayonniste', 'apprenti', 'etudiant',
              ],
              collective_agreement: 'pharmacie_officine',
              timezone: 'Europe/Paris',
              week_start_day: 1,
              time_format: '24h',
              ...(org.settings || {}),
            },
            subscription_plan: 'professional',
            subscription_status: 'active',
            trial_ends_at: null,
            created_at: org.created_at,
            updated_at: org.updated_at,
          } as Organization);
        }
      } else {
        console.warn('Aucune organisation trouvée pour cet utilisateur');
      }
    } catch (error) {
      console.error('Erreur chargement organisation utilisateur:', error);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          setUser(authUser);
          await loadUserOrganization(authUser);
        }
        // Pas de user → pas de redirect ici (le middleware s'en charge)
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    // Écouter les changements d'auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setIsLoading(true);
          await loadUserOrganization(session.user);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setOrganizationId(null);
          setOrganization(null);
          setUserRole(null);
          router.push('/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, router, loadUserOrganization]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [supabase, router]);

  const organizationName = organization?.name ?? null;

  return (
    <OrganizationContext.Provider
      value={{
        organizationId,
        organization,
        organizationName,
        userRole,
        isLoading,
        user,
        signOut,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

/* ---- Hook ---- */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization doit être utilisé dans un OrganizationProvider');
  }
  return context;
}
