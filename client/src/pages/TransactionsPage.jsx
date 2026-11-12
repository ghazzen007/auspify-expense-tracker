import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { dayLabel, money } from "../lib/format.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useMeta } from "../hooks/useMeta.jsx";
import { useToast } from "../components/Toast.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import { CategoryDot, ConfirmDialog, ErrorNotice, Modal, Spinner } from "../components/ui.jsx";

const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const { user } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const currency = user.currency;
  const [params, setParams] = useSearchParams();

  const filters = {
    type: params.get("type") || "",
    category: params.get("category") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
    search: params.get("search") || "",
    sort: params.get("sort") || "newest",
    page: Number(params.get("page")) || 1,
  };

  const [searchText, setSearchText] = useState(filters.search);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null); // null | "new" | transaction
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  // Always build on the latest URL (not a stale copy), so quick successive changes don't undo each other
  const update = (changes) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries({ page: 1, ...changes }).forEach(([key, value]) => {
          if (!value || (key === "sort" && value === "newest") || (key === "page" && value === 1)) next.delete(key);
          else next.set(key, value);
        });
        return next;
      },
      { replace: true }
    );
  };

  // Debounce the search box: write it to the URL 300 ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => {
      setParams(
        (prev) => {
          const value = searchText.trim();
          if ((prev.get("search") || "") === value) return prev;
          const next = new URLSearchParams(prev);
          if (value) next.set("search", value);
          else next.delete("search");
          next.delete("page");
          return next;
        },
        { replace: true }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, setParams]);

  const queryKey = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .transactions({ ...filters, limit: PAGE_SIZE }, controller.signal)
      .then(setData)
      .catch((err) => err.name !== "AbortError" && setError(err.message))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reload]);

  // Group the page of transactions by day for easier scanning
  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const t of data.items) {
      const key = t.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()];
  }, [data]);

  const categories = filters.type === "income" ? meta.incomeCategories : filters.type === "expense" ? meta.expenseCategories : [...meta.expenseCategories, ...meta.incomeCategories];
  const hasFilters = Boolean(filters.type || filters.category || filters.from || filters.to || filters.search);

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.deleteTransaction(deleting.id);
      toast("Transaction deleted.");
      setDeleting(null);
      setEditing(null);
      setReload((r) => r + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const { page: _page, sort: _sort, ...exportFilters } = filters;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Transactions</h1>
          <p className="muted">Every income and expense you've recorded.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn--ghost" href={api.exportUrl(exportFilters)} download>
            Export CSV
          </a>
          <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
            Add transaction
          </button>
        </div>
      </header>

      <section className="filters card" aria-label="Filters">
        <div className="segmented segmented--filter" role="group" aria-label="Type">
          {[
            ["", "All"],
            ["expense", "Expenses"],
            ["income", "Income"],
          ].map(([value, label]) => (
            <button key={label} type="button" className="segment" aria-pressed={filters.type === value} onClick={() => update({ type: value, category: "" })}>
              {label}
            </button>
          ))}
        </div>
        <div className="filter-fields">
          <label className="filter-field filter-field--search">
            <span className="sr-only">Search descriptions</span>
            <input type="search" placeholder="Search descriptions" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </label>
          <label className="filter-field">
            <span className="sr-only">Category</span>
            <select value={filters.category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span className="filter-label">From</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="filter-field">
            <span className="filter-label">To</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </label>
          <label className="filter-field">
            <span className="sr-only">Sort</span>
            <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-desc">Largest amount</option>
              <option value="amount-asc">Smallest amount</option>
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setSearchText("");
                setParams({}, { replace: true });
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {error && <ErrorNotice message={error} onRetry={() => setReload((r) => r + 1)} />}
      {!error && !data && <Spinner label="Loading transactions" />}

      {!error && data && (
        <>
          <div className="list-summary" aria-live="polite">
            <span>
              {data.total} transaction{data.total === 1 ? "" : "s"}
            </span>
            {data.totals && (
              <>
                <span className="text-income">In {money(data.totals.income, currency)}</span>
                <span className="text-expense">Out {money(data.totals.expense, currency)}</span>
                <span>Net {money(data.totals.net, currency, { sign: true })}</span>
              </>
            )}
          </div>

          {data.total === 0 ? (
            <div className="card empty">
              <h2>{hasFilters ? "No transactions match these filters" : "No transactions yet"}</h2>
              <p className="muted">{hasFilters ? "Change or clear the filters to see more." : "Add your first income or expense to start tracking."}</p>
              {!hasFilters && (
                <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
                  Add transaction
                </button>
              )}
            </div>
          ) : (
            <div className={`day-groups${loading ? " is-loading" : ""}`}>
              {groups.map(([day, items]) => (
                <section key={day} className="card day-group">
                  <h2 className="day-title">{dayLabel(day)}</h2>
                  <ul className="tx-list">
                    {items.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="tx tx--button" onClick={() => setEditing(t)} aria-label={`Edit ${t.description || t.category}, ${money(t.amount, currency)}`}>
                          <CategoryDot category={t.category} />
                          <span className="tx-main">
                            <span className="tx-title">{t.description || t.category}</span>
                            <span className="tx-sub">
                              {t.category}, {t.paymentMethod}
                            </span>
                          </span>
                          <span className={`tx-amount tx-amount--${t.type}`}>{money(t.type === "income" ? t.amount : -t.amount, currency, { sign: true })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {data.pages > 1 && (
            <nav className="pagination" aria-label="Pages">
              <button type="button" className="btn btn--ghost" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>
                Previous
              </button>
              <span>
                Page {data.page} of {data.pages}
              </span>
              <button type="button" className="btn btn--ghost" disabled={data.page >= data.pages} onClick={() => update({ page: data.page + 1 })}>
                Next
              </button>
            </nav>
          )}
        </>
      )}

      <Modal open={Boolean(editing) && !deleting} onClose={() => setEditing(null)} title={editing === "new" ? "Add a transaction" : "Edit transaction"}>
        <TransactionForm
          key={editing === "new" ? "new" : editing?.id}
          transaction={editing === "new" ? null : editing}
          defaultType={filters.type || "expense"}
          onCancel={() => setEditing(null)}
          onDelete={() => setDeleting(editing)}
          onSaved={() => {
            setEditing(null);
            setReload((r) => r + 1);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this transaction?"
        message={deleting ? `${deleting.description || deleting.category}, ${money(deleting.amount, currency)} on ${dayLabel(deleting.date)}. This can't be undone.` : ""}
        confirmLabel="Delete transaction"
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
