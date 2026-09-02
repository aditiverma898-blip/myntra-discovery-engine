import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number | null;
  helper: string;
  icon: LucideIcon;
  accent: "pink" | "violet" | "orange" | "blue";
}

const accentClasses = {
  pink: "bg-pink-50 text-pink-700",
  violet: "bg-violet-50 text-violet-700",
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-sky-50 text-sky-700",
};

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${accentClasses[accent]}`}>
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <p className="mt-5 text-sm font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)]">
        {value === null ? "Not collected" : value.toLocaleString("en-IN")}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}
