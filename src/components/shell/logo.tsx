export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-label="Órbita">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2.6" opacity="0.9" />
      <ellipse cx="16" cy="16" rx="14.5" ry="5.5" transform="rotate(-28 16 16)" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
      <circle cx="16" cy="16" r="3.6" fill="currentColor" />
      <circle cx="27.4" cy="10" r="2.4" fill="var(--accent)" />
    </svg>
  );
}
