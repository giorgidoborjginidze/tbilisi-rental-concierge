"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { UNIT_TYPES } from "@/lib/types";
import type { StringKey } from "@/lib/i18n/strings";

export type FormState = { error: StringKey } | null;

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function createOperator(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  const email = str(formData, "email");
  if (!name || !email) return { error: "error_required" };

  const existing = await prisma.operator.findUnique({ where: { email } });
  if (existing) return { error: "error_email_taken" };

  await prisma.operator.create({ data: { name, email } });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

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
    await prisma.unit.update({ where: { id: unitId }, data });
  } else {
    await prisma.unit.create({ data: { ...data, operatorId: operator.id } });
  }

  revalidatePath("/units");
  revalidatePath("/");
  redirect("/units");
}

export async function deleteUnit(formData: FormData) {
  const unitId = str(formData, "unitId");
  if (unitId) {
    await prisma.unit.delete({ where: { id: unitId } });
    revalidatePath("/units");
    revalidatePath("/");
  }
  redirect("/units");
}
