"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function UnitFilter({
  units,
  selected,
  allLabel,
  basePath = "/calendar",
}: {
  units: { id: string; label: string }[];
  selected: string;
  allLabel?: string;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={selected}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams);
        if (event.target.value) params.set("unit", event.target.value);
        else params.delete("unit");
        router.push(`${basePath}?${params.toString()}`);
      }}
      className="rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
    >
      {allLabel !== undefined && <option value="">{allLabel}</option>}
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.label}
        </option>
      ))}
    </select>
  );
}
