import { describe, expect, it } from "vitest";
import {
  activeContract,
  activeContractWhere,
  assetStatusNow,
  contractPhase,
  scheduleContract,
  upcomingContract,
} from "./phase";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const lease = { startDate: d("2026-10-01"), endDate: d("2026-12-01") };

describe("contractPhase", () => {
  it("is derived from the dates alone", () => {
    expect(contractPhase(lease, d("2026-09-30"))).toBe("upcoming");
    expect(contractPhase(lease, d("2026-10-01"))).toBe("active");
    expect(contractPhase(lease, d("2026-11-30"))).toBe("active");
    // The end date is the day the rental is over.
    expect(contractPhase(lease, d("2026-12-01"))).toBe("ended");
  });

  it("turns a contract saved the day before it starts active on its first day", () => {
    const savedAsUpcoming = { ...lease, status: "upcoming" };
    expect(contractPhase(savedAsUpcoming, d("2026-10-02"))).toBe("active");
  });

  it("ends a contract still stored as active once its end date has passed", () => {
    const nutsubidze = {
      startDate: d("2025-09-01"),
      endDate: d("2026-08-10"),
      status: "active",
    };
    expect(contractPhase(nutsubidze, d("2026-09-30"))).toBe("ended");
  });

  it("ignores the time of day", () => {
    expect(contractPhase(lease, new Date("2026-10-01T23:30:00Z"))).toBe("active");
  });
});

describe("picking the contract", () => {
  const old = { id: "old", startDate: d("2026-07-20"), endDate: d("2026-07-23") };
  const next = { id: "next", startDate: d("2026-10-05"), endDate: d("2026-11-05") };
  const later = { id: "later", startDate: d("2026-12-01"), endDate: d("2027-01-01") };
  const running = { id: "running", startDate: d("2026-09-20"), endDate: d("2027-09-20") };

  it("follows the running contract, not a finished one", () => {
    expect(activeContract([old, running, next], d("2026-09-30"))?.id).toBe("running");
    expect(activeContract([old, next], d("2026-09-30"))).toBeUndefined();
  });

  it("falls back to the next contract to start", () => {
    expect(upcomingContract([later, next, old], d("2026-09-30"))?.id).toBe("next");
    expect(scheduleContract([later, next, old], d("2026-09-30"))?.id).toBe("next");
    expect(scheduleContract([old], d("2026-09-30"))).toBeUndefined();
  });

  it("filters the database by dates", () => {
    expect(activeContractWhere(new Date("2026-09-30T21:00:00Z"))).toEqual({
      startDate: { lte: d("2026-09-30") },
      endDate: { gt: d("2026-09-30") },
    });
  });
});

describe("assetStatusNow", () => {
  const ended = { startDate: d("2025-09-01"), endDate: d("2026-08-10") };
  const running = { startDate: d("2026-09-01"), endDate: d("2027-09-01") };
  const today = d("2026-09-30");

  it("is rented while a contract runs, whatever is stored", () => {
    expect(assetStatusNow({ status: "vacant" }, [running], today)).toBe("rented");
  });

  it("reads a stale 'rented' left by a finished contract as vacant", () => {
    expect(assetStatusNow({ status: "rented" }, [ended], today)).toBe("vacant");
  });

  it("keeps 'rented' the owner set by hand after the contract ended", () => {
    expect(
      assetStatusNow({ status: "rented", statusSetAt: d("2026-09-01") }, [ended], today),
    ).toBe("rented");
  });

  it("keeps every other stored status", () => {
    expect(assetStatusNow({ status: "listed" }, [ended], today)).toBe("listed");
    expect(assetStatusNow({ status: "rented" }, [], today)).toBe("rented");
  });
});
