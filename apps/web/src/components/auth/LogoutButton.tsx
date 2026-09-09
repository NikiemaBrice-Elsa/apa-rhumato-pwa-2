"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Déconnexion (demande du 09/09/2026) — la route API `/api/auth/logout`
 * existait déjà (appelle `supabase.auth.signOut()`) mais n'était appelée
 * depuis AUCUN bouton de l'application : il était donc impossible de se
 * déconnecter sans vider manuellement les cookies du navigateur. Ce
 * composant est le premier point d'entrée UI vers cette route.
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/connexion");
      router.refresh();
    }
  }

  return (
    <Button type="button" variant="secondary" className={className} disabled={loading} onClick={handleLogout}>
      {loading ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}
