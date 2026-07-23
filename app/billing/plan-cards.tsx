"use client";

import { useActionState } from "react";
import { startCheckout } from "@/lib/billing/actions";
import type { FormState } from "@/lib/units/actions";

export interface PlanCard {
  id: string;
  priceGel: number;
  maxAssets: number;
  maxUnits: number;
  maxMembers: number;
  isBusiness: boolean;
  analysis: boolean;
}

export default function PlanCards({
  plans,
  currentPlan,
  effectivePlanId,
  labels,
}: {
  plans: PlanCard[];
  /** The explicitly chosen plan (null while on trial only). */
  currentPlan: string | null;
  /** The plan whose limits currently apply (trial tier included). */
  effectivePlanId: string;
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    startCheckout,
    null,
  );

  return (
    <section>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, marginTop: 14 }}
      >
        {plans.map((plan) => {
          const isChosen = currentPlan === plan.id;
          const isActive = effectivePlanId === plan.id;
          return (
            <div
              key={plan.id}
              className="kpi"
              style={
                isActive
                  ? { borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary), var(--shadow-card)" }
                  : undefined
              }
            >
              <div className="flex items-center justify-between">
                <div className="kpi__label">{labels[`plan_${plan.id}`]}</div>
                {isActive && (
                  <span className="badge badge--listed">{labels.billing_current}</span>
                )}
              </div>
              <div className="kpi__value">
                {plan.priceGel} {labels.per_month}
              </div>
              <ul className="kpi__sub" style={{ listStyle: "none", padding: 0, marginTop: 10, display: "grid", gap: 4 }}>
                <li>✓ {plan.maxAssets} {labels.billing_assets}</li>
                <li>✓ {plan.maxUnits} {labels.billing_units}</li>
                {plan.isBusiness && (
                  <li>✓ {plan.maxMembers} {labels.billing_members}</li>
                )}
                {plan.analysis && <li>✓ {labels.billing_analysis}</li>}
              </ul>
              <form action={formAction} style={{ marginTop: 14 }}>
                <input type="hidden" name="plan" value={plan.id} />
                <button
                  type="submit"
                  disabled={pending || isChosen}
                  className={isChosen ? "btn-secondary" : "btn-primary"}
                  style={{ width: "100%", textAlign: "center" }}
                >
                  {isChosen ? labels.billing_chosen : (pending ? "…" : labels.billing_pay)}
                </button>
              </form>
            </div>
          );
        })}
      </div>
      {state?.error && (
        <p style={{ color: "var(--status-danger-text)", fontSize: 13, marginTop: 10 }}>
          {labels[state.error] ?? state.error}
        </p>
      )}
    </section>
  );
}
