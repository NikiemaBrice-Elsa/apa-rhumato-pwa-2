"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const dict = getDictionary();

type Status = "checking" | "ready" | "expired";

/**
 * Choix d'un nouveau mot de passe après un lien de réinitialisation
 * (recette du 08/09/2026). Le lien envoyé par Supabase place les jetons
 * d'authentification dans le fragment d'URL (`#access_token=…&type=recovery`
 * ou `#error=…&error_code=otp_expired` si le lien n'est plus valable) ;
 * `@supabase/ssr` détecte ce fragment automatiquement au chargement de la
 * page et déclenche l'évènement `PASSWORD_RECOVERY` — on n'a rien à parser
 * nous-mêmes, seulement écouter cet évènement et gérer le cas d'erreur.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cas où le lien est expiré ou a déjà été utilisé : Supabase renvoie
    // directement une erreur dans le fragment, sans évènement d'auth.
    if (window.location.hash.includes("error=")) {
      setStatus("expired");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // Filet de sécurité : si une session valide existe déjà au chargement
    // (l'évènement PASSWORD_RECOVERY a pu être émis avant la pose de
    // l'écouteur ci-dessus), on ne bloque pas l'utilisateur sur "checking".
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus((current) => (current === "checking" ? "ready" : current));
    });

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "expired" : current));
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setError(dict.auth.passwordMismatch);
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(dict.common.genericError);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/connexion"), 2000);
  }

  if (status === "checking") {
    return <p className="text-center text-sm text-primary-500">{dict.auth.resetLinkChecking}</p>;
  }

  if (status === "expired") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.auth.resetLinkExpired}
        </p>
        <Link href="/mot-de-passe-oublie">
          <Button type="button">{dict.auth.forgotPasswordTitle}</Button>
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
        {dict.auth.resetPasswordSuccess}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label={dict.auth.newPassword} htmlFor="password" hint="8 caractères minimum.">
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="input"
          autoComplete="new-password"
        />
      </Field>

      <Field label={dict.auth.confirmPassword} htmlFor="confirmPassword">
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="input"
          autoComplete="new-password"
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? dict.common.loading : dict.auth.submitResetPassword}
      </Button>
    </form>
  );
}
