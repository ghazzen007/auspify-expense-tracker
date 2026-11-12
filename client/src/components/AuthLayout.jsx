import BalanceBeam from "./BalanceBeam.jsx";
import { Logo } from "./ui.jsx";

/** Two-column sign-in layout: the form on one side, the brand idea on the other */
export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <main className="auth-main">
        <Logo />
        <div className="auth-card">{children}</div>
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside-inner">
          <p className="auth-quote">Mizan is Arabic for balance. Put what comes in and what goes out on the scales, and see where you stand every month.</p>
          <div className="auth-beam">
            <BalanceBeam income={1850} expense={1312} currency="TND" />
          </div>
        </div>
      </aside>
    </div>
  );
}
