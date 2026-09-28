import { getDictionary } from "@/lib/i18n";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

export default function ResetPasswordPage() {
  const dict = getDictionary();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary-900">{dict.auth.resetPasswordTitle}</h1>
      <ResetPasswordForm />
    </main>
  );
}
