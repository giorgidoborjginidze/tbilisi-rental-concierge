import { NextResponse } from "next/server";

// Where Flitt sends the buyer back after the payment page. Flitt may come
// back with a cross-site POST, which carries no session cookie
// (SameSite=Lax) — so this handler only forwards, with a 303, to the GET
// page that shows this order's real status (looked up from the Payment
// row, which the verified server callback updates). Nothing in the request
// body is trusted.
function forward(request: Request) {
  const order = new URL(request.url).searchParams.get("order") ?? "";
  const target = /^activo-[A-Za-z0-9-]{1,120}$/.test(order)
    ? `/billing?order=${encodeURIComponent(order)}`
    : "/billing?paid=1";
  // A relative Location: the browser stays on the host it came back to
  // (request.url may name the server's own host behind a proxy).
  return new NextResponse(null, { status: 303, headers: { Location: target } });
}

export async function GET(request: Request) {
  return forward(request);
}

export async function POST(request: Request) {
  return forward(request);
}
