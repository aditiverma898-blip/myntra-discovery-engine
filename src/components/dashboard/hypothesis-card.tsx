import { ArrowUpRight } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";

interface HypothesisCardProps {
  name: string;
  description: string;
  index: number;
}

export function HypothesisCard({
  name,
  description,
  index,
}: HypothesisCardProps) {
  return (
    <article className="hypothesis-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold tabular-nums text-pink-600">
          H{String(index + 1).padStart(2, "0")}
        </span>
        <ArrowUpRight aria-hidden="true" className="size-4 text-slate-300" />
      </div>
      <h3 className="mt-5 text-lg font-bold tracking-tight text-[var(--ink)]">
        {name}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-5">
        <StatusPill status="hypothesis" compact />
      </div>
    </article>
  );
}
