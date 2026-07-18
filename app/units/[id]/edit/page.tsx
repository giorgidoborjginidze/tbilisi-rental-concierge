import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import { parseAmenities, parseChannelLinks } from "@/lib/types";
import UnitForm from "../../unit-form";
import { unitFormProps } from "../../form-helpers";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await prisma.operator.findFirst();
  if (!operator) redirect("/onboarding");

  const { id } = await params;
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) notFound();

  const locale = await getLocale();
  const links = parseChannelLinks(unit.channelLinks);

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t(locale, "unit_edit_title")}</h1>
      <UnitForm
        {...unitFormProps(locale)}
        unit={{
          id: unit.id,
          name: unit.name,
          nameKa: unit.nameKa ?? "",
          city: unit.city,
          district: unit.district,
          address: unit.address,
          type: unit.type,
          capacity: unit.capacity,
          bedrooms: unit.bedrooms,
          baseNightlyRate: unit.baseNightlyRate,
          currency: unit.currency,
          amenities: parseAmenities(unit.amenities).join(", "),
          airbnbUrl: links.airbnbUrl ?? "",
          bookingUrl: links.bookingUrl ?? "",
          icalUrls: links.icalUrls.join("\n"),
        }}
      />
    </main>
  );
}
