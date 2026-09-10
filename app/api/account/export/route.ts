import { getSessionOperator } from "@/lib/auth/session";
import { collectAccountData } from "@/lib/account/dsr";
import { recordAudit } from "@/lib/audit/log";

// Right of access and portability, served as a file rather than a support
// ticket: GET /api/account/export downloads the signed-in account's whole
// record set as JSON. Session-scoped like everything else — there is no way
// to name someone else's account here, because the account is never a
// parameter.
export const dynamic = "force-dynamic";

export async function GET() {
  const operator = await getSessionOperator();
  if (!operator) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await collectAccountData(operator.id);

  await recordAudit({
    action: "data_export",
    actorId: operator.id,
    actorEmail: operator.email,
    entity: "Operator",
    entityId: operator.id,
    detail: { units: data.units.length, assets: data.assets.length },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="activo-export-${stamp}.json"`,
      // An export is the most concentrated copy of the account there is.
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
