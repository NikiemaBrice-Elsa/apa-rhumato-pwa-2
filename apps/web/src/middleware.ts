import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Contrôle d'accès par rôle (§42, §45, §46) — squelette Sprint 2.
 * Rafraîchit la session Supabase et protège les routes /(dashboard) et /admin.
 * Les règles d'autorisation fines (patient vs professionnel vs admin) seront
 * étendues au fil des sprints (§41 espace professionnel, §42 administration).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Correctif Sprint 33 octies (27/09/2026) : `getUser()` interroge toujours
  // le serveur Supabase (contrairement à `getSession()`, qui se contente de
  // décoder le cookie local) — une coupure réseau ou une latence importante
  // peut donc la faire échouer même avec une session par ailleurs valide. Un
  // échec ici ne doit jamais faire planter le middleware (page d'erreur au
  // lieu de l'application) : on le traite prudemment comme "non vérifié",
  // exactement le même comportement qu'avant (redirection vers /connexion).
  // En pratique, ce cas ne se présente presque jamais pour une page déjà
  // consultée hors connexion : le service worker (public/sw.js) répond alors
  // directement depuis son cache, sans jamais atteindre ce middleware.
  let user = null;
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch {
    user = null;
  }

  const protectedPrefixes = [
    "/tableau-de-bord",
    "/profil",
    "/evaluation",
    "/exercices",
    "/programme",
    "/seance",
    "/suivi",
    "/statistiques",
    "/rapport",
    "/notifications",
    "/abonnement",
    "/admin",
    "/professionnels",
    "/professionnel",
  ];
  const isProtected = protectedPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = new URL("/connexion", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/tableau-de-bord/:path*",
    "/profil/:path*",
    "/evaluation/:path*",
    "/exercices/:path*",
    "/programme/:path*",
    "/seance/:path*",
    "/suivi/:path*",
    "/statistiques/:path*",
    "/rapport/:path*",
    "/notifications/:path*",
    "/abonnement/:path*",
    "/admin/:path*",
    "/professionnels/:path*",
    "/professionnel/:path*",
  ],
};
