import { AlertTriangle, CheckCircle2, CircleDashed, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ReleaseStatus } from "@/lib/schemas";

interface StatusPillProps {
  status: ReleaseStatus | "disabled" | "hypothesis" | "not_evaluated";
  label?: string;
  compact?: boolean;
}

const statusStyles = {
  empty: "border-violet-200 bg-violet-50 text-violet-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  disabled: "border-slate-200 bg-slate-100 text-slate-700",
  hypothesis: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  not_evaluated: "border-slate-200 bg-white text-slate-600",
} as const;

const statusLabels = {
  empty: "Empty dataset",
  partial: "Partial release",
  ready: "Reviewed release",
  error: "Release error",
  disabled: "External access off",
  hypothesis: "Provisional hypothesis",
  not_evaluated: "Not evaluated",
} as const;

export function StatusPill({ status, label, compact = false }: StatusPillProps) {
  const Icon =
    status === "ready"
      ? CheckCircle2
      : status === "error" || status === "partial"
        ? AlertTriangle
        : status === "disabled"
          ? LockKeyhole
          : CircleDashed;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border font-semibold",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        statusStyles[status],
      )}
    >
      <Icon aria-hidden="true" className={compact ? "size-3" : "size-3.5"} />
      {label ?? statusLabels[status]}
    </span>
  );
}
