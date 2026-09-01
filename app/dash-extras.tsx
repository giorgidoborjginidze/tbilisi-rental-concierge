import Link from "next/link";
import { prisma } from "@/lib/db";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { statusFor, periodAmount } from "@/lib/rentals/monitor";
import CountUp from "./count-up";
import DecideCards, { type DecideItem } from "./decide-cards";

// The Ice dashboard pieces shared by every profile: the one hero number,
// the composition ring, and the closing "market advice" feed.

const money = (value: number) => Math.round(value).toLocaleString("en-US");

export function WealthHero({
  label,
  total,
  chips,
}: {
  label: string;
  total: number;
  chips: string[];
}) {
  return (
    <section className="card wealth-hero">
      <div className="wealth-hero__label">{label}</div>
      <div className="wealth-hero__figure">
        <CountUp to={Math.round(total)} /> <small>₾</small>
      </div>
      {chips.length > 0 && (
        <div className="wealth-hero__chips">
          {chips.map((chip) => (
            <span key={chip} className="chip">{chip}</span>
          ))}
        </div>
      )}
    </section>
  );
}

export interface RingPart {
  key: string;
  label: string;
  value: number;
  /** Ice gradient stops, light → deep. */
  tint: [string, string];
}

/** The category ice tints, matching the CSS --cat-* tokens. */
export const CATEGORY_TINTS: Record<string, [string, string]> = {
  real_estate: ["#a8daf5", "#5ab0e0"],
  vehicle: ["#d3cbf8", "#988ae6"],
  digital: ["#bdf0e0", "#6ed3b8"],
  income_source: ["#f9e5b8", "#ecc06a"],
  other: ["#cddbe5", "#8aa3b5"],
};

