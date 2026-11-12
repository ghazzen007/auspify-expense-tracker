import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import { Field } from "../components/ui.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!values.email || !values.password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(values);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <AuthLayout>
      <h1>Sign in</h1>
      <p className="muted">Welcome back. Pick up where you left off.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <Field id="email" label="Email">
          <input id="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} autoFocus />
        </Field>
        <Field id="password" label="Password">
          <input id="password" type="password" autoComplete="current-password" value={values.password} onChange={set("password")} />
        </Field>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        New to Mizan? <Link to="/register">Create an account</Link>
      </p>
      <p className="demo-hint">
        Trying it out? Use <strong>demo@mizan.app</strong> with password <strong>Demo1234</strong>.
      </p>
    </AuthLayout>
  );
}
