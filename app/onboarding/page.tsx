import { redirect } from "next/navigation";
import { titled } from "@/lib/i18n/metadata";
import { getSessionOperator } from "@/lib/auth/session";

export const generateMetadata = titled("onboarding_title");

// Onboarding is the first-run "what do you have?" card on Home for a
// signed-in owner (SetupCard), and sign-up for everyone else.
export default async function OnboardingPage() {
  redirect((await getSessionOperator()) ? "/" : "/register");
}
