import { NextResponse } from "next/server";
import { restoreHolding } from "@/lib/assets/actions";

// The undo of deleting a holding. A deleted holding's page is gone, so its
// undo is offered on /assets; a server action can only be called from a
// page that imports it, so the toast posts the snapshot here instead
// (same session, same checks — lib/assets/actions.ts restoreHolding).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false }, { status: 400 });
  const result = await restoreHolding(form);
  return NextResponse.json({ ok: Boolean(result) }, { status: result ? 200 : 409 });
}
