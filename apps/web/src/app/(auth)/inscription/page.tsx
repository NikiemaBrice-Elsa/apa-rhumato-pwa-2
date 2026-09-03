import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { SignUpForm } from "@/components/forms/SignUpForm";

export default function SignUpPage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">{dict.auth.signupTitle}</h1>
      <SignUpForm />
      <p className="text-center text-sm text-primary-700">
        {dict.auth.haveAccount}{" "}
        <Link href="/connexion" className="font-medium underline">
          {dict.auth.submitLogin}
        </Link>
      </p>
    </main>
  );
}
