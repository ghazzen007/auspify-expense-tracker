import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api.js";
import { categoryColor, currentMonth, dayLabel, money, monthLabel, shiftMonth, shortMonth } from "../lib/format.js";
import { useAuth } from "../hooks/useAuth.jsx";
import BalanceBeam from "../components/BalanceBeam.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import { CategoryDot, ErrorNotice, Modal, Spinner } from "../components/ui.jsx";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function MonthPicker({ month, onChange }) {
  const isCurrent = month >= currentMonth();
  return (
    <div className="month-picker">
      <button type="button" className="icon-btn" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <span aria-live="polite">{monthLabel(month)}</span>
      <button type="button" className="icon-btn" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month" disabled={isCurrent}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

export function ChartTooltip({ active, payload, label, currency, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <strong>{labelFormatter ? labelFormatter(label) : label}</strong>
      {payload.map((p) => (
        <span key={p.dataKey || p.name}>
          <i style={{ background: p.color || p.payload?.fill }} />
          {p.name}: {money(p.value, currency)}
        </span>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const currency = user.currency;
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([api.summary(month, controller.signal), api.trend({ months: 6, end: month }, controller.signal)])
      .then(([s, t]) => {
        setSummary(s);
        setTrend(t.months);
      })
      .catch((err) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, [month, reload]);

  const refresh = useCallback(() => setReload((r) => r + 1), []);

  if (error) return <ErrorNotice message={error} onRetry={refresh} />;
  if (!summary || !trend) return <Spinner label="Loading your dashboard" />;

  const { totals, previousTotals } = summary;
  const spendChange = previousTotals.expense > 0 ? Math.round(((totals.expense - previousTotals.expense) / previousTotals.expense) * 100) : null;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p className="muted">Here's how {monthLabel(month)} is going.</p>
        </div>
        <div className="page-actions">
          <MonthPicker month={month} onChange={setMonth} />
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            Add transaction
          </button>
        </div>
      </header>

      <div className="dash-top">
        <section className="card card--beam" aria-labelledby="beam-title">
          <h2 id="beam-title" className="card-title">
            This month on the scales
          </h2>
          <BalanceBeam income={totals.income} expense={totals.expense} currency={currency} />
        </section>

        <div className="dash-figures">
          <section className="card figure">
            <span className="figure-label">Balance across all months</span>
            <strong className={`figure-value ${summary.balance < 0 ? "is-negative" : ""}`}>{money(summary.balance, currency)}</strong>
            <span className="figure-note">Total income minus total spending up to the end of {monthLabel(month, "short")}.</span>
          </section>
          <section className="card figure">
            <span className="figure-label">Saved this month</span>
            <strong className="figure-value">{totals.savingsRate === null ? "—" : `${totals.savingsRate}%`}</strong>
            <span className="figure-note">{totals.savingsRate === null ? "Add some income to see your savings rate." : "Share of this month's income you didn't spend."}</span>
          </section>
          <section className="card figure">
            <span className="figure-label">Spending vs last month</span>
            <strong className={`figure-value ${spendChange > 0 ? "is-negative" : spendChange < 0 ? "is-positive" : ""}`}>
              {spendChange === null ? "—" : `${spendChange > 0 ? "+" : ""}${spendChange}%`}
            </strong>
            <span className="figure-note">
              {money(previousTotals.expense, currency)} spent in {monthLabel(shiftMonth(month, -1), "long").split(" ")[0]}.
            </span>
          </section>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card" aria-labelledby="trend-title">
          <h2 id="trend-title" className="card-title">
            Income and spending, last 6 months
          </h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend} barGap={4} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e5ef" />
                <XAxis dataKey="month" tickFormatter={shortMonth} tickLine={false} axisLine={false} tick={{ fill: "#626885", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => money(v, currency, { compact: true })} tickLine={false} axisLine={false} width={70} tick={{ fill: "#626885", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "rgba(75,91,215,0.06)" }} content={<ChartTooltip currency={currency} labelFormatter={(m) => monthLabel(m)} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                <Bar dataKey="income" name="Income" fill="#178a62" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expense" name="Spending" fill="#d9482b" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" aria-labelledby="cat-title">
          <h2 id="cat-title" className="card-title">
            Where the money went
          </h2>
          {summary.expenseByCategory.length === 0 ? (
            <p className="empty-note">No spending recorded in {monthLabel(month)}.</p>
          ) : (
            <div className="donut-wrap">
              <div className="donut">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={summary.expenseByCategory} dataKey="total" nameKey="category" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none">
                      {summary.expenseByCategory.map((c) => (
                        <Cell key={c.category} fill={categoryColor(c.category)} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span>Spent</span>
                  <strong>{money(totals.expense, currency, { compact: true })}</strong>
                </div>
              </div>
              <ul className="legend-list">
                {summary.expenseByCategory.slice(0, 6).map((c) => (
                  <li key={c.category}>
                    <CategoryDot category={c.category} />
                    <span className="legend-name">{c.category}</span>
                    <span className="legend-share">{c.share}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="budget-title">
          <div className="card-head">
            <h2 id="budget-title" className="card-title">
              Budgets
            </h2>
            <Link to="/budgets">Manage</Link>
          </div>
          {summary.budgets.length === 0 ? (
            <p className="empty-note">
              No budgets yet. <Link to="/budgets">Set a monthly limit</Link> for the categories you want to watch.
            </p>
          ) : (
            <ul className="budget-list">
              {summary.budgets.slice(0, 5).map((b) => (
                <li key={b.category}>
                  <div className="budget-row">
                    <span>
                      <CategoryDot category={b.category} /> {b.category}
                    </span>
                    <span className={b.used > 100 ? "text-expense" : "muted"}>
                      {money(b.spent, currency)} of {money(b.limit, currency)}
                    </span>
                  </div>
                  <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.used, 100)} aria-label={`${b.category}: ${b.used}% of budget used`}>
                    <span className={b.used > 100 ? "is-over" : b.used > 85 ? "is-close" : ""} style={{ width: `${Math.min(b.used, 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="recent-title">
          <div className="card-head">
            <h2 id="recent-title" className="card-title">
              Latest transactions
            </h2>
            <Link to="/transactions">See all</Link>
          </div>
          {summary.recent.length === 0 ? (
            <p className="empty-note">
              Nothing here yet. <button type="button" className="link-btn" onClick={() => setAdding(true)}>Add your first transaction</button>.
            </p>
          ) : (
            <ul className="tx-list tx-list--compact">
              {summary.recent.map((t) => (
                <li key={t.id} className="tx">
                  <CategoryDot category={t.category} />
                  <div className="tx-main">
                    <span className="tx-title">{t.description || t.category}</span>
                    <span className="tx-sub">
                      {t.category}, {dayLabel(t.date)}
                    </span>
                  </div>
                  <span className={`tx-amount tx-amount--${t.type}`}>{money(t.type === "income" ? t.amount : -t.amount, currency, { sign: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a transaction">
        <TransactionForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      </Modal>
    </>
  );
}
