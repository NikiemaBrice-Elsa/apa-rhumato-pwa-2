"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const dict = getDictionary();

type FieldErrors = Record<string, string>;

export function SignUpForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") || ""),
      lastName: String(formData.get("lastName") || "") || undefined,
      email: String(formData.get("email") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      password: String(formData.get("password") || ""),
      consentTerms: formData.get("consentTerms") === "on",
      consentDataProcessing: formData.get("consentDataProcessing") === "on",
    };

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.message ?? dict.common.genericError);
        return;
      }

      router.push("/profil");
    } catch {
      setFormError(dict.common.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label={dict.auth.firstName} htmlFor="firstName" error={errors.firstName}>
        <input id="firstName" name="firstName" required className="input" autoComplete="given-name" />
      </Field>

      <Field label={dict.auth.lastName} htmlFor="lastName">
        <input id="lastName" name="lastName" className="input" autoComplete="family-name" />
      </Field>

      <Field label={dict.auth.email} htmlFor="email" error={errors.email}>
        <input id="email" name="email" type="email" className="input" autoComplete="email" />
      </Field>

      <Field label={dict.auth.phone} htmlFor="phone">
        <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" />
      </Field>

      <Field label={dict.auth.password} htmlFor="password" hint="8 caractères minimum." error={errors.password}>
        <input id="password" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consentTerms" required className="mt-1" />
        <span>{dict.auth.consentTerms}</span>
      </label>
      {errors.consentTerms && <p role="alert" className="text-sm text-red-700">{errors.consentTerms}</p>}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consentDataProcessing" required className="mt-1" />
        <span>{dict.auth.consentDataProcessing}</span>
      </label>
      {errors.consentDataProcessing && (
        <p role="alert" className="text-sm text-red-700">{errors.consentDataProcessing}</p>
      )}

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? dict.common.loading : dict.auth.submitSignup}
      </Button>
    </form>
  );
}
