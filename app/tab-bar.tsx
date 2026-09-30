import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { workspaceNav } from "@/lib/nav/facts";
import TabBarClient from "./tab-bar-client";

// The mobile bottom navigation — liquid glass, thumb territory. Signed-out
// visitors keep the plain top nav; the bar only appears once there is an
// account to navigate. Five icon-only seats with Assets raised in the
// centre; what the other four open follows the workspace (lib/nav/model.ts),
// the same rule as the desktop nav.
export default async function TabBar() {
  const operator = await getSessionOperator();
  if (!operator) return null;

  const locale = await getLocale();
  const model = await workspaceNav(operator.id, operator.profile);
  return (
    <TabBarClient
      navLabel={t(locale, "aria_main_nav")}
      items={model.tabs.map((seat) => ({
        href: seat.href,
        label: t(locale, seat.labelKey),
        icon: seat.icon,
        center: seat.center,
        action: seat.action,
      }))}
    />
  );
}
