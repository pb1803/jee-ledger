import { shortDayLabel, type DayPoint } from "@/lib/analytics";

// Lightweight, dependency-free vertical bar chart for daily attempted questions.
// Heights are CSS percentages of a fixed container; labels keep it readable
// without relying on color alone.
export function WeekBars({ series }: { series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((d) => d.attempted));
  return (
    <div
      className="flex items-end gap-1.5"
      style={{ height: 104 }}
      role="img"
      aria-label="Daily attempted questions over the last 7 days"
    >
      {series.map((d) => {
        const pctHeight = Math.round((d.attempted / max) * 100);
        const minH = d.attempted > 0 ? 4 : 0;
        return (
          <div
            key={d.date}
            className="flex flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] tabular-nums text-zinc-500">
              {d.attempted > 0 ? d.attempted : ""}
            </span>
            <div
              className="w-full rounded-t bg-sky-500"
              style={{ height: `${Math.max(pctHeight, minH)}%` }}
            />
            <span className="text-[10px] text-zinc-400">
              {shortDayLabel(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
