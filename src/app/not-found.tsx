import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <section className="surface-card mx-auto max-w-2xl text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-600"><Compass aria-hidden="true" className="size-6" /></span>
      <p className="eyebrow mt-6">404 · Route not found</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">This research view does not exist</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Return to the overview to continue exploring the current release.</p>
      <Link href="/" className="primary-button mt-6"><ArrowLeft aria-hidden="true" className="size-4" />Back to overview</Link>
    </section>
  );
}
