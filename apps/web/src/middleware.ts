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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  ],
};
