import Link from "next/link";

export const SOURCE_COLORS: Record<string, string> = {
  google_play: "#16a34a",
  app_store: "#2563eb",
  youtube: "#dc2626",
  reddit: "#f97316",
};

export const RELEVANCE_COLORS: Record<string, string> = {
  direct_wishlist: "#d9164d",
  journey_adjacent: "#8b5cf6",
  general: "#94a3b8",
  irrelevant: "#e2e8f0",
};

export function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

interface BarDatum {
  key: string;
  label: string;
  value: number;
  helper?: string;
  href?: string;
  color?: string;
}

export function HorizontalBarChart({
  data,
  valueLabel = "evidence units",
}: {
  data: readonly BarDatum[];
  valueLabel?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="space-y-4" role="list" aria-label={`${valueLabel} by category`}>
      {data.map((item) => {
        const content = (
          <>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">{item.label}</p>
                {item.helper ? <p className="mt-0.5 text-[11px] text-slate-500">{item.helper}</p> : null}
              </div>
              <p className="shrink-0 text-sm font-black tabular-nums text-slate-950">{formatNumber(item.value)}</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%`, background: item.color ?? "linear-gradient(90deg,#d9164d,#ff6f91)" }}
              />
            </div>
          </>
        );

        return item.href ? (
          <Link key={item.key} href={item.href} className="chart-row block rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-pink-500" role="listitem" aria-label={`${item.label}: ${formatNumber(item.value)} ${valueLabel}`}>
            {content}
          </Link>
        ) : <div key={item.key} role="listitem" aria-label={`${item.label}: ${formatNumber(item.value)} ${valueLabel}`}>{content}</div>;
      })}
    </div>
  );
}

interface SegmentDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
  href?: string;
}

export function SegmentedBar({ data, denominator }: { data: readonly SegmentDatum[]; denominator: number }) {
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {data.map((item) => (
          <div key={item.key} style={{ width: `${denominator ? item.value / denominator * 100 : 0}%`, backgroundColor: item.color ?? RELEVANCE_COLORS[item.key] ?? "#94a3b8" }} />
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {data.map((item) => {
          const body = <><span className="size-2 rounded-full" style={{ backgroundColor: item.color ?? RELEVANCE_COLORS[item.key] ?? "#94a3b8" }} /><span className="font-semibold text-slate-700">{item.label}</span><span className="ml-auto font-black tabular-nums text-slate-950">{formatNumber(item.value)} <span className="font-medium text-slate-400">· {denominator ? (item.value / denominator * 100).toFixed(1) : "0.0"}%</span></span></>;
          return item.href ? <Link key={item.key} href={item.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">{body}</Link> : <div key={item.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">{body}</div>;
        })}
      </div>
      <p className="sr-only">{data.map((item) => `${item.label}: ${item.value} of ${denominator}`).join(". ")}</p>
    </div>
  );
}

export function StackedSourceBars({
  rows,
  percentage = false,
}: {
  rows: readonly { source: string; total: number; values: readonly { key: string; value: number; href?: string }[] }[];
  percentage?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  const keys = [...new Set(rows.flatMap((row) => row.values.map((value) => value.key)))];
  return (
    <div>
      <div className="space-y-4">{rows.map((row) => (
        <div key={row.source}>
          <div className="mb-1.5 flex justify-between text-xs"><span className="font-bold text-slate-700">{titleCase(row.source)}</span><span className="tabular-nums text-slate-500">{formatNumber(row.total)}</span></div>
          <div className="flex h-5 overflow-hidden rounded-md bg-slate-100" style={{ width: percentage ? "100%" : `${Math.max(10, row.total / max * 100)}%` }}>
            {row.values.map((value) => { const style = { width: `${row.total ? value.value / row.total * 100 : 0}%`, backgroundColor: RELEVANCE_COLORS[value.key] ?? "#cbd5e1" }; return value.href ? <Link key={value.key} href={value.href} aria-label={`${titleCase(row.source)}, ${titleCase(value.key)}: ${value.value} evidence units`} title={`${titleCase(value.key)}: ${value.value}`} style={style} className="block focus-visible:outline-2 focus-visible:outline-white" /> : <div key={value.key} title={`${titleCase(value.key)}: ${value.value}`} style={style} />; })}
          </div>
        </div>
      ))}</div>
      <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-bold text-slate-500">{keys.map((key) => <span key={key} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ backgroundColor: RELEVANCE_COLORS[key] ?? "#cbd5e1" }} />{titleCase(key)}</span>)}</div>
    </div>
  );
}

export function CoverageChart({
  points,
  hrefForPoint,
}: {
  points: readonly { period: string; values: Record<string, number> }[];
  hrefForPoint?: (period: string, source: string) => string;
}) {
  const sources = Object.keys(points[0]?.values ?? {});
  const totals = points.map((point) => Object.values(point.values).reduce((sum, value) => sum + value, 0));
  const max = Math.max(1, ...totals);
  return (
    <div>
      <div className="flex h-52 items-end gap-1.5 border-b border-l border-slate-200 px-2 pt-4" aria-hidden="true">
        {points.map((point, index) => {
          const total = totals[index] ?? 0;
          return <div key={point.period} className="group relative flex min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${Math.max(3, total / max * 100)}%` }} title={`${point.period}: ${formatNumber(total)}`}>
            {sources.map((source) => { const style = { height: `${total ? (point.values[source] ?? 0) / total * 100 : 0}%`, backgroundColor: SOURCE_COLORS[source] ?? "#94a3b8" }; const href = hrefForPoint?.(point.period, source); return href ? <Link key={source} href={href} style={style} className="block min-h-px focus-visible:outline-2 focus-visible:outline-white" aria-label={`${point.period}, ${titleCase(source)}: ${point.values[source] ?? 0} evidence units`} /> : <div key={source} style={style} />; })}
          </div>;
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400"><span>{points[0]?.period ?? ""}</span><span>{points.at(-1)?.period ?? ""}</span></div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold text-slate-500">{sources.map((source) => <span key={source} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ backgroundColor: SOURCE_COLORS[source] ?? "#94a3b8" }} />{titleCase(source)}</span>)}</div>
      <table className="sr-only"><caption>Monthly collection coverage by source</caption><thead><tr><th>Month</th>{sources.map((source) => <th key={source}>{titleCase(source)}</th>)}</tr></thead><tbody>{points.map((point) => <tr key={point.period}><th>{point.period}</th>{sources.map((source) => <td key={source}>{point.values[source] ?? 0}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

export function RatingBars({ distributions }: { distributions: readonly { source: string; ratings: readonly { rating: number; count: number; href?: string }[] }[] }) {
  const max = Math.max(1, ...distributions.flatMap((distribution) => distribution.ratings.map((rating) => rating.count)));
  return <div className="grid gap-6 sm:grid-cols-2">{distributions.map((distribution) => <div key={distribution.source}><p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">{titleCase(distribution.source)}</p><div className="space-y-2">{[5,4,3,2,1].map((rating) => { const datum = distribution.ratings.find((item) => item.rating === rating); const count = datum?.count ?? 0; const body = <><span className="font-bold">{rating}★</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${count / max * 100}%` }} /></div><span className="text-right tabular-nums text-slate-500">{formatNumber(count)}</span></>; return datum?.href ? <Link key={rating} href={datum.href} className="grid grid-cols-[2rem_1fr_3rem] items-center gap-2 rounded text-xs focus-visible:ring-2 focus-visible:ring-pink-500">{body}</Link> : <div key={rating} className="grid grid-cols-[2rem_1fr_3rem] items-center gap-2 text-xs">{body}</div>})}</div></div>)}</div>;
}

export function Heatmap({ rows, columns, values, hrefForCell }: { rows: readonly string[]; columns: readonly string[]; values: Record<string, number>; hrefForCell?: (row: string, column: string) => string }) {
  const max = Math.max(1, ...Object.values(values));
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs"><caption className="sr-only">Journey stage by candidate barrier evidence counts</caption><thead><tr><th /><>{columns.map((column) => <th key={column} className="px-2 py-2 text-left text-[10px] font-bold text-slate-500">{titleCase(column)}</th>)}</></tr></thead><tbody>{rows.map((row) => <tr key={row}><th className="pr-2 text-left font-bold text-slate-700">{titleCase(row)}</th>{columns.map((column) => { const value = values[`${row}:${column}`] ?? 0; const opacity = value ? 0.12 + value / max * 0.78 : 0.03; const body = value || "–"; return <td key={column} className="h-10 rounded-md p-0 text-center font-bold tabular-nums" style={{ backgroundColor: `rgb(217 22 77 / ${opacity})`, color: opacity > 0.5 ? "white" : "#475569" }} title={`${titleCase(row)}, ${titleCase(column)}: ${value}`}>{value && hrefForCell ? <Link href={hrefForCell(row, column)} className="grid h-10 place-items-center rounded-md focus-visible:ring-2 focus-visible:ring-pink-500">{body}</Link> : body}</td>})}</tr>)}</tbody></table></div>;
}
