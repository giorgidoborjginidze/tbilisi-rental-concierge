import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { SignedOutHome } from "../landing";
import Dashboard, { dashboardMetadata } from "../home-dashboards";

// The signed-in Home. The browser never shows this path: next.config.ts
// rewrites "/" here when the request carries a session cookie (and sends a
// direct visit to /dashboard back to "/"). Its own segment exists for the
// loading.tsx next to it — the skeleton the Home link prefetches, so a tap
// on Home answers at once without putting a skeleton in front of the
// signed-out landing.

export const dynamic = "force-dynamic";

export const generateMetadata = dashboardMetadata;

export default async function DashboardPage() {
  const [locale, operator] = await Promise.all([getLocale(), getSessionOperator()]);
  // A cookie whose session is gone (signed out elsewhere, password reset):
  // the visitor is signed out, so they get the landing, not a redirect loop.
  if (!operator) return <SignedOutHome locale={locale} />;
  return <Dashboard locale={locale} operator={operator} />;
}
