import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { deleteContract } from "@/lib/assets/actions";
import AssetForm from "../../asset-form";
import ContractForm from "../../contract-form";
import { assetFormProps } from "../../form-helpers";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await requireOperator();

  const { id } = await params;
  const asset = await prisma.asset.findFirst({
    where: { id, operatorId: operator.id },
    include: { contracts: { orderBy: { endDate: "desc" } } },
  });
  if (!asset) notFound();

  const locale = await getLocale();
  const props = await assetFormProps(locale, operator.id, asset.id);

  const contractLabelKeys: StringKey[] = [
    "contract_add", "contract_tenant", "tenant_phone", "contract_start", "contract_end",
    "contract_rent", "contract_deposit", "asset_notes", "error_required",
    "error_invalid_number", "error_dates", "error_email_taken",
  ];
  const contractLabels = Object.fromEntries(
    contractLabelKeys.map((key) => [key, t(locale, key)]),
  );

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtDate = new Intl.DateTimeFormat(intl, {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <main>
      <h1>{t(locale, "asset_edit_title")}</h1>
      <AssetForm
        {...props}
        asset={{
          id: asset.id,
          name: asset.name,
          nameKa: asset.nameKa ?? "",
          category: asset.category,
          type: asset.type,
          city: asset.city ?? "",
          district: asset.district ?? "",
          address: asset.address ?? "",
          areaSqm: asset.areaSqm?.toString() ?? "",
          estimatedValue: asset.estimatedValue?.toString() ?? "",
          myhomeUrl: asset.myhomeUrl ?? "",
          ssUrl: asset.ssUrl ?? "",
          myautoUrl: asset.myautoUrl ?? "",
          airbnbUrl: asset.airbnbUrl ?? "",
          bookingUrl: asset.bookingUrl ?? "",
          rentalMode: asset.rentalMode,
          status: asset.status,
          unitId: asset.unitId ?? "",
          notes: asset.notes ?? "",
        }}
      />

      <section>
        <h2>{t(locale, "contracts_title")}</h2>
        {asset.contracts.length > 0 && (
          <ul className="mb-4 space-y-2">
            {asset.contracts.map((contract) => (
              <li
                key={contract.id}
                className="alert-card" style={{ padding: "12px 18px", alignItems: "center" }}
              >
                <div>
                  <span className="font-medium">
                    {contract.monthlyRent} {contract.currency}
                  </span>{" "}
                  · {contract.tenantName ?? "—"}
                  {contract.tenantPhone ? ` (${contract.tenantPhone})` : ""} · {fmtDate.format(contract.startDate)}{" "}
                  – {fmtDate.format(contract.endDate)}{" "}
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    ({t(locale, `cstatus_${contract.status}` as StringKey)})
                  </span>
                </div>
                <form action={deleteContract}>
                  <input type="hidden" name="contractId" value={contract.id} />
                  <input type="hidden" name="assetId" value={asset.id} />
                  <button
                    type="submit"
                    className="btn-chip"
                    aria-label="delete contract"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ContractForm assetId={asset.id} labels={contractLabels} />
      </section>
    </main>
  );
}
