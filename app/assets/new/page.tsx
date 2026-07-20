import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AssetForm from "../asset-form";
import { assetFormProps } from "../form-helpers";

export const dynamic = "force-dynamic";

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const operator = await requireOperator();

  const { category } = await searchParams;
  const locale = await getLocale();
  const props = await assetFormProps(locale, operator.id);

  return (
    <main>
      <h1>{t(locale, "asset_new_title")}</h1>
      <AssetForm {...props} initialCategory={category} />
    </main>
  );
}
