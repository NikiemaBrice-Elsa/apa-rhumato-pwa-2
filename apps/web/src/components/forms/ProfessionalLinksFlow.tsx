"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PROFESSIONAL_LINK_STATUS_LABELS_FR } from "@apa/domain";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface LinkRow {
  id: string;
  status: "pending" | "authorized" | "revoked";
  requested_at: string;
  decided_at: string | null;
  professional: { first_name: string; last_name: string | null; email: string | null } | null;
}

function professionalLabel(professional: LinkRow["professional"]): string {
  if (!professional) return "Professionnel";
  return [professional.first_name, professional.last_name].filter(Boolean).join(" ") || professional.email || "Professionnel";
}

/**
 * Gestion des professionnels de santé autorisés à consulter mon rapport
 * (§41) — Sprint 23 (13/09/2026). Toujours à mon initiative (invitation par
 * email) : le professionnel doit déjà avoir un compte (créé par
 * l'administrateur) et accepter mon invitation avant de voir quoi que ce
 * soit — voir migration 0021 et /api/professional-links.
 */
export function ProfessionalLinksFlow() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/professional-links");
      const data = await res.json();
      if (res.ok) setLinks(data.links ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const res = await fetch("/api/professional-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.message ?? "Une erreur est survenue.");
        return;
      }
      setInviteSuccess(true);
      setEmail("");
      await reload();
    } catch {
      setInviteError("Une erreur est survenue. Vous pouvez réessayer.");
    } finally {
      setInviting(false);
    }
  }

  async function revoke(id: string) {
    setActioning(id);
    try {
      const res = await fetch(`/api/professional-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      });
      if (res.ok) await reload();
    } finally {
      setActioning(null);
    }
  }

  async function reinvite(id: string) {
    setActioning(id);
    try {
      const res = await fetch(`/api/professional-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (res.ok) await reload();
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-primary-700">
        Invitez un professionnel de santé (kinésithérapeute, médecin traitant) à consulter votre rapport
        de suivi. Il doit déjà avoir un compte professionnel — s'il n'en a pas, demandez-lui de se
        rapprocher de l'administrateur. Vous pouvez révoquer son accès à tout moment.
      </p>

      <form onSubmit={invite} className="flex flex-col gap-3">
        <Field label="Email du professionnel de santé" htmlFor="professionalEmail">
          <input
            id="professionalEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="exemple@cabinet.tld"
          />
        </Field>
        {inviteError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {inviteError}
          </p>
        )}
        {inviteSuccess && <p className="text-sm text-green-700">Invitation envoyée.</p>}
        <Button type="submit" disabled={inviting}>
          {inviting ? "Envoi…" : "Inviter"}
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-primary-900">Mes professionnels</h2>
        {loading && <p className="text-primary-700">Chargement…</p>}
        {!loading && links.length === 0 && <p className="text-sm text-primary-500">Aucun professionnel invité pour l'instant.</p>}
        {links.map((link) => (
          <div key={link.id} className="flex items-center justify-between rounded-xl border border-primary-200 p-4">
            <div>
              <p className="font-medium text-primary-900">{professionalLabel(link.professional)}</p>
              <p className="text-sm text-primary-500">{PROFESSIONAL_LINK_STATUS_LABELS_FR[link.status]}</p>
            </div>
            {link.status !== "revoked" ? (
              <Button type="button" variant="secondary" disabled={actioning === link.id} onClick={() => revoke(link.id)}>
                Révoquer
              </Button>
            ) : (
              <Button type="button" variant="secondary" disabled={actioning === link.id} onClick={() => reinvite(link.id)}>
                Réinviter
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
