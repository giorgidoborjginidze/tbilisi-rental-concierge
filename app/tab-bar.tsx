import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import TabBarClient from "./tab-bar-client";

// The mobile bottom navigation — liquid glass, thumb territory. Signed-out
// visitors keep the plain top nav; the bar only appears once there is an
// account to navigate.
export default async function TabBar() {
  const operator = await getSessionOperator();
  if (!operator) return null;

  const locale = await getLocale();
  return (
    <TabBarClient
      items={[
        { href: "/", label: t(locale, "nav_dashboard"), icon: "home" },
        { href: "/assets", label: t(locale, "nav_assets"), icon: "grid" },
        { href: "/calendar", label: t(locale, "nav_calendar"), icon: "calendar" },
        { href: "/alerts", label: t(locale, "nav_alerts"), icon: "bell" },
      ]}
    />
  );
}
