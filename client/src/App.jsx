import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.jsx";
import AppLayout from "./components/AppLayout.jsx";
import { Spinner } from "./components/ui.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// Pages behind sign-in are loaded on demand, so the sign-in screen stays small
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const BudgetsPage = lazy(() => import("./pages/BudgetsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));

function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Spinner label="Checking your session" full />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Suspense fallback={<Spinner label="Loading" full />}>{children}</Suspense>;
}

function GuestOnly({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Spinner label="Checking your session" full />;
  // Once signed in, go back to the page the person originally asked for
  if (user) return <Navigate to={location.state?.from || "/"} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
