"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { asCurrency } from "@/lib/fx/convert";
import { dayFromKey } from "@/lib/time";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { INVOICE_STATUSES, type InvoiceStatus } from "./draft";

const str = (formData: FormData, key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);
const day = (formData: FormData, key: string): Date | null => {
  const value = str(formData, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayFromKey(value) : null;
};

/**
 * Issues an invoice and opens it. The number is the account's next one;
 * two invoices issued at the same instant cannot share it (the unique
 * index refuses the second, which simply takes the next number).
 */
export async function createInvoice(formData: FormData) {
  const operator = await requireWriter();
  const billTo = str(formData, "billTo", 120);
  const description = str(formData, "description", 300);
  const amount = Math.round(Number(str(formData, "amount", 20).replace(",", ".")) * 100) / 100;
  const back = (error: string) => {
    const params = new URLSearchParams();
    for (const key of ["contract", "asset"]) {
      const value = str(formData, `${key}Id`, 40);
      if (value) params.set(key, value);
    }
    params.set("error", error);
    redirect(`/invoices/new?${params}`);
  };
  if (!billTo || !description) back("error_required");
  if (!(amount > 0)) back("invoice_error_amount");

  // Only the owner's own contract or asset can be named on it.
  let contractId: string | null = str(formData, "contractId", 40) || null;
  let assetId: string | null = str(formData, "assetId", 40) || null;
  if (contractId) {
    const contract = await prisma.rentalContract.findFirst({
      where: { id: contractId, ...LIVE_CONTRACT, asset: { operatorId: operator.id } },
      select: { id: true, assetId: true },
    });
    contractId = contract?.id ?? null;
    assetId = contract?.assetId ?? assetId;
  }
  if (assetId && !(await prisma.asset.count({ where: { id: assetId, operatorId: operator.id } }))) assetId = null;

  const data = {
    operatorId: operator.id,
    assetId,
    contractId,
    billTo,
    billToPhone: str(formData, "billToPhone", 30) || null,
    description,
    amount,
    currency: asCurrency(str(formData, "currency", 3)),
    periodStart: day(formData, "periodStart"),
    // The form shows the last day; stored exclusive, like a contract's end.
    periodEnd: (() => {
      const last = day(formData, "periodEndShown");
      return last ? new Date(last.getTime() + 86_400_000) : null;
    })(),
    dueDate: day(formData, "dueDate"),
    note: str(formData, "note", 500) || null,
  };
  let id: string | null = null;
  for (let attempt = 0; attempt < 4 && !id; attempt += 1) {
    const last = await prisma.invoice.findFirst({
      where: { operatorId: operator.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    try {
      const row = await prisma.invoice.create({
        data: { ...data, number: (last?.number ?? 0) + 1, shareToken: randomBytes(18).toString("base64url") },
        select: { id: true },
      });
      id = row.id;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  if (!id) back("invoice_error_retry");
  revalidatePath("/invoices");
  redirect(`/invoices/${id}?issued=1`);
}

export async function setInvoiceStatus(formData: FormData) {
  const operator = await requireWriter();
  const id = str(formData, "id", 40);
  const status = str(formData, "status", 10) as InvoiceStatus;
  if (!(INVOICE_STATUSES as readonly string[]).includes(status)) return;
  const invoice = await prisma.invoice.findFirst({ where: { id, operatorId: operator.id }, select: { id: true, status: true } });
  // A voided invoice stays void: its number is spent.
  if (!invoice || invoice.status === "void") return;
  await prisma.invoice.update({
    where: { id },
    data: { status, paidAt: status === "paid" ? new Date() : null },
  });
  revalidatePath("/invoices", "layout");
}

/** The "from" block printed on every invoice. */
export async function saveInvoiceIssuer(formData: FormData) {
  const operator = await requireWriter();
  await prisma.operator.update({
    where: { id: operator.id },
    data: { invoiceIssuer: str(formData, "invoiceIssuer", 600) || null },
  });
  revalidatePath("/invoices", "layout");
  const back = str(formData, "back", 200);
  if (back.startsWith("/invoices")) redirect(back);
}
