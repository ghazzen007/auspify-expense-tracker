import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { currentMonth, money, monthLabel } from "../lib/format.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "../components/Toast.jsx";
import { CategoryDot, ErrorNotice, Spinner } from "../components/ui.jsx";
import { MonthPicker } from "./DashboardPage.jsx";

function BudgetRow({ row, currency, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(row.limit ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(row.limit ?? "");
  }, [row.limit]);

  const used = row.limit ? Math.round((row.spent / row.limit) * 100) : null;
  const dirty = String(value) !== String(row.limit ?? "");

  async function save(event) {
    event.preventDefault();
    const amount = Number(value);
    if (!value || Number.isNaN(amount) || amount < 1) {
      setError("Enter a monthly limit of at least 1.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.setBudget(row.category, amount);
      toast(`Budget for ${row.category} saved.`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api.removeBudget(row.category);
      toast(`Budget for ${row.category} removed.`);
      onSaved();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="budget-item">
      <div className="budget-item-head">
        <span className="budget-name">
          <CategoryDot category={row.category} /> {row.category}
        </span>
        <span className={used > 100 ? "text-expense" : "muted"}>
          {row.limit ? `${money(row.spent, currency)} of ${money(row.limit, currency)}` : `${money(row.spent, currency)} spent, no limit`}
        </span>
      </div>
      {row.limit ? (
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(used, 100)} aria-label={`${row.category}: ${used}% of budget used`}>
          <span className={used > 100 ? "is-over" : used > 85 ? "is-close" : ""} style={{ width: `${Math.min(used, 100)}%` }} />
        </div>
      ) : null}
      {row.limit && used > 100 && <p className="budget-warning">Over budget by {money(row.spent - row.limit, currency)}.</p>}
      <form className="budget-form" onSubmit={save}>
        <label className="sr-only" htmlFor={`limit-${row.category}`}>
          Monthly limit for {row.category}
        </label>
        <input
          id={`limit-${row.category}`}
          type="number"
          inputMode="decimal"
          min="1"
          step="1"
          placeholder="Monthly limit"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving || !dirty}>
          {row.limit ? "Update" : "Set limit"}
        </button>
        {row.limit && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={remove} disabled={saving}>
            Remove
          </button>
        )}
      </form>
      {error && <p className="field-error">{error}</p>}
    </li>
  );
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .budgets(month, controller.signal)
      .then(setData)
      .catch((err) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, [month, reload]);

  if (error) return <ErrorNotice message={error} onRetry={() => setReload((r) => r + 1)} />;
  if (!data) return <Spinner label="Loading budgets" />;

  const withLimit = data.categories.filter((c) => c.limit);
  const totalLimit = withLimit.reduce((sum, c) => sum + c.limit, 0);
  const totalSpent = withLimit.reduce((sum, c) => sum + c.spent, 0);
  const sorted = [...data.categories].sort((a, b) => (b.limit ? 1 : 0) - (a.limit ? 1 : 0) || b.spent - a.spent);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Budgets</h1>
          <p className="muted">Set a monthly limit for the categories you want to keep an eye on.</p>
        </div>
        <div className="page-actions">
          <MonthPicker month={month} onChange={setMonth} />
        </div>
      </header>

      {withLimit.length > 0 && (
        <section className="card budget-total">
          <div>
            <span className="figure-label">Budgeted categories in {monthLabel(month)}</span>
            <strong className="figure-value">
              {money(totalSpent, user.currency)} <span className="muted">of {money(totalLimit, user.currency)}</span>
            </strong>
          </div>
          <div className="meter meter--lg">
            <span className={totalSpent > totalLimit ? "is-over" : totalSpent / totalLimit > 0.85 ? "is-close" : ""} style={{ width: `${Math.min((totalSpent / totalLimit) * 100, 100)}%` }} />
          </div>
        </section>
      )}

      <ul className="budget-grid">
        {sorted.map((row) => (
          <BudgetRow key={row.category} row={row} currency={user.currency} onSaved={() => setReload((r) => r + 1)} />
        ))}
      </ul>
    </>
  );
}
