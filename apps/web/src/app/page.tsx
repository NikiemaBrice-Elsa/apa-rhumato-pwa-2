import Link from "next/link";
import { getDictionary } from "@/lib/i18n";

export default function HomePage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">{dict.app.name}</h1>
        <p className="mt-2 text-primary-700">{dict.app.tagline}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/inscription"
          className="rounded-xl bg-primary-700 px-5 py-3 text-center font-medium text-white shadow-sm"
        >
          {dict.auth.submitSignup}
        </Link>
        <Link
          href="/connexion"
          className="rounded-xl border border-primary-300 px-5 py-3 text-center font-medium text-primary-700"
        >
          {dict.auth.submitLogin}
        </Link>
      </div>

      <p className="text-sm text-primary-500">
        Conception médicale et scientifique : Dr Wendtongo Brice Florent NIKIEMA, médecin rhumatologue.
      </p>
    </main>
  );
}
