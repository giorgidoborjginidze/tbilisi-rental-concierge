import { redirect } from "next/navigation";
import { titled } from "@/lib/i18n/metadata";

export const generateMetadata = titled("onboarding_title");

// Onboarding is superseded by /register (multi-user auth).
export default function OnboardingPage() {
  redirect("/register");
}
