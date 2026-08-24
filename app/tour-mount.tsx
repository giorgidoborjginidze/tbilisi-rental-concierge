import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import Tour, { type TourStep } from "./tour";

// The guided tour, mounted once in the layout so it survives navigation
// between the pages its steps live on. Signed-out visitors never see it —
// every step points at a signed-in screen. Steps whose section a profile
// does not have (no units → no calendar) are skipped by the engine.
export default async function TourMount() {
  const operator = await getSessionOperator();
  if (!operator) return null;
  const locale = await getLocale();

  const step = (path: string, target: string, n: number): TourStep => ({
    path,
    target,
    title: t(locale, `tour_s${n}_t` as StringKey),
    body: t(locale, `tour_s${n}_b` as StringKey),
  });

  const steps: TourStep[] = [
    step("/", ".kpi-grid", 1),
    step("/", "[data-tour='account']", 2),
    step("/assets", "[data-tour='new-asset']", 3),
    step("/assets", "[data-tour='segments']", 4),
    step("/assets", ".aflip", 5),
    step("/assets", "[data-tour='digital']", 6),
    step("/calendar", ".cal-board", 7),
    step("/units", ".ical-cell", 8),
    step("/invest", "[data-tour='invest-tabs']", 9),
    step("/billing", "[data-tour='plans']", 10),
    step("/", ".bot-launcher", 11),
  ];

  return (
    <Tour
      steps={steps}
      labels={{
        next: t(locale, "tour_next"),
        back: t(locale, "tour_back"),
        skip: t(locale, "tour_skip"),
        done: t(locale, "tour_done"),
      }}
    />
  );
}
