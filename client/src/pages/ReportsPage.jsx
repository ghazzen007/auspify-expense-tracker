import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api.js";
import { categoryColor, currentMonth, lastDayOfMonth, money, monthLabel, shiftMonth, shortDate, shortMonth, todayISO } from "../lib/format.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { CategoryDot, ErrorNotice, Spinner } from "../components/ui.jsx";
import { ChartTooltip } from "./DashboardPage.jsx";

function presetRange(preset) {
  const month = currentMonth();
  const year = month.slice(0, 4);
  switch (preset) {
    case "this-month":
      return { from: `${month}-01`, to: todayISO() };
    case "last-month": {
      const last = shiftMonth(month, -1);
      return { from: `${last}-01`, to: lastDayOfMonth(last) };
    }
    case "last-3":
      return { from: `${shiftMonth(month, -2)}-01`, to: todayISO() };
    case "last-6":
      return { from: `${shiftMonth(month, -5)}-01`, to: todayISO() };
    case "this-year":
    default:
      return { from: `${year}-01-01`, to: todayISO() };
  }
}

const PRESETS = [
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["last-3", "Last 3 months"],
  ["last-6", "Last 6 months"],
  ["this-year", "This year"],
];

function CategoryTable({ rows, total, currency, kind }) {
  if (!rows.length) return <p className="empty-note">No {kind} in this period.</p>;
  return (
    <table className="cat-table">
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col" className="sr-only">
            Share
          </th>
          <th scope="col" className="num">
            Amount
          </th>
          <th scope="col" className="num">
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.category}>
            <td>
              <CategoryDot category={r.category} /> {r.category}
            </td>
            <td className="cat-bar-cell" aria-hidden="true">
              <span className="cat-bar" style={{ width: `${r.share}%`, background: categoryColor(r.category) }} />
            </td>
            <td className="num">{money(r.total, currency)}</td>
            <td className="num muted">{r.share}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td />
          <td className="num">{money(total, currency)}</td>
          <td className="num muted">100%</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const currency = user.currency;
  const [preset, setPreset] = useState("last-6");
  const [range, setRange] = useState(presetRange("last-6"));
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .rangeReport(range, controller.signal)
      .then(setReport)
      .catch((err) => err.name !== "AbortError" && setError(err.message))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [range]);

  const choosePreset = (value) => {
    setPreset(value);
    setRange(presetRange(value));
  };

  const monthly = useMemo(() => report?.monthly || [], [report]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="muted">See where your money comes from and where it goes, for any period.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn--ghost" href={api.exportUrl(range)} download>
            Export this period
          </a>
        </div>
      </header>

      <section className="card period-bar" aria-label="Period">
        <div className="chips" role="group" aria-label="Quick periods">
          {PRESETS.map(([value, label]) => (
            <button key={value} type="button" className="chip" aria-pressed={preset === value} onClick={() => choosePreset(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="period-custom">
          <label className="filter-field">
            <span className="filter-label">From</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
            />
          </label>
          <label className="filter-field">
            <span className="filter-label">To</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
            />
          </label>
        </div>
      </section>

      {error && <ErrorNotice message={error} />}
      {!error && !report && <Spinner label="Building your report" />}

      {!error && report && (
        <div className={`report${loading ? " is-loading" : ""}`}>
          <section className="report-totals" aria-label="Totals for the period">
            <div className="card figure">
              <span className="figure-label">Money in</span>
              <strong className="figure-value is-positive">{money(report.totals.income, currency)}</strong>
            </div>
            <div className="card figure">
              <span className="figure-label">Money out</span>
              <strong className="figure-value is-negative">{money(report.totals.expense, currency)}</strong>
            </div>
            <div className="card figure">
              <span className="figure-label">Left over</span>
              <strong className="figure-value">{money(report.totals.net, currency, { sign: true })}</strong>
              <span className="figure-note">{report.totals.savingsRate === null ? "No income in this period." : `${report.totals.savingsRate}% of income saved`}</span>
            </div>
            <div className="card figure">
              <span className="figure-label">Average daily spending</span>
              <strong className="figure-value">{money(report.averageDailySpending, currency)}</strong>
            </div>
          </section>

          {monthly.length > 1 && (
            <section className="card" aria-labelledby="monthly-title">
              <h2 id="monthly-title" className="card-title">
                Month by month
              </h2>
              <div className="chart">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-income" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#178a62" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#178a62" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g-expense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d9482b" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#d9482b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e5ef" />
                    <XAxis dataKey="month" tickFormatter={shortMonth} tickLine={false} axisLine={false} tick={{ fill: "#626885", fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => money(v, currency, { compact: true })} tickLine={false} axisLine={false} width={70} tick={{ fill: "#626885", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip currency={currency} labelFormatter={(m) => monthLabel(m)} />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="income" name="Income" stroke="#178a62" strokeWidth={2.5} fill="url(#g-income)" />
                    <Area type="monotone" dataKey="expense" name="Spending" stroke="#d9482b" strokeWidth={2.5} fill="url(#g-expense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div className="report-grid">
            <section className="card" aria-labelledby="spend-title">
              <h2 id="spend-title" className="card-title">
                Spending by category
              </h2>
              <CategoryTable rows={report.expenseByCategory} total={report.totals.expense} currency={currency} kind="spending" />
            </section>

            <div className="report-side">
              <section className="card" aria-labelledby="income-title">
                <h2 id="income-title" className="card-title">
                  Income sources
                </h2>
                <CategoryTable rows={report.incomeByCategory} total={report.totals.income} currency={currency} kind="income" />
              </section>

              <section className="card" aria-labelledby="top-title">
                <h2 id="top-title" className="card-title">
                  Biggest expenses
                </h2>
                {report.topExpenses.length === 0 ? (
                  <p className="empty-note">No spending in this period.</p>
                ) : (
                  <ol className="tx-list tx-list--compact">
                    {report.topExpenses.map((t) => (
                      <li key={t.id} className="tx">
                        <CategoryDot category={t.category} />
                        <span className="tx-main">
                          <span className="tx-title">{t.description || t.category}</span>
                          <span className="tx-sub">
                            {t.category}, {shortDate(t.date)}
                          </span>
                        </span>
                        <span className="tx-amount tx-amount--expense">{money(-t.amount, currency, { sign: true })}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
