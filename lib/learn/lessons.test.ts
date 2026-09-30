import { describe, expect, it } from "vitest";
import { LESSONS, OUTDATED_VIDEOS } from "./lessons";

describe("Learn lessons", () => {
  it("has the same lessons in Georgian and English", () => {
    expect(LESSONS.en.map((l) => l.slug)).toEqual(LESSONS.ka.map((l) => l.slug));
    LESSONS.ka.forEach((lesson, i) => expect(LESSONS.en[i].steps.length).toBe(lesson.steps.length));
  });

  it("only holds back videos of lessons that exist, and keeps their written steps", () => {
    const slugs = new Set(LESSONS.ka.map((l) => l.slug));
    for (const slug of OUTDATED_VIDEOS) {
      expect(slugs.has(slug)).toBe(true);
      expect(LESSONS.ka.find((l) => l.slug === slug)?.steps.length).toBeGreaterThan(0);
    }
  });
});
