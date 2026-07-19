import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AssetForm from "../asset-form";
import { assetFormProps } from "../form-helpers";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

  const locale = await getLocale();
  const props = await assetFormProps(locale);

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t(locale, "asset_new_title")}</h1>
      <AssetForm {...props} />
    </main>
  );
}
