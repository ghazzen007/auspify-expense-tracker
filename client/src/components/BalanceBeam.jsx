import { money } from "../lib/format.js";

/**
 * "Mizan" means balance, or scales, in Arabic. This draws the month as a
 * pair of scales: income on the left pan, spending on the right. The beam
 * tips towards whichever side is heavier.
 */
export default function BalanceBeam({ income, expense, currency }) {
  const heaviest = Math.max(income, expense, 1);
  // Up to 14 degrees of tilt; positive = right side (spending) heavier
  const tilt = Math.max(-14, Math.min(14, ((expense - income) / heaviest) * 14));
  const rad = (tilt * Math.PI) / 180;
  const arm = 150;
  const leftY = -Math.sin(rad) * arm;
  const rightY = Math.sin(rad) * arm;

  const verdict =
    income === 0 && expense === 0
      ? "Nothing recorded for this month yet."
      : expense > income
        ? `You spent ${money(expense - income, currency)} more than you earned.`
        : `You kept ${money(income - expense, currency)} of what you earned.`;

  return (
    <figure className="beam">
      <svg viewBox="0 18 400 196" role="img" aria-label={`Income ${money(income, currency)}, spending ${money(expense, currency)}. ${verdict}`}>
        {/* Stand */}
        <path d="M200 64 V200" className="beam-post" />
        <path d="M150 206 H250" className="beam-base" />
        {/* Beam (rotates around the pivot) */}
        <g className="beam-arm" style={{ transform: `rotate(${tilt}deg)` }}>
          <path d="M50 64 H350" className="beam-bar" />
        </g>
        {/* Pans hang straight down from the beam ends */}
        <g className="beam-pan" style={{ transform: `translate(0px, ${leftY}px)` }}>
          <path d="M50 64 L22 132 M50 64 L78 132" className="beam-string" />
          <path d="M12 132 H88 Q84 152 50 152 Q16 152 12 132 Z" className="beam-dish beam-dish--income" />
        </g>
        <g className="beam-pan" style={{ transform: `translate(0px, ${rightY}px)` }}>
          <path d="M350 64 L322 132 M350 64 L378 132" className="beam-string" />
          <path d="M312 132 H388 Q384 152 350 152 Q316 152 312 132 Z" className="beam-dish beam-dish--expense" />
        </g>
        <circle cx="200" cy="64" r="9" className="beam-pivot" />
      </svg>
      <div className="beam-labels">
        <div className="beam-side beam-side--income">
          <span>Income</span>
          <strong>{money(income, currency)}</strong>
        </div>
        <div className="beam-side beam-side--expense">
          <span>Spending</span>
          <strong>{money(expense, currency)}</strong>
        </div>
      </div>
      <figcaption className="beam-verdict">{verdict}</figcaption>
    </figure>
  );
}
