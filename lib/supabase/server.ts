import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Organization, UserOrganization } from '@/lib/types';

/**
 * Crée un client Supabase côté serveur avec les cookies de session
 * Pour les Server Components et Route Handlers authentifiés
 */
export async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        /* eslint-disable @typescript-eslint/no-explicit-any */
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Peut échouer dans un Server Component (lecture seule)
          }
        },
      },
    }
  );
}

/**
 * Client service_role pour les opérations admin (bypasse RLS)
 */
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Récupère l'organisation de l'utilisateur connecté
 * Utilisé dans les Server Components pour l'isolation multi-tenant
 */
export async function getUserOrganization(): Promise<UserOrganization | null> {
  const supabase = await getServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Utiliser le service_role pour bypasser le RLS sur user_organizations
  const admin = getAdminClient();
  const { data } = await admin
    .from('user_organizations')
    .select('user_id, organization_id, role')
    .eq('user_id', user.id)
    .single();

  if (!data) return null;

  // Charger les détails de l'organisation
  const { data: org } = await admin
    .from('organizations')
    .select('*')
    .eq('id', data.organization_id)
    .single();

  return {
    user_id: data.user_id,
    organization_id: data.organization_id,
    role: data.role,
    organization: org as unknown as Organization,
  };
}

/**
 * Récupère uniquement l'organization_id pour les requêtes filtrées
 */
export async function getOrganizationId(): Promise<string | null> {
  const userOrg = await getUserOrganization();
  return userOrg?.organization_id ?? null;
}
