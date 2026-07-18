import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const existing = await prisma.operator.findFirst();
  if (existing) redirect("/");

  const locale = await getLocale();

  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold">{t(locale, "onboarding_title")}</h1>
      <p className="mt-2 text-neutral-500">{t(locale, "onboarding_intro")}</p>
      <OnboardingForm
        labels={{
          name: t(locale, "operator_name"),
          email: t(locale, "operator_email"),
          submit: t(locale, "onboarding_submit"),
          error_required: t(locale, "error_required"),
          error_email_taken: t(locale, "error_email_taken"),
          error_invalid_number: t(locale, "error_invalid_number"),
        }}
      />
    </main>
  );
}
