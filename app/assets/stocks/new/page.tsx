import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { POPULAR_STOCKS } from "@/lib/stocks/prices";
import StockForm from "./stock-form";

export const dynamic = "force-dynamic";

export default async function NewStockPage() {
  await requireOperator();
  const locale = await getLocale();

  const stocks = Object.entries(POPULAR_STOCKS).map(([symbol, name]) => ({ symbol, name }));
  const labelKeys: StringKey[] = [
    "stock_ticker", "crypto_custom", "stock_custom_ticker", "unit_name",
    "stock_add", "stock_add_hint", "error_required", "error_limit_assets",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));

  return (
    <main>
      <h1>{t(locale, "stock_new_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 560 }}>
        {t(locale, "stock_new_intro")}
      </p>
      <StockForm stocks={stocks} labels={labels} />
    </main>
  );
}
