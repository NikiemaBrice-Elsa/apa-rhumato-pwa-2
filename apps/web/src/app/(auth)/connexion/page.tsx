import Link from "next/link";
import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n";
import { LoginForm } from "@/components/forms/LoginForm";

export default function LoginPage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">{dict.auth.loginTitle}</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-primary-700">
        {dict.auth.noAccount}{" "}
        <Link href="/inscription" className="font-medium underline">
          {dict.auth.submitSignup}
        </Link>
      </p>
    </main>
  );
}
