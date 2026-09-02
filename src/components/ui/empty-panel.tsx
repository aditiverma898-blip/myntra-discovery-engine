import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyPanelProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  detail?: string;
}

export function EmptyPanel({
  title,
  description,
  icon: Icon = Inbox,
  detail,
}: EmptyPanelProps) {
  return (
    <div className="empty-panel" role="status">
      <div className="empty-icon">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-bold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
      {detail ? (
        <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
