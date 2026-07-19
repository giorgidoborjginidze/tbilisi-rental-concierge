"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { syncAllUnits } from "@/lib/ical/run-sync";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function createBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const unitId = str(formData, "unitId");
  const source = str(formData, "source") === "direct" ? "direct" : "manual";
  const guestName = str(formData, "guestName") || null;
  const checkInRaw = str(formData, "checkIn");
  const checkOutRaw = str(formData, "checkOut");

  if (!unitId || !checkInRaw || !checkOutRaw) return { error: "error_required" };

  const operator = await requireOperator();
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, operatorId: operator.id },
  });
  if (!unit) return { error: "error_required" };

  const checkIn = new Date(`${checkInRaw}T00:00:00Z`);
  const checkOut = new Date(`${checkOutRaw}T00:00:00Z`);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return { error: "error_dates" };
  }
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
  );
  if (nights <= 0) return { error: "error_dates" };

  const amountRaw = str(formData, "amount");
  let amount: number | null = null;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: "error_invalid_number" };
    }
  }

  await prisma.booking.create({
    data: {
      unitId,
      source,
      guestName,
      checkIn,
      checkOut,
      nights,
      amount,
      currency: unit.currency,
      status: "confirmed",
    },
  });

  revalidatePath("/units");
  revalidatePath("/");
  redirect("/units");
}

export async function syncNow() {
  const operator = await requireOperator();
  await syncAllUnits(undefined, operator.id);
  revalidatePath("/units");
  revalidatePath("/");
}
