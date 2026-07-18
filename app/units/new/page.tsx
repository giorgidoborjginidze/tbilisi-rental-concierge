import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import UnitForm from "../unit-form";
import { unitFormProps } from "../form-helpers";

export const dynamic = "force-dynamic";

export default async function NewUnitPage() {
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

  const locale = await getLocale();

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t(locale, "unit_new_title")}</h1>
      <UnitForm {...unitFormProps(locale)} />
    </main>
  );
}
