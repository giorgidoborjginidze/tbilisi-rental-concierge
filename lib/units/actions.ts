"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { UNIT_TYPES } from "@/lib/types";
import type { StringKey } from "@/lib/i18n/strings";
import { checkFeedUrl } from "@/lib/ical/fetch";
import { normalizeFeedUrl } from "@/lib/ical/sync";
import { cityKey, districtKey } from "@/lib/places";
import { submittedValues } from "@/lib/forms";

export type FormState =
  | {
      error: StringKey;
      /** Shown after the message, e.g. the clashing stay. */
      detail?: string;
      /**
       * What was submitted, so the form can show it again: React resets a
       * form after its action, and an error must not wipe what was typed.
       */
      values?: Record<string, string>;
      ok?: never;
    }
  | { ok: true; error?: never }
  | null;

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function saveUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();

  const unitId = str(formData, "unitId") || null;
  const name = str(formData, "name");
  const nameKa = str(formData, "nameKa") || null;
  // Stored by key ("ვაკე" → "Vake") so market benchmarks find it.
  const city = cityKey(str(formData, "city")) ?? "";
  const district = districtKey(str(formData, "district")) ?? "";
  const address = str(formData, "address");
  const type = str(formData, "type");

  if (!name || !city || !district || !address) {
    return { error: "error_required", values: submittedValues(formData) };
  }
  if (!(UNIT_TYPES as readonly string[]).includes(type)) {
    return { error: "error_required", values: submittedValues(formData) };
  }

  const capacity = Number(str(formData, "capacity"));
  const bedrooms = Number(str(formData, "bedrooms"));
  const baseNightlyRate = Number(str(formData, "baseNightlyRate"));
  if (
    !Number.isInteger(capacity) || capacity < 1 ||
    !Number.isInteger(bedrooms) || bedrooms < 0 ||
    !Number.isFinite(baseNightlyRate) || baseNightlyRate <= 0
  ) {
    return { error: "error_invalid_number", values: submittedValues(formData) };
  }

  const amenities = str(formData, "amenities")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const icalUrls = [
    ...new Set(
      str(formData, "icalUrls")
        .split("\n")
        // webcal:// is the same calendar over https.
        .map(normalizeFeedUrl)
        .filter(Boolean),
    ),
  ];
  // Only public https links: the server fetches them (see lib/ical/fetch).
  for (const url of icalUrls) {
    if ("error" in checkFeedUrl(url)) {
      return {
        error: "error_ical_url",
        detail: url.length > 80 ? `${url.slice(0, 77)}…` : url,
        values: submittedValues(formData),
      };
    }
  }

  const data = {
    name,
    nameKa,
    city,
    district,
    address,
    type,
    capacity,
    bedrooms,
    baseNightlyRate,
    currency: str(formData, "currency") || "GEL",
    amenities,
    channelLinks: {
      airbnbUrl: str(formData, "airbnbUrl") || null,
      bookingUrl: str(formData, "bookingUrl") || null,
      icalUrls,
    },
  };

  if (unitId) {
    const owned = await prisma.unit.findFirst({
      where: { id: unitId, operatorId: operator.id },
    });
    if (!owned) return { error: "error_required" };
    await prisma.unit.update({ where: { id: unitId }, data });
    // Status rows of removed links go now, not at the next sync.
    await prisma.unitFeed.deleteMany({ where: { unitId, url: { notIn: icalUrls } } });
  } else {
    const { getBillingContext } = await import("@/lib/billing/context");
    if (!(await getBillingContext(operator)).canAddUnit) {
      return { error: "error_limit_units" };
    }
    await prisma.unit.create({ data: { ...data, operatorId: operator.id } });
  }

  revalidatePath("/units");
  revalidatePath("/");
  redirect("/units");
}

export async function deleteUnit(formData: FormData) {
  const operator = await requireWriter();
  const unitId = str(formData, "unitId");
  if (unitId) {
    await prisma.unit.deleteMany({
      where: { id: unitId, operatorId: operator.id },
    });
    revalidatePath("/units");
    revalidatePath("/");
  }
  redirect("/units");
}
