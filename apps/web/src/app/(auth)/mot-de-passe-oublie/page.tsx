import { getDictionary } from "@/lib/i18n";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-primary-900">{dict.auth.forgotPasswordTitle}</h1>
      <ForgotPasswordForm />
    </main>
  );
}
