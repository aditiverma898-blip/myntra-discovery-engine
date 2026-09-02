"use client";

import {
  BarChart3,
  BookOpenText,
  BrainCircuit,
  ChartNoAxesCombined,
  Database,
  FlaskConical,
  Heart,
  LayoutDashboard,
  Menu,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import type { DataMode, ReleaseStatus } from "@/lib/schemas";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/opportunities", label: "Opportunities", icon: Sparkles },
  { href: "/segments", label: "Segments", icon: UsersRound },
  { href: "/themes", label: "Themes", icon: ChartNoAxesCombined },
  { href: "/evidence", label: "Evidence", icon: MessageSquareQuote },
  { href: "/copilot", label: "Copilot", icon: BrainCircuit },
] as const;

interface AppShellProps {
  children: ReactNode;
  releaseStatus: ReleaseStatus;
  datasetVersion: string | null;
  dataMode: DataMode;
}

function Brand() {
  return (
    <Link href="/" className="brand-lockup" aria-label="Myntra Discovery Engine home">
      <span className="brand-mark" aria-hidden="true">
        <Heart className="size-4 fill-current" />
      </span>
      <span>
        <span className="block text-sm font-black tracking-tight text-white">
          Myntra Discovery Engine
        </span>
        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Wishlist → purchase insights
        </span>
      </span>
    </Link>
  );
}

function SidebarNavigation({ close }: { close?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="mt-8 flex flex-1 flex-col gap-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={close}
            className={cn("nav-link", active && "nav-link-active")}
          >
            <Icon aria-hidden="true" className="size-[18px]" />
            <span>{label}</span>
            {label === "Copilot" ? (
              <span className="ml-auto rounded-full bg-slate-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-200">
                local
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ dataMode }: { dataMode: DataMode }) {
  const title = dataMode === "fixtures" ? "Demo mode" : dataMode === "provisional" ? "Public-evidence insights" : dataMode === "ready" ? "Reviewed release" : "No data loaded";
  const description = dataMode === "fixtures" ? "Viewing fictional data for demonstration purposes." : dataMode === "provisional" ? "Insights derived from public app-store reviews and community discussions." : dataMode === "ready" ? "Viewing approved and reviewed evidence release." : "Activate a data release to populate analytics.";
  return (
    <div className="mt-8 space-y-3">
      <Link href="/methodology" className="nav-link border border-slate-700/80 bg-slate-800/40">
        <BookOpenText aria-hidden="true" className="size-[18px]" />
        <span>Methodology</span>
      </Link>
      <div className="rounded-2xl border border-slate-700/80 bg-slate-800/70 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
          <ShieldCheck aria-hidden="true" className="size-4" />
          {title}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  datasetVersion,
  dataMode,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sidebar hidden lg:flex">
        <Brand />
        <SidebarNavigation />
        <SidebarFooter dataMode={dataMode} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="sidebar relative flex h-full w-[min(86vw,310px)] shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                className="icon-button-dark"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <SidebarNavigation close={() => setMobileOpen(false)} />
            <SidebarFooter dataMode={dataMode} />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="icon-button lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>
            <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex">
              <FlaskConical aria-hidden="true" className="size-4 text-pink-600" />
              Myntra Discovery Engine
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-slate-500 md:inline">
              Dataset {datasetVersion ?? "unavailable"}
            </span>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="content-shell">
          {children}
        </main>

        <footer className="app-footer">
          <div className="flex items-center gap-2">
            <Database aria-hidden="true" className="size-3.5" />
            <span>{datasetVersion ?? "No valid release"}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link className="font-bold text-slate-600 hover:text-pink-700" href="/methodology">Methodology</Link>
            <span>Signals reflect observed patterns, not population statistics.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
