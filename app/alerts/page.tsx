import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { runAlertScan, setAlertStatus } from "@/lib/alerts/actions";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  vacancy_gap: "alert-card--gap",
  lease_expiry: "alert-card--lease",
  underpriced: "alert-card--underpriced",
  contract_expiry: "alert-card--contract",
};

interface AlertPayload {
  start?: string;
  end?: string;
  nights?: number;
  endDate?: string;
  tenantName?: string | null;
  daysLeft?: number;
  month?: string;
  benchmarkAdr?: number;
  suggestedRate?: number;
  baseNightlyRate?: number;
  assetId?: string;
  assetName?: string;
  monthlyRent?: number;
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const operator = await requireOperator();

  const { view } = await searchParams;
  const done = view === "done";
  const locale = await getLocale();
  const alerts = await prisma.alert.findMany({
    where: { operatorId: operator.id, status: done ? "resolved" : "open" },
    include: { unit: { select: { id: true, name: true, nameKa: true, currency: true } } },
    orderBy: done ? { resolvedAt: "desc" } : { createdAt: "desc" },
    take: done ? 50 : undefined,
  });

  const displayName = (unit: { name: string; nameKa: string | null } | null) =>
    unit ? (locale === "ka" && unit.nameKa ? unit.nameKa : unit.name) : "—";

  const detail = (type: string, payload: AlertPayload, currency: string) => {
    switch (type) {
      case "vacancy_gap":
        return `${payload.start} → ${payload.end} · ${payload.nights} ${t(locale, "nights_short")}`;
      case "lease_expiry":
        return `${payload.tenantName ?? "—"} · ${payload.endDate} · ${payload.daysLeft} ${t(locale, "days_left")}`;
      case "underpriced":
        return `${payload.baseNightlyRate} → ${payload.suggestedRate} ${currency} · ADR ${payload.benchmarkAdr} (${payload.month})`;
      case "contract_expiry":
        return `${payload.assetName} · ${payload.tenantName ?? "—"} · ${payload.monthlyRent} ${currency} · ${payload.endDate} · ${payload.daysLeft} ${t(locale, "days_left")}`;
      default:
        return "";
    }
  };

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "alerts_title")}</h1>
        {!done && (
          <form action={runAlertScan}>
            <button type="submit" className="btn-secondary">
              {t(locale, "alerts_scan")}
            </button>
          </form>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Link href="/alerts" className={`btn-chip ${done ? "" : "btn-chip--active"}`}>
          {t(locale, "alerts_active_tab")}
        </Link>
        <Link href="/alerts?view=done" className={`btn-chip ${done ? "btn-chip--active" : ""}`}>
          {t(locale, "alerts_done_tab")}
        </Link>
      </div>

      {alerts.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          {t(locale, done ? "alerts_done_empty" : "alerts_empty")}
        </p>
      ) : (
        alerts.map((alert) => {
          const payload = alert.payload as AlertPayload;
          const currency = alert.unit?.currency ?? "GEL";
          return (
            <div key={alert.id} className={`alert-card ${TYPE_STYLE[alert.type] ?? ""}`}>
              <div>
                <div className="alert-card__title">
                  {t(locale, `alert_${alert.type}` as StringKey)}
                  {alert.unit && (
                    <>
                      {" "}
                      <Link href={`/calendar?unit=${alert.unit.id}`} className="link">
                        {displayName(alert.unit)}
                      </Link>
                    </>
                  )}
                </div>
                <div className="alert-card__detail">
                  {detail(alert.type, payload, currency)}
                </div>
                <div className="alert-card__action">
                  <b>{t(locale, "alert_action")}:</b>{" "}
                  {t(locale, `action_${alert.type}` as StringKey)}
                </div>
              </div>
              {done ? (
                <span className="badge badge--rented">
                  {t(locale, "alert_done_at")}
                  {alert.resolvedAt
                    ? ` · ${new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", { day: "numeric", month: "short" }).format(alert.resolvedAt)}`
                    : ""}
                </span>
              ) : (
                <div className="flex gap-2">
                  <form action={setAlertStatus}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <button type="submit" className="btn-chip">
                      {t(locale, "alert_resolve")}
                    </button>
                  </form>
                  <form action={setAlertStatus}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="status" value="dismissed" />
                    <button type="submit" className="btn-chip">
                      {t(locale, "alert_dismiss")}
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })
      )}
    </main>
  );
}
