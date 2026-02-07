import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Routes publiques ne nécessitant pas d'authentification */
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];

/**
 * Middleware : rafraîchit la session auth et protège les routes
 * - Routes publiques (/login, etc.) : accessibles sans auth
 * - Routes API : passent sans redirect (retournent 401 si nécessaire)
 * - Toutes les autres routes : redirect vers /login si pas de session
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ne pas interférer avec les routes API
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Route publique → laisser passer
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Rafraîchir la session (important pour le token refresh)
  const { data: { user } } = await supabase.auth.getUser();

  // Pas de session et pas sur une route publique → redirect vers /login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Session active et sur /login → redirect vers /
  if (user && isPublicRoute) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
