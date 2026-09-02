export default function Loading() {
  return (
    <div aria-label="Loading page" role="status" className="animate-pulse">
      <div className="h-3 w-32 rounded bg-slate-200" />
      <div className="mt-4 h-10 max-w-xl rounded-lg bg-slate-200" />
      <div className="mt-3 h-4 max-w-3xl rounded bg-slate-200" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <span className="sr-only">Loading dashboard content</span>
    </div>
  );
}
