"use client";

import { useState } from "react";
import { deleteContract } from "@/lib/assets/actions";
import { IconClose, IconEdit } from "@/app/icons";
import ConfirmAction from "@/app/confirm-action";
import ContractForm from "./contract-form";
import type { ContractValues } from "./contract-fields";

export interface ContractRow {
  id: string;
  /** "1,400 ₾ / თვე · Nino (+995…) · 1 მარ 2026 – 1 მარ 2027". */
  summary: string;
  /** "(მიმდინარე)". */
  phase: string;
  /** How many payments are recorded (said in the delete question). */
  payments: number;
  values: ContractValues;
}

// The asset's contracts, each with "edit" (the form unfolds under the row)
// and "delete" (asked in the page; the contract can be brought back for 30
// days, with its payments).
export default function ContractList({
  assetId,
  rows,
  labels,
}: {
  assetId: string;
  rows: ContractRow[];
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (rows.length === 0) return null;
  return (
    <ul className="mb-4 space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="alert-card contract-row">
          <div className="contract-row__main">
            <div className="contract-row__text">
              {row.summary}{" "}
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{row.phase}</span>
            </div>
            <div className="contract-row__actions">
              <button
                type="button"
                className={`btn-chip btn-chip--icon-text${editing === row.id ? " btn-chip--active" : ""}`}
                aria-expanded={editing === row.id}
                onClick={() => setEditing(editing === row.id ? null : row.id)}
              >
                <IconEdit size={14} /> {labels.edit}
              </button>
              <ConfirmAction
                action={deleteContract}
                fields={{ contractId: row.id, assetId }}
                trigger={<IconClose size={15} />}
                ariaLabel={labels.aria_delete_contract}
                question={(row.payments > 0 ? labels.contract_delete_q_payments : labels.contract_delete_q).replace(
                  "{n}",
                  String(row.payments),
                )}
                confirmLabel={labels.delete}
                cancelLabel={labels.cancel}
              />
            </div>
          </div>
          {editing === row.id && (
            <div className="contract-row__edit">
              <ContractForm
                assetId={assetId}
                labels={labels}
                contract={{ ...row.values, id: row.id }}
                onDone={() => setEditing(null)}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
