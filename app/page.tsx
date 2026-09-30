import { Suspense } from "react";
import { getSessionOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { SignedOutHome } from "./landing";
import PageSkeleton from "./page-skeleton";
import Dashboard, { dashboardMetadata } from "./home-dashboards";

// "/" — the landing for a signed-out visitor, the dashboard for an owner.
//
// A signed-in request never reaches this page in practice: next.config.ts
// rewrites "/" with a session cookie to /dashboard, whose loading.tsx is
// prefetched with the Home link, so the dashboard skeleton paints the
// moment Home is tapped. The landing must not get a skeleton (nothing may
// paint before its splash), so "/" itself has no loading.tsx. The branch
// below is the fallback for a signed-in request the rewrite did not
// recognise: the dashboard then streams behind a Suspense skeleton, which
// only shows once the server has answered.

export const dynamic = "force-dynamic";

export const generateMetadata = dashboardMetadata;

export default async function Home() {
  const [locale, operator] = await Promise.all([getLocale(), getSessionOperator()]);
  if (!operator) return <SignedOutHome locale={locale} />;
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <Dashboard locale={locale} operator={operator} />
    </Suspense>
  );
}
