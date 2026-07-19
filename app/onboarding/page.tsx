import { redirect } from "next/navigation";

// Onboarding is superseded by /register (multi-user auth).
export default function OnboardingPage() {
  redirect("/register");
}
