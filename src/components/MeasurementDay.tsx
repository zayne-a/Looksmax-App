import Link from "next/link";
import { Card } from "@/components/ui";
import type { SavedScan } from "@/lib/account";

/**
 * Measurement Day: the monthly re-scan ritual. Progress scans are how
 * phases get earned and how the coach's advice stays honest — this
 * card keeps the cadence and reports the delta like it matters.
 */
export default function MeasurementDay({
  scans,
  todayKey,
}: {
  scans: SavedScan[];
  todayKey: string | null;
}) {
  if (!todayKey || scans.length === 0) return null;
  const latest = scans[0];
  const previous = scans[1];
  const lastDate = new Date(latest.created_at);
  const daysSince = Math.max(
    0,
    Math.floor(
      (new Date(`${todayKey}T12:00:00`).getTime() - lastDate.getTime()) / 86400_000
    )
  );
  const due = daysSince >= 28;
  const nextIn = Math.max(0, 28 - daysSince);
  const delta =
    latest.overall_score != null && previous?.overall_score != null
      ? latest.overall_score - previous.overall_score
      : null;
  const gapDays = previous
    ? Math.max(
        1,
        Math.round(
          (lastDate.getTime() - new Date(previous.created_at).getTime()) / 86400_000
        )
      )
    : null;

  return (
    <Card glow={due}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Measurement day
          </p>
          <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
            {due
              ? "It's been 4 weeks — time to re-measure"
              : `Next measurement in ${nextIn} day${nextIn === 1 ? "" : "s"}`}
          </h3>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
            {due
              ? `Your last scan was ${daysSince} days ago. A progress scan re-measures everything, updates your score journey, and gives your next phase real data to build from.`
              : `Last scan ${daysSince} day${daysSince === 1 ? "" : "s"} ago. Monthly re-scans keep the journey honest — daily mirror checks lie, measurements don't.`}
          </p>
          {delta !== null && gapDays !== null && (
            <p className="mt-2 text-sm font-semibold text-bone">
              Last interval:{" "}
              <span className={delta >= 0 ? "text-gold-soft" : "text-red-300"}>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)} points
              </span>{" "}
              <span className="font-normal text-muted">
                over {gapDays} days ({previous?.overall_score?.toFixed(0)} →{" "}
                {latest.overall_score?.toFixed(0)})
              </span>
            </p>
          )}
        </div>
        {due && (
          <Link
            href="/scan"
            className="shrink-0 rounded-full bg-gold px-7 py-3 text-sm font-extrabold text-ink transition hover:brightness-110"
          >
            Take progress scan
          </Link>
        )}
      </div>
    </Card>
  );
}
