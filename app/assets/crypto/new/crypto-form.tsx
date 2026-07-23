"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createCrypto } from "@/lib/crypto/actions";
import type { FormState } from "@/lib/units/actions";

export default function CryptoForm({
  coins,
  labels,
}: {
  coins: { symbol: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createCrypto,
    null,
  );
  const [symbol, setSymbol] = useState(coins[0]?.symbol ?? "");
  const isCustom = symbol === "__custom__";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4" style={{ maxWidth: 460 }}>
      <label className="field">
        {labels.crypto_coin}
        <select name="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {coins.map((c) => (
            <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>
          ))}
          <option value="__custom__">{labels.crypto_custom}</option>
        </select>
      </label>

      {isCustom && (
        <>
          <label className="field">
            {labels.crypto_custom_symbol}
            <input name="symbol" placeholder="e.g. PEPE" autoCapitalize="characters" required />
          </label>
          <label className="field">
            {labels.crypto_custom_id}
            <input name="coingeckoId" placeholder="e.g. pepe" />
            <span className="hint">{labels.crypto_custom_id_hint}</span>
          </label>
          <label className="field">
            {labels.unit_name}
            <input name="name" placeholder="Pepe" />
          </label>
        </>
      )}

      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13 }}>
          {labels[state.error] ?? state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" style={{ alignSelf: "flex-start" }}>
        {labels.crypto_add}
      </button>
      <p className="hint">{labels.crypto_add_hint}</p>
    </form>
  );
}
