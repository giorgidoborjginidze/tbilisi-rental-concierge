"use client";

import { useActionState } from "react";
import { startCheckout } from "@/lib/billing/actions";
import { IconCheck } from "../icons";
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
  checkoutOff = false,
  labels,
}: {
  plans: PlanCard[];
  /** The explicitly chosen (bought) plan, paid or lapsed; null if none. */
  currentPlan: string | null;
  /** The plan whose limits currently apply (trial tier included). */
  effectivePlanId: string;
  /** Online payment is not set up on this deployment. */
  checkoutOff?: boolean;
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
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(220px, 100%), 1fr))`, marginTop: 14 }}
      >
        {plans.map((plan) => {
          const isChosen = currentPlan === plan.id;
          const isActive = effectivePlanId === plan.id;
          return (
            <div
              key={plan.id}
              className="kpi"
              style={{
                display: "flex",
                flexDirection: "column",
                ...(isActive
                  ? { borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary), var(--shadow-card)" }
                  : {}),
              }}
            >
              {/* The badge's height in every card, so the prices and lists
                  line up whether or not the card is the current plan. */}
              <div className="flex items-center justify-between" style={{ minHeight: 26 }}>
                <div className="kpi__label">{labels[`plan_${plan.id}`]}</div>
                {isActive && (
                  <span className="badge badge--good">{labels.billing_current}</span>
                )}
              </div>
              <div className="kpi__value">
                {plan.priceGel} {labels.per_month}
              </div>
              <ul className="kpi__sub" style={{ listStyle: "none", padding: 0, marginTop: 10, display: "grid", gap: 4 }}>
                <li className="plan-feature"><IconCheck size={14} /> {plan.maxAssets} {labels.billing_assets}</li>
                <li className="plan-feature"><IconCheck size={14} /> {plan.maxUnits} {labels.billing_units}</li>
                {plan.isBusiness && (
                  <li className="plan-feature"><IconCheck size={14} /> {plan.maxMembers} {labels.billing_members}</li>
                )}
                {plan.analysis && <li className="plan-feature"><IconCheck size={14} /> {labels.billing_analysis}</li>}
              </ul>
              <form action={formAction} style={{ marginTop: "auto", paddingTop: 14 }}>
                <input type="hidden" name="plan" value={plan.id} />
                {/* The bought plan is renewed here, one month at a time. */}
                <button
                  type="submit"
                  disabled={pending || checkoutOff}
                  className={isChosen ? "btn-secondary" : "btn-primary"}
                  style={{ width: "100%", textAlign: "center" }}
                >
                  {pending ? "…" : isChosen ? labels.billing_renew : labels.billing_pay}
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
