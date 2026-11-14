interface ProgressRingProps {
  /** 0 to 100 */
  percent: number;
  label: string;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ProgressRing({ percent, label }: ProgressRingProps) {
  const safe = Math.min(100, Math.max(0, Math.round(percent)));
  const offset = CIRCUMFERENCE * (1 - safe / 100);

  return (
    <div
      role="img"
      aria-label={`${label}: ${safe}% complete`}
      className="relative h-12 w-12 shrink-0"
    >
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="stroke-brand-600 dark:stroke-brand-400"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200"
      >
        {safe}%
      </span>
    </div>
  );
}
