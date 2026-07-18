import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { runAlertScan, setAlertStatus } from "@/lib/alerts/actions";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  vacancy_gap:
    "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950",
  lease_expiry:
    "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950",
  underpriced:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950",
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
}

export default async function AlertsPage() {
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

  const locale = await getLocale();
  const alerts = await prisma.alert.findMany({
    where: { operatorId: operator.id, status: "open" },
    include: { unit: { select: { id: true, name: true, nameKa: true, currency: true } } },
    orderBy: { createdAt: "desc" },
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
      default:
        return "";
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t(locale, "alerts_title")}</h1>
        <form action={runAlertScan}>
          <button
            type="submit"
            className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t(locale, "alerts_scan")}
          </button>
        </form>
      </div>

      {alerts.length === 0 ? (
        <p className="text-neutral-500">{t(locale, "alerts_empty")}</p>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => {
            const payload = alert.payload as AlertPayload;
            const currency = alert.unit?.currency ?? "GEL";
            return (
              <li
                key={alert.id}
                className={`rounded-lg border p-4 ${TYPE_STYLE[alert.type] ?? "border-neutral-200"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {t(locale, `alert_${alert.type}` as StringKey)}
                      </span>
                      {alert.unit && (
                        <Link
                          href={`/calendar?unit=${alert.unit.id}`}
                          className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
                        >
                          {displayName(alert.unit)}
                        </Link>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      {detail(alert.type, payload, currency)}
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="font-medium">{t(locale, "alert_action")}: </span>
                      {t(locale, `action_${alert.type}` as StringKey)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={setAlertStatus}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <input type="hidden" name="status" value="resolved" />
                      <button
                        type="submit"
                        className="rounded border border-neutral-300 px-3 py-1.5 text-xs hover:bg-white dark:border-neutral-700 dark:hover:bg-neutral-900"
                      >
                        {t(locale, "alert_resolve")}
                      </button>
                    </form>
                    <form action={setAlertStatus}>
                      <input type="hidden" name="alertId" value={alert.id} />
                      <input type="hidden" name="status" value="dismissed" />
                      <button
                        type="submit"
                        className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:bg-white dark:border-neutral-700 dark:hover:bg-neutral-900"
                      >
                        {t(locale, "alert_dismiss")}
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
