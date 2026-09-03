"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const dict = getDictionary();

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") || "");
    const password = String(formData.get("password") || "");

    const supabase = createSupabaseBrowserClient();
    // La V1 accepte email OU téléphone comme identifiant (§12) ; Supabase Auth
    // gère nativement l'email. Le login par téléphone (OTP) pourra être
    // activé ultérieurement sans changer ce formulaire.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(dict.common.genericError);
      return;
    }

    router.push(searchParams.get("redirectTo") || "/tableau-de-bord");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Email" htmlFor="identifier">
        <input id="identifier" name="identifier" type="email" required className="input" autoComplete="email" />
      </Field>

      <Field label={dict.auth.password} htmlFor="password">
        <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? dict.common.loading : dict.auth.submitLogin}
      </Button>
    </form>
  );
}
