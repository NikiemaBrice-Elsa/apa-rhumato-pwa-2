import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  const dict = getDictionary();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary-50 px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl bg-white px-8 py-10 text-center shadow-lg">
        <Logo size={96} />

        <div>
          <h1 className="text-2xl font-semibold text-primary-900">{dict.app.name}</h1>
          <p className="mt-2 text-primary-700">{dict.app.tagline}</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Link
            href="/inscription"
            className="rounded-xl bg-primary-700 px-5 py-3 text-center font-medium text-white shadow-sm transition hover:bg-primary-900"
          >
            {dict.auth.submitSignup}
          </Link>
          <Link
            href="/connexion"
            className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700 transition hover:bg-primary-50"
          >
            {dict.auth.submitLogin}
          </Link>
        </div>

        <p className="text-sm text-primary-500">
          Conception médicale et scientifique : Dr Wendtongo Brice Florent NIKIEMA, médecin rhumatologue.
        </p>
      </div>
    </main>
  );
}
