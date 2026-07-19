"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { UNIT_TYPES } from "@/lib/types";
import type { StringKey } from "@/lib/i18n/strings";

export type FormState = { error: StringKey; ok?: never } | { ok: true; error?: never } | null;

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function saveUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();

  const unitId = str(formData, "unitId") || null;
  const name = str(formData, "name");
  const nameKa = str(formData, "nameKa") || null;
  const city = str(formData, "city");
  const district = str(formData, "district");
  const address = str(formData, "address");
  const type = str(formData, "type");

  if (!name || !city || !district || !address) {
    return { error: "error_required" };
  }
  if (!(UNIT_TYPES as readonly string[]).includes(type)) {
    return { error: "error_required" };
  }

  const capacity = Number(str(formData, "capacity"));
  const bedrooms = Number(str(formData, "bedrooms"));
  const baseNightlyRate = Number(str(formData, "baseNightlyRate"));
  if (
    !Number.isInteger(capacity) || capacity < 1 ||
    !Number.isInteger(bedrooms) || bedrooms < 0 ||
    !Number.isFinite(baseNightlyRate) || baseNightlyRate <= 0
  ) {
    return { error: "error_invalid_number" };
  }

  const amenities = str(formData, "amenities")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const icalUrls = str(formData, "icalUrls")
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

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
  const operator = await requireOperator();
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
