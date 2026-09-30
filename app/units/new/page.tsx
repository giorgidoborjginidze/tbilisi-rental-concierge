import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import UnitForm from "../unit-form";
import { unitFormProps } from "../form-helpers";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("unit_new_title");

export default async function NewUnitPage() {
  const operator = await requireOperator();

  const locale = await getLocale();

  return (
    <main>
      <h1>{t(locale, "unit_new_title")}</h1>
      <UnitForm {...unitFormProps(locale)} />
    </main>
  );
}
