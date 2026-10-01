"use server";

// Settings → "Your WhatsApp number": the owner connects their own WhatsApp
// Business number (Meta Cloud API) so messages to their tenants and drivers
// go out from it. The details are checked with Meta before they are kept;
// the access token is stored sealed and never shown again.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { openSecret, sealSecret } from "@/lib/security/secret";
import type { FormState } from "@/lib/units/actions";
import { checkWhatsAppNumber } from "./sender-check";

const str = (formData: FormData, key: string, max = 300) => String(formData.get(key) ?? "").trim().slice(0, max);

export async function saveWhatsAppSender(_prev: FormState, formData: FormData): Promise<FormState> {
  const operator = await requireWriter();
  if (operator.companyId) return { error: "error_owner_only" };
  const phoneNumberId = str(formData, "waPhoneNumberId", 40);
  const typedToken = str(formData, "waToken", 1000);
  const templateName = str(formData, "waTemplateName", 100) || "activo_alert";
  const templateLocale = str(formData, "waTemplateLocale", 10) || "ka";
  if (!/^\d{6,25}$/.test(phoneNumberId)) return { error: "wa_sender_bad_id" };
  if (!/^[a-z0-9_]{1,100}$/.test(templateName) || !/^[a-z]{2}(_[A-Z]{2})?$/.test(templateLocale)) {
    return { error: "wa_sender_bad_template" };
  }

  // A blank token keeps the one already saved (it is never shown back).
  const current = await prisma.operator.findUnique({ where: { id: operator.id }, select: { waTokenSealed: true } });
  const token = typedToken || openSecret(current?.waTokenSealed) || "";
  if (!token) return { error: "wa_sender_no_token" };

  const check = await checkWhatsAppNumber(phoneNumberId, token);
  if (!check.ok) return { error: check.error };
  const sealed = sealSecret(token);
  if (!sealed) return { error: "wa_sender_not_ready" };

  await prisma.operator.update({
    where: { id: operator.id },
    data: {
      waPhoneNumberId: phoneNumberId,
      waTokenSealed: sealed,
      waTemplateName: templateName,
      waTemplateLocale: templateLocale,
      waDisplayPhone: check.displayPhone,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeWhatsAppSender() {
  const operator = await requireWriter();
  if (operator.companyId) return;
  await prisma.operator.update({
    where: { id: operator.id },
    data: { waPhoneNumberId: null, waTokenSealed: null, waTemplateName: null, waTemplateLocale: null, waDisplayPhone: null },
  });
  revalidatePath("/settings");
}
