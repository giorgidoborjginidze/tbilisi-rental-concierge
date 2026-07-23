import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { COINS } from "@/lib/crypto/prices";
import CryptoForm from "./crypto-form";

export const dynamic = "force-dynamic";

export default async function NewCryptoPage() {
  await requireOperator();
  const locale = await getLocale();

  const coins = Object.entries(COINS).map(([symbol, c]) => ({ symbol, name: c.name }));
  const labelKeys: StringKey[] = [
    "crypto_coin", "crypto_custom", "crypto_custom_symbol", "crypto_custom_id",
    "crypto_custom_id_hint", "unit_name", "crypto_add", "crypto_add_hint",
    "error_required", "error_limit_assets",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));

  return (
    <main>
      <h1>{t(locale, "crypto_new_title")}</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 560 }}>
        {t(locale, "crypto_new_intro")}
      </p>
      <CryptoForm coins={coins} labels={labels} />
    </main>
  );
}
