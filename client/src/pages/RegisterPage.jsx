import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useMeta } from "../hooks/useMeta.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import { Field } from "../components/ui.jsx";

function validate(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (values.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password)) errors.password = "Include at least one letter and one number.";
  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", password: "", currency: "TND" });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  async function submit(event) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setAlert("");
    try {
      await register(values);
      navigate("/", { replace: true });
    } catch (err) {
      setErrors(err.errors || {});
      if (!err.errors) setAlert(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Create your account</h1>
      <p className="muted">It takes a minute. Your data stays private to your account.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {alert && (
          <p className="form-alert" role="alert">
            {alert}
          </p>
        )}
        <Field id="name" label="Name" error={errors.name}>
          <input id="name" autoComplete="name" value={values.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} autoFocus />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field id="password" label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          <input id="password" type="password" autoComplete="new-password" value={values.password} onChange={set("password")} aria-invalid={Boolean(errors.password)} />
        </Field>
        <Field id="currency" label="Currency">
          <select id="currency" value={values.currency} onChange={set("currency")}>
            {meta.currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
