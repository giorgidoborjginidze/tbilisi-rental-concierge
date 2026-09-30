import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { deleteIncome } from "@/lib/assets/actions";
import ConfirmAction from "@/app/confirm-action";
import IncomeForm from "./income-form";
import { formatMoney } from "@/lib/format";
import { IconClose } from "../icons";

export interface IncomeRow {
  id: string;
  source: string;
  description: string | null;
  date: string; // preformatted
  amount: number;
  currency: string;
}

export default function IncomeSection({
  locale,
  incomes,
}: {
  locale: Locale;
  incomes: IncomeRow[];
}) {
  const labelKeys: StringKey[] = [
    "income_add", "income_source", "income_amount", "income_date", "saved_short",
    "income_desc", "source_salary", "source_business", "source_dividend",
    "source_other", "save", "error_required", "error_invalid_number",
    "error_email_taken", "error_dates",
  ];
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  return (
    <section>
      <h2>{t(locale, "income_title")}</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card" style={{ height: "fit-content" }}>
          <table>
            <tbody>
              {incomes.length === 0 ? (
                <tr>
                  <td style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>—</td>
                </tr>
              ) : (
                incomes.map((income) => (
                  <tr key={income.id}>
                    <td style={{ fontWeight: 400 }}>
                      <div>
                        {t(locale, `source_${income.source}` as StringKey)}
                        {income.description && (
                          <span style={{ color: "var(--color-text-muted)" }}>
                            {" "}· {income.description}
                          </span>
                        )}
                      </div>
                      <div className="cell-sub">{income.date}</div>
                    </td>
                    <td className="num" style={{ fontWeight: 500 }}>
                      {formatMoney(income.amount, income.currency, "auto")}
                    </td>
                    <td className="num">
                      <ConfirmAction
                        action={deleteIncome}
                        fields={{ incomeId: income.id }}
                        trigger={<IconClose size={15} />}
                        ariaLabel={t(locale, "aria_delete_income")}
                        question={t(locale, "income_delete_q")}
                        confirmLabel={t(locale, "delete")}
                        cancelLabel={t(locale, "cancel")}
                        inline
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <IncomeForm labels={labels} />
      </div>
    </section>
  );
}
