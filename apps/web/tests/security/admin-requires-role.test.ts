import { describe, expect, it, vi } from "vitest";

/**
 * §46 : « ne jamais faire confiance uniquement aux contrôles frontend » —
 * ce test cible directement `requireAdmin` (apps/web/src/lib/adminAuth.ts),
 * le garde-fou serveur unique par lequel TOUTES les routes /api/admin/*
 * passent avant d'utiliser la clé service_role (qui contourne RLS). C'est
 * la ligne de défense la plus critique de ce sprint : si elle est
 * contournable, tout l'espace administrateur l'est aussi.
 */
const { mockState } = vi.hoisted(() => ({
  mockState: {
    user: null as { id: string } | null,
    profile: null as { role: string; status: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockState.user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockState.profile, error: null }),
        }),
      }),
    }),
  }),
}));

const { requireAdmin } = await import("@/lib/adminAuth");

describe("requireAdmin", () => {
  it("refuse (401) sans utilisateur authentifié", async () => {
    mockState.user = null;
    mockState.profile = null;
    const result = await requireAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("refuse (403) un utilisateur authentifié avec le rôle patient", async () => {
    mockState.user = { id: "u1" };
    mockState.profile = { role: "patient", status: "active" };
    const result = await requireAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("refuse (403) un utilisateur authentifié avec le rôle professional", async () => {
    mockState.user = { id: "u2" };
    mockState.profile = { role: "professional", status: "active" };
    const result = await requireAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("refuse (403) un administrateur dont le compte est suspendu", async () => {
    mockState.user = { id: "u3" };
    mockState.profile = { role: "admin", status: "suspended" };
    const result = await requireAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("refuse (403) si la ligne 'users' est introuvable (profil non provisionné)", async () => {
    mockState.user = { id: "u4" };
    mockState.profile = null;
    const result = await requireAdmin();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("accepte un administrateur actif", async () => {
    mockState.user = { id: "admin-1" };
    mockState.profile = { role: "admin", status: "active" };
    const result = await requireAdmin();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.adminUserId).toBe("admin-1");
  });
});
