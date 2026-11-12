import { useEffect, useRef } from "react";
import { categoryColor } from "../lib/format.js";

export function Logo({ light = false }) {
  return (
    <span className={`logo${light ? " logo--light" : ""}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill={light ? "#ffffff" : "#161a33"} />
        <path d="M32 14v34M14 24h36" stroke="#c9a227" strokeWidth="4" strokeLinecap="round" />
        <path d="M14 24 8 38h12zM50 24l-6 14h12z" fill={light ? "#161a33" : "#ffffff"} />
        <path d="M24 48h16" stroke="#c9a227" strokeWidth="4" strokeLinecap="round" />
      </svg>
      Mizan
    </span>
  );
}

export function Spinner({ label = "Loading", full = false }) {
  return (
    <div className={`spinner-wrap${full ? " spinner-wrap--full" : ""}`} role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }) {
  return (
    <div className="notice notice--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function CategoryDot({ category }) {
  return <span className="cat-dot" style={{ background: categoryColor(category) }} aria-hidden="true" />;
}

/** Native <dialog> wrapper: focus trapping, Escape and backdrop for free */
export function Modal({ open, onClose, title, children, busy = false, size = "md" }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it
        if (event.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = "Cancel", busy, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} busy={busy} size="sm">
      <p className="muted">{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ id, label, error, hint, children, className = "" }) {
  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
