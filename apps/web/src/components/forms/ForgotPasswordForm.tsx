"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const dict = getDictionary();

/**
 * Demande de réinitialisation de mot de passe (recette du 08/09/2026 : le
 * Dr Nikiema avait oublié son mot de passe et il n'existait aucun moyen de
 * le récupérer depuis l'application — seule une intervention manuelle via
 * le tableau de bord Supabase permettait d'envoyer un email de
 * réinitialisation). Ce formulaire couvre le cas normal, sans intervention
 * technique : Supabase envoie l'email lui-même via `resetPasswordForEmail`.
 *
 * Le lien envoyé pointe explicitement vers /nouveau-mot-de-passe (plutôt que
 * de dépendre de l'« URL du site » globale configurée dans Supabase), pour
 * rester correct même si ce réglage global change à nouveau par erreur.
 */
export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");

    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    });

    setSubmitting(false);

    // On affiche toujours le même message de succès, que l'adresse existe ou
    // non parmi les comptes enregistrés : ne pas révéler si un email est
    // associé à un compte est une pratique de sécurité standard.
    if (resetError) {
      setError(dict.common.genericError);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
          {dict.auth.forgotPasswordSuccess}
        </p>
        <Link href="/connexion" className="text-center text-sm font-medium text-primary-700 underline">
          {dict.auth.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-primary-700">{dict.auth.forgotPasswordInstructions}</p>

      <Field label={dict.auth.email} htmlFor="email">
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? dict.common.loading : dict.auth.submitForgotPassword}
      </Button>

      <Link href="/connexion" className="text-center text-sm font-medium text-primary-700 underline">
        {dict.auth.backToLogin}
      </Link>
    </form>
  );
}
