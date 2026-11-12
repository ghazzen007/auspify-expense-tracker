import { useState } from "react";
import { api } from "../lib/api.js";
import { todayISO } from "../lib/format.js";
import { useMeta } from "../hooks/useMeta.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { useToast } from "./Toast.jsx";
import { Field } from "./ui.jsx";

/**
 * Add or edit a transaction. Used inside a Modal on the dashboard and the
 * transactions page. Calls onSaved(transaction) after a successful save.
 */
export default function TransactionForm({ transaction, defaultType = "expense", onSaved, onCancel, onDelete }) {
  const meta = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = Boolean(transaction);

  const [values, setValues] = useState(() =>
    transaction
      ? {
          type: transaction.type,
          amount: String(transaction.amount),
          category: transaction.category,
          date: transaction.date.slice(0, 10),
          description: transaction.description || "",
          paymentMethod: transaction.paymentMethod,
        }
      : { type: defaultType, amount: "", category: "", date: todayISO(), description: "", paymentMethod: "Card" }
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const categories = values.type === "income" ? meta.incomeCategories : meta.expenseCategories;

  const set = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const switchType = (type) => {
    // A category from the other list makes no sense, so clear it
    setValues((v) => ({ ...v, type, category: "" }));
    setErrors({});
  };

  function validate() {
    const found = {};
    const amount = Number(values.amount);
    if (!values.amount || Number.isNaN(amount) || amount <= 0) found.amount = "Enter an amount greater than zero.";
    if (!values.category) found.category = "Choose a category.";
    if (!values.date) found.date = "Choose a date.";
    if (values.description.length > 120) found.description = "Keep the description under 120 characters.";
    return found;
  }

  async function submit(event) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    const payload = { ...values, amount: Number(values.amount) };
    try {
      const saved = isEdit ? await api.updateTransaction(transaction.id, payload) : await api.createTransaction(payload);
      toast(isEdit ? "Transaction updated." : values.type === "income" ? "Income added." : "Expense added.");
      onSaved(saved);
    } catch (err) {
      setErrors(err.errors || {});
      toast(err.message, "error");
      setSaving(false);
    }
  }

  return (
    <form className="tx-form" onSubmit={submit} noValidate>
      <div className="segmented" role="radiogroup" aria-label="Transaction type">
        {["expense", "income"].map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={values.type === type}
            className={`segment segment--${type}`}
            onClick={() => switchType(type)}
          >
            {type === "expense" ? "Expense" : "Income"}
          </button>
        ))}
      </div>

      <Field id="tx-amount" label={`Amount (${user.currency})`} error={errors.amount}>
        <input
          id="tx-amount"
          className="amount-input"
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          placeholder="0.00"
          value={values.amount}
          onChange={set("amount")}
          aria-invalid={Boolean(errors.amount)}
          autoFocus
        />
      </Field>

      <div className="form-grid">
        <Field id="tx-category" label="Category" error={errors.category}>
          <select id="tx-category" value={values.category} onChange={set("category")} aria-invalid={Boolean(errors.category)}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field id="tx-date" label="Date" error={errors.date}>
          <input id="tx-date" type="date" value={values.date} onChange={set("date")} aria-invalid={Boolean(errors.date)} />
        </Field>
        <Field id="tx-description" label="Description" error={errors.description} hint="Optional, e.g. “Weekly market”">
          <input id="tx-description" value={values.description} onChange={set("description")} maxLength={120} />
        </Field>
        <Field id="tx-method" label="Paid with" error={errors.paymentMethod}>
          <select id="tx-method" value={values.paymentMethod} onChange={set("paymentMethod")}>
            {meta.paymentMethods.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="modal-actions">
        {isEdit && onDelete && (
          <button type="button" className="btn btn--ghost-danger mr-auto" onClick={onDelete} disabled={saving}>
            Delete
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : values.type === "income" ? "Add income" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
