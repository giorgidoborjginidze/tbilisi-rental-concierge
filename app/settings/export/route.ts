import { NextResponse } from "next/server";
import { getSessionOperator } from "@/lib/auth/session";
import { exportWorkspace } from "@/lib/account/export";

// "Download my data": the workspace's own records as one JSON file
// (lib/account/export.ts). The signed-in owner only.
export async function GET() {
  const operator = await getSessionOperator();
  if (!operator) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await exportWorkspace(operator.id);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="activo-export-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
