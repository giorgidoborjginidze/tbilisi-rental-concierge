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
import {
  assetHoldsNothing,
  createAssetForUnit,
} from "@/lib/property/link";

/** The unit form's asset choice: create one, link one, or (edit only) leave it. */
const NEW_ASSET = "__new__";

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

  // One flat, one place: a unit is the calendar side of a real-estate
  // asset. A new unit gets its asset (created, or the one the owner
  // picked); an old unit without one gets it when the owner asks.
  const assetChoice = str(formData, "linkAssetId");
  const existing = unitId
    ? await prisma.unit.findFirst({
        where: { id: unitId, operatorId: operator.id },
        select: { id: true, asset: { select: { id: true } } },
      })
    : null;
  if (unitId && !existing) return { error: "error_required" };
  const alreadyLinked = existing?.asset != null;
  const linkTo =
    alreadyLinked || !assetChoice || assetChoice === NEW_ASSET
      ? null
      : await prisma.asset.findFirst({
          where: { id: assetChoice, operatorId: operator.id, category: "real_estate", unitId: null },
          select: { id: true },
        });
  if (!alreadyLinked && assetChoice && assetChoice !== NEW_ASSET && !linkTo) {
    return { error: "error_required", values: submittedValues(formData) };
  }
  // A new unit without a choice gets a new asset; an edited, unlinked one
  // only when asked.
  const createAsset = !alreadyLinked && !linkTo && (unitId ? assetChoice === NEW_ASSET : true);

  if (!unitId) {
    // A linked pair counts once, as a unit (lib/billing/context.ts).
    const { getBillingContext } = await import("@/lib/billing/context");
    if (!(await getBillingContext(operator)).canAddUnit) {
      return { error: "error_limit_units", values: submittedValues(formData) };
    }
  }

  await prisma.$transaction(async (tx) => {
    const unit = unitId
      ? await tx.unit.update({ where: { id: unitId }, data })
      : await tx.unit.create({ data: { ...data, operatorId: operator.id } });
    if (unitId) {
      // Status rows of removed links go now, not at the next sync.
      await tx.unitFeed.deleteMany({ where: { unitId, url: { notIn: icalUrls } } });
    }
    if (linkTo) {
      await tx.asset.update({ where: { id: linkTo.id }, data: { unitId: unit.id } });
    } else if (createAsset) {
      await createAssetForUnit(tx, unit);
    }
  });

  revalidatePath("/units");
  revalidatePath("/assets");
  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/units");
}

export async function deleteUnit(formData: FormData) {
  const operator = await requireWriter();
  const unitId = str(formData, "unitId");
  if (unitId) {
    const linked = await prisma.asset.findFirst({
      where: { unitId, operatorId: operator.id },
      select: { id: true },
    });
    // The asset made for this unit goes with it while it holds nothing of
    // its own; one with a value, contracts or daily answers stays (unlinked).
    const dropAsset = linked ? await assetHoldsNothing(prisma, linked.id) : false;
    const { count } = await prisma.unit.deleteMany({
      where: { id: unitId, operatorId: operator.id },
    });
    if (count > 0 && linked && dropAsset) {
      await prisma.asset.deleteMany({ where: { id: linked.id, operatorId: operator.id } });
    }
    revalidatePath("/units");
    revalidatePath("/assets");
    revalidatePath("/");
  }
  redirect("/units");
}
