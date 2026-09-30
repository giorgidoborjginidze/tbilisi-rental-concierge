// The first-run question — "what do you have?" — and where each answer
// leads: the add form, opened ready for that kind of property. The
// workspace's own kind is offered first. Pure; client-safe.

export type SetupKey = "long_term" | "daily" | "cars" | "invest";

export interface SetupChoice {
  key: SetupKey;
  href: string;
}

export function setupChoices(profile: string): SetupChoice[] {
  const all: SetupChoice[] = [
    // A flat let to a tenant: the form asks for the tenant and the rent.
    { key: "long_term", href: "/assets/new?category=real_estate&status=rented" },
    // A flat let by the night. A hotel adds rooms as units (channel links).
    {
      key: "daily",
      href: profile === "hotel" ? "/units/new" : "/assets/new?category=real_estate&mode=daily",
    },
    // A car let to a driver: plate, driver and rent in one save.
    { key: "cars", href: "/assets/new?category=vehicle&status=rented" },
    { key: "invest", href: "/assets/new?category=crypto" },
  ];
  const first: SetupKey | null =
    profile === "hotel" ? "daily" : profile === "car_rental" ? "cars" : null;
  return first ? [...all.filter((c) => c.key === first), ...all.filter((c) => c.key !== first)] : all;
}
