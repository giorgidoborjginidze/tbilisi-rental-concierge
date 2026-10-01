import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AssetForm from "../asset-form";
import { assetFormProps } from "../form-helpers";
import { firstParam, type QueryValue } from "@/lib/params";
import { titled } from "@/lib/i18n/metadata";
import { newAssetDefaults } from "@/lib/assets/new-defaults";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("asset_new_title");

// A new asset. The form opens prefilled for what the owner is adding: the
// first-run card and the dashboards link here with ?category=, ?mode= and
// ?status= (a let flat, a day-let flat, a car let out), and a car-rental
// workspace starts on a car that is let. Unknown values are ignored.
export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: QueryValue; mode?: QueryValue; status?: QueryValue }>;
}) {
  const operator = await requireOperator();

  const query = await searchParams;
  const defaults = newAssetDefaults(operator.profile, {
    category: firstParam(query.category),
    mode: firstParam(query.mode),
    status: firstParam(query.status),
  });
  const locale = await getLocale();
  const props = await assetFormProps(locale, operator.id, undefined, defaults.category);

  return (
    <main>
      <h1>{t(locale, "asset_new_title")}</h1>
      <AssetForm
        {...props}
        initialCategory={defaults.category}
        initialMode={defaults.mode}
        initialStatus={defaults.status}
      />
    </main>
  );
}