export function CompositionRing({
  locale,
  parts,
}: {
  locale: Locale;
  parts: RingPart[];
}) {
  const shown = parts.filter((part) => part.value > 0);
  if (shown.length < 2) return null; // one colour is not a composition

  const total = shown.reduce((sum, part) => sum + part.value, 0);
  const C = 2 * Math.PI * 49.2;
  let offset = 0;
  const segments = shown.map((part) => {
    const length = (part.value / total) * C;
    const seg = { ...part, length, offset };
    offset += length;
    return seg;
  });
  const short = (value: number) =>
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M`
      : value >= 1_000
        ? `${Math.round(value / 1_000)}K`
        : String(Math.round(value));

  return (
    <section className="card comp-ring">
      <div className="comp-ring__head">
        <h2>{t(locale, "dash_comp_title")}</h2>
        <p>{t(locale, "dash_comp_sub")}</p>
      </div>
      <div className="comp-ring__body">
      <svg viewBox="0 0 120 120" role="img" aria-label={t(locale, "dash_comp_title")}>
        <defs>
          {segments.map((seg) => (
            <linearGradient key={seg.key} id={`ring-${seg.key}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={seg.tint[0]} />
              <stop offset="1" stopColor={seg.tint[1]} />
            </linearGradient>
          ))}
        </defs>
        <circle cx="60" cy="60" r="49.2" fill="none" stroke="rgba(120,160,190,.16)" strokeWidth="15" />
        <g transform="rotate(-90 60 60)" strokeWidth="15" fill="none" strokeLinecap="round">
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx="60" cy="60" r="49.2"
              stroke={`url(#ring-${seg.key})`}
              strokeDasharray={`${Math.max(1, seg.length - 2)} ${C}`}
              strokeDashoffset={-seg.offset}
            />
          ))}
        </g>
        <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill="currentColor">
          {short(total)}
        </text>
        <text x="60" y="73" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--color-text-muted)">
          ₾
        </text>
      </svg>
      <div className="comp-ring__legend">
        {segments.map((seg) => (
          <div key={seg.key}>
            <i style={{ background: `linear-gradient(140deg, ${seg.tint[0]}, ${seg.tint[1]})` }} />
            {seg.label}
            <b>{short(seg.value)}</b>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

// ── Market advice: the open alerts, spoken as advice. Nothing renders
// below this section — it closes the dashboard. ──

const TIP_TINTS: Record<string, string> = {
  underpriced: "linear-gradient(140deg,#bdf0e0,#6ed3b8)",
  vacancy_gap: "linear-gradient(140deg,#f9e5b8,#ecc06a)",
  lease_expiry: "linear-gradient(140deg,#d3cbf8,#988ae6)",
  contract_expiry: "linear-gradient(140deg,#d3cbf8,#988ae6)",
  rent_overdue: "linear-gradient(140deg,#f5cdd9,#e08ba4)",
  repossession_right: "linear-gradient(140deg,#f5cdd9,#e08ba4)",
  geofence_breach: "linear-gradient(140deg,#f5cdd9,#e08ba4)",
};
const TIP_GLYPHS: Record<string, string> = {
  underpriced: "↑",
  vacancy_gap: "◔",
  lease_expiry: "◷",
  contract_expiry: "◷",
  rent_overdue: "!",
  repossession_right: "!",
  geofence_breach: "⚑",
};

export async function MarketTips({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const alerts = await prisma.alert.findMany({
    where: { operatorId, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  return (
    <section>
      <h2>{t(locale, "tips_title")}</h2>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "2px 0 14px" }}>
        {t(locale, "tips_sub")}
      </p>
      {alerts.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          {t(locale, "tips_empty")}
        </p>
      ) : (
        <div className="tips-grid">
          {alerts.map((alert) => {
            const payload = alert.payload as { assetName?: string; suggestedAction?: string };
            return (
              <div key={alert.id} className="card tip-card">
                <span
                  className="tip-card__ico"
                  style={{ background: TIP_TINTS[alert.type] ?? TIP_TINTS.lease_expiry }}
                >
                  {TIP_GLYPHS[alert.type] ?? "•"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="t">
                    {t(locale, `alert_${alert.type}` as StringKey)}
                    {payload.assetName ? ` — ${payload.assetName}` : ""}
                  </b>
                  <p>
                    {t(locale, `action_${alert.type}` as StringKey)}{" "}
                    <Link href="/alerts" className="link">
                      {t(locale, "tips_open")} →
                    </Link>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Ring parts from the operator's assets, valued at estimatedValue. */
export function ringPartsFromAssets(
  locale: Locale,
  assets: { category: string; estimatedValue: number | null }[],
): RingPart[] {
  const byCategory = new Map<string, number>();
  for (const asset of assets) {
    if (!asset.estimatedValue) continue;
    // Holdings (crypto/stock/metal) are valued live elsewhere; physical
    // categories carry their estimate here.
    const key = ["real_estate", "vehicle", "income_source"].includes(asset.category)
      ? asset.category
      : "other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + asset.estimatedValue);
  }
  return [...byCategory.entries()].map(([key, value]) => ({
    key,
    label: t(locale, `category_${key}` as StringKey),
    value,
    tint: CATEGORY_TINTS[key] ?? CATEGORY_TINTS.other,
  }));
}

/** The ring, fetching its own data — one line to add on any dashboard. */
export async function PortfolioRing({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const assets = await prisma.asset.findMany({
    where: { operatorId },
    select: { category: true, estimatedValue: true },
  });
  return <CompositionRing locale={locale} parts={ringPartsFromAssets(locale, assets)} />;
}

/** "To decide today": due and late rent, answered with a flick. */
export async function DecideToday({
  locale,
  operatorId,
}: {
  locale: Locale;
  operatorId: string;
}) {
  const contracts = await prisma.rentalContract.findMany({
    where: {
      status: "active",
      paidThrough: { not: null },
      asset: { operatorId },
    },
    include: { asset: { select: { id: true, name: true, nameKa: true } } },
  });

  const now = new Date();
  const items: DecideItem[] = [];
  for (const contract of contracts) {
    const status = statusFor(contract, now);
    if (!["due", "grace", "repossess"].includes(status.state)) continue;
    const name =
      locale === "ka" && contract.asset.nameKa
        ? contract.asset.nameKa
        : contract.asset.name;
    items.push({
      contractId: contract.id,
      assetId: contract.asset.id,
      title: `${name} — ${t(locale, "decide_rent")}`,
      sub: `${contract.tenantName ?? "—"}${
        status.daysOverdue > 0
          ? ` · ${t(locale, "decide_late")}: ${status.daysOverdue} ${t(locale, "decide_days")}`
          : ""
      }`,
      amount: status.amountDue || periodAmount(contract),
      currency: contract.currency,
      severe: status.state === "repossess",
    });
  }
  items.sort((a, b) => Number(b.severe) - Number(a.severe));

  return (
    <section>
      <h2>{t(locale, "decide_title")}</h2>
      <p className="decide-hint">{t(locale, "decide_sub")}</p>
      <DecideCards
        items={items.slice(0, 4)}
        labels={{
          paid: t(locale, "decide_paid"),
          open: t(locale, "decide_open"),
          empty: t(locale, "decide_empty"),
        }}
      />
    </section>
  );
}

export { money };
