import type { ReactNode } from 'react';
import { naira } from '../lib/naira';

/** The host's app header: a back chevron and the app name, wallet on the right. */
export function Header({ onBack, wallet }: { onBack?: () => void; wallet?: number }) {
  return (
    <header className="header">
      {onBack ? (
        <button type="button" className="header-back" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
      ) : (
        <span className="header-spacer" aria-hidden="true" />
      )}
      <span className="header-title">Fixam</span>
      {wallet !== undefined && (
        <span className="header-wallet naira" aria-label={`Wallet ${naira(wallet)}`}>
          {naira(wallet)}
        </span>
      )}
    </header>
  );
}

export function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg className="chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Tick() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The one big filled action, pinned to the bottom of the screen. */
export function CtaBar({ children }: { children: ReactNode }) {
  return <div className="cta-bar">{children}</div>;
}

export function Naira({ amount }: { amount: number }) {
  return <span className="naira">{naira(amount)}</span>;
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="alert">
      {children}
    </div>
  );
}
