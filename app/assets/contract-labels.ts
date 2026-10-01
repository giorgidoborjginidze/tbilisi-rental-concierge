import type { StringKey } from "@/lib/i18n/strings";

/** The strings every contract form needs (add, edit, the tenant step). */
export const CONTRACT_LABEL_KEYS: StringKey[] = [
  "contract_add", "contract_edit_title", "contract_tenant", "tenant_phone", "contract_start",
  "contract_end", "contract_deposit", "asset_notes", "error_required",
  "error_invalid_number", "error_dates", "error_contract_dates", "error_demo_readonly",
  "pay_period", "period_daily", "period_weekly", "period_monthly", "pay_grace",
  "contract_amount_daily", "contract_amount_weekly", "contract_amount_monthly",
  "contract_monthly_equiv", "contract_paid_up_to", "contract_paid_up_to_hint",
  "contract_reminders", "contract_wa_consent", "contract_opt_out", "contract_saved", "contract_added", "form_required_legend",
  "save", "cancel", "delete", "edit", "aria_delete_contract",
  "contract_delete_q", "contract_delete_q_payments",
];
