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
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-medium">{t(locale, "income_title")}</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <tbody>
              {incomes.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-neutral-500">—</td>
                </tr>
              ) : (
                incomes.map((income) => (
                  <tr
                    key={income.id}
                    className="border-t border-neutral-200 first:border-t-0 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2">
                      <div>
                        {t(locale, `source_${income.source}` as StringKey)}
                        {income.description && (
                          <span className="text-neutral-500"> · {income.description}</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">{income.date}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {income.amount} {income.currency}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <form action={deleteIncome}>
                        <input type="hidden" name="incomeId" value={income.id} />
                        <button
                          type="submit"
                          className="text-xs text-neutral-400 hover:text-red-500"
                          aria-label="delete"
                        >
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
