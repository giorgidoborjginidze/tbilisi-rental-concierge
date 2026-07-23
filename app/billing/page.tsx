import { redirect } from "next/navigation";

// Billing now lives inside the unified Settings hub. Keep this route as a
// redirect so old links (and the "?paid=1" payment return) still work.
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const paid = (await searchParams).paid === "1" ? "?paid=1" : "";
  redirect(`/settings${paid}`);
}
