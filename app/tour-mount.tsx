import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { workspaceNav } from "@/lib/nav/facts";
import { tourStops } from "@/lib/nav/model";
import Tour, { type TourStep } from "./tour";

// Where each tour stop lives and what it spotlights.
const STOPS: Record<string, { path: string; target: string }> = {
  s1: { path: "/", target: ".wealth-hero" },
  s2: { path: "/", target: "[data-tour='account']" },
  s3: { path: "/assets", target: "[data-tour='new-asset']" },
  s5: { path: "/assets", target: ".aflip" },
  s7: { path: "/calendar", target: ".cal-board" },
  s8: { path: "/units", target: ".ical-cell" },
  s9: { path: "/invest", target: "[data-tour='invest-tabs']" },
  fleet: { path: "/fleet", target: "[data-tour='fleet']" },
  alerts: { path: "/alerts", target: "[data-tour='alerts']" },
};

// The guided tour, mounted once in the layout so it survives navigation
// between the pages its steps live on. Signed-out visitors never see it —
// every step points at a signed-in screen. The stops follow the workspace
// (lib/nav/model.ts tourStops): six at most, only on pages it has.
export default async function TourMount() {
  const operator = await getSessionOperator();
  if (!operator) return null;
  const locale = await getLocale();
  const { primary } = await workspaceNav(operator.id, operator.profile);

  const steps: TourStep[] = tourStops(primary).map((id) => ({
    ...STOPS[id],
    title: t(locale, `tour_${id}_t` as StringKey),
    body: t(locale, `tour_${id}_b` as StringKey),
  }));

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
