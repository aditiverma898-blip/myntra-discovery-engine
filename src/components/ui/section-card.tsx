import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface SectionCardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}

export function SectionCard({
  children,
  title,
  description,
  className,
  action,
}: SectionCardProps) {
  return (
    <section className={cn("surface-card", className)}>
      {title || description || action ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="section-title">{title}</h2> : null}
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
