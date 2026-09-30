import { describe, expect, it } from "vitest";
import { setupChoices } from "./setup";

describe("the first-run question", () => {
  it("offers the four kinds, each opening the right prefilled form", () => {
    expect(setupChoices("personal")).toEqual([
      { key: "long_term", href: "/assets/new?category=real_estate&status=rented" },
      { key: "daily", href: "/assets/new?category=real_estate&mode=daily" },
      { key: "cars", href: "/assets/new?category=vehicle&status=rented" },
      { key: "invest", href: "/assets/new?category=crypto" },
    ]);
  });

  it("puts the workspace's own kind first", () => {
    expect(setupChoices("car_rental")[0].key).toBe("cars");
    expect(setupChoices("hotel")[0]).toEqual({ key: "daily", href: "/units/new" });
    expect(setupChoices("hotel")).toHaveLength(4);
  });
});
