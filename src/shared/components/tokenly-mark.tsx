type TokenlyMarkProps = Readonly<{
  className?: string;
  compact?: boolean;
}>;

export function TokenlyMark({ className, compact = false }: TokenlyMarkProps) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2.5 ${className ?? ""}`}
    >
      <svg
        aria-hidden="true"
        className="size-10 shrink-0"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M25.4 3.8c8.2.5 15.5 6.4 17.6 14.5 2.4 9.3-2.3 19-11.1 22.9-8.8 3.8-19.1.8-24.4-7.2C2.1 26 3.4 15.2 10.6 8.8c4-3.6 9.3-5.3 14.8-5Z"
          fill="var(--tokenly-brand-pink)"
        />
        <circle
          cx="22.25"
          cy="24.25"
          r="18.25"
          fill="var(--tokenly-brand-blue-strong)"
        />
        <path
          d="M10.2 25.2c5.1-.6 8.2-3.3 9.2-8.1.8 4.8 3.9 7.5 9.2 8.1-5.2.8-8.3 3.5-9.2 8.2-1-4.7-4.1-7.4-9.2-8.2Z"
          fill="white"
        />
        <circle cx="13.2" cy="14.2" r="2.6" fill="white" opacity=".9" />
        <circle cx="30.9" cy="14.8" r="2.2" fill="white" opacity=".86" />
        <circle cx="31.7" cy="32.5" r="2.8" fill="white" opacity=".9" />
        <circle cx="11.4" cy="34.4" r="1.7" fill="white" opacity=".78" />
      </svg>
      {!compact && (
        <span className="truncate text-xl font-bold tracking-[-0.035em] text-ink">
          Tokenly
        </span>
      )}
      <span className="sr-only">Tokenly</span>
    </span>
  );
}
