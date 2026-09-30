import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AssetForm from "../asset-form";
import { assetFormProps } from "../form-helpers";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("asset_new_title");

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: QueryValue }>;
}) {
  const operator = await requireOperator();

  const category = firstParam((await searchParams).category);
  const locale = await getLocale();
  const props = await assetFormProps(locale, operator.id);

  return (
    <main>
      <h1>{t(locale, "asset_new_title")}</h1>
      <AssetForm {...props} initialCategory={category} />
    </main>
  );
}
