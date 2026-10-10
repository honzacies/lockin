/** Logo LockIn — kopie Brand/logo.svg (timer, odškrtnutý seznam, tečka = teď). */
export function LockInLogo({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 110 110" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label="LockIn">
      <rect width="110" height="110" rx="24" fill="#0088ff" />
      <circle cx="55" cy="55" r="34" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="8" />
      <path d="M55 21A34 34 0 1 1 21 55" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <circle cx="21" cy="55" r="8" fill="#fff" />
      <path d="M38 43L42 47L49 39M55 43H73M38 56H73M38 69H62" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
