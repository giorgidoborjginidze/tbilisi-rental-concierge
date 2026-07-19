import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { deleteIncome } from "@/lib/assets/actions";
import IncomeForm from "./income-form";

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
    "income_add", "income_source", "income_amount", "income_date",
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
                      {income.amount} {income.currency}
                    </td>
                    <td className="num">
                      <form action={deleteIncome}>
                        <input type="hidden" name="incomeId" value={income.id} />
                        <button type="submit" className="btn-chip" aria-label="delete">
                          ✕
                        </button>
                      </form>
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
