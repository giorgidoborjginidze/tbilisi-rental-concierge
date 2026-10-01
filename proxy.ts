// Real 404s for detail pages. /assets/<id>/edit, /assets/<id>/rental,
// /units/<id>/edit and /bookings/<id>/edit sit under loading.tsx skeletons,
// so they start streaming as 200 before they learn the record is missing —
// a "soft 404". Here, before the page runs, a signed-in request for a record
// that is not in its workspace is rewritten to a path no page answers, and
// Next.js serves app/not-found.tsx with status 404.
//
// A request with no session cookie goes straight to sign-in (a real
// redirect, where the page could only redirect from inside a 200 stream),
// and any failure here lets the request through: the page's own checks
// still show the right screen.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { detailRecord } from "@/lib/routing/missing";

export const config = {
  matcher: ["/assets/:id/edit", "/assets/:id/rental", "/units/:id/edit", "/bookings/:id/edit"],
};

async function exists(kind: "asset" | "unit" | "booking", id: string, operatorId: string) {
  if (kind === "asset") return (await prisma.asset.count({ where: { id, operatorId } })) > 0;
  if (kind === "unit") return (await prisma.unit.count({ where: { id, operatorId } })) > 0;
  return (await prisma.booking.count({ where: { id, unit: { operatorId } } })) > 0;
}

export async function proxy(request: NextRequest) {
  const record = detailRecord(request.nextUrl.pathname);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!record) return NextResponse.next();
  if (!token) return NextResponse.redirect(new URL("/login", request.url));
  try {
    const session = await prisma.session.findUnique({
      where: { id: createHash("sha256").update(token).digest("hex") },
      select: { expiresAt: true, operator: { select: { id: true, companyId: true } } },
    });
    if (!session || session.expiresAt < new Date()) return NextResponse.next();
    // A team member's records are the company's (lib/auth/session.ts).
    const workspace = session.operator.companyId ?? session.operator.id;
    if (await exists(record.kind, record.id, workspace)) return NextResponse.next();
    return NextResponse.rewrite(new URL("/_missing", request.url));
  } catch {
    return NextResponse.next();
  }
}
