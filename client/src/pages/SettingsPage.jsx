import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useMeta } from "../hooks/useMeta.jsx";
import { useToast } from "../components/Toast.jsx";
import { ConfirmDialog, Field } from "../components/ui.jsx";

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const meta = useMeta();
  const toast = useToast();

  const [profile, setProfile] = useState({ name: user.name, currency: user.currency });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      const data = await api.updateProfile(profile);
      setUser(data.user);
      toast("Profile saved.");
    } catch (err) {
      setProfileErrors(err.errors || {});
      toast(err.message, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordErrors({});
    try {
      await api.changePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      toast("Password updated.");
    } catch (err) {
      setPasswordErrors(err.errors || {});
      toast(err.message, "error");
    } finally {
      setSavingPassword(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.deleteAccount();
      toast("Your account was deleted.");
      await logout();
    } catch (err) {
      toast(err.message, "error");
      setDeleting(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your profile, currency and password.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="settings">
        <form className="card settings-card" onSubmit={saveProfile} noValidate>
          <h2 className="card-title">Profile</h2>
          <Field id="s-name" label="Name" error={profileErrors.name}>
            <input id="s-name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} autoComplete="name" />
          </Field>
          <Field id="s-email" label="Email" hint="Your sign-in email can't be changed.">
            <input id="s-email" value={user.email} disabled />
          </Field>
          <Field id="s-currency" label="Currency" error={profileErrors.currency} hint="Used to display every amount in the app.">
            <select id="s-currency" value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}>
              {meta.currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div>
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        <form className="card settings-card" onSubmit={savePassword} noValidate>
          <h2 className="card-title">Password</h2>
          <Field id="s-current" label="Current password" error={passwordErrors.currentPassword}>
            <input
              id="s-current"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
            />
          </Field>
          <Field id="s-new" label="New password" error={passwordErrors.newPassword} hint="At least 8 characters, with a letter and a number.">
            <input id="s-new" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))} />
          </Field>
          <div>
            <button type="submit" className="btn btn--primary" disabled={savingPassword || !passwords.currentPassword || !passwords.newPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>

        <section className="card settings-card settings-danger">
          <h2 className="card-title">Delete account</h2>
          <p className="muted">This removes your account, every transaction and every budget. It can't be undone.</p>
          <div>
            <button type="button" className="btn btn--ghost-danger" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        message="All your transactions and budgets will be erased permanently."
        confirmLabel="Delete everything"
        cancelLabel="Keep my account"
        busy={deleting}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
