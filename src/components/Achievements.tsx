import { Card } from "@/components/ui";
import type { Achievement } from "@/lib/achievements";

/** The badge shelf: earned in gold, locked in grey with the target
 *  visible — progress you can see is motivation that compounds. */
export default function Achievements({ items }: { items: Achievement[] }) {
  const earned = items.filter((a) => a.earned).length;
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
            Achievements
          </p>
          <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
            {earned} of {items.length} earned
          </h3>
        </div>
        <p className="text-xs text-muted">
          Every badge is something you actually did
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((a) => (
          <div
            key={a.id}
            className={`rounded-2xl border px-3.5 py-3.5 text-center ${
              a.earned
                ? "border-gold/40 bg-gold/[0.07]"
                : "border-white/8 bg-white/[0.02] opacity-55"
            }`}
          >
            <p className="text-xl" aria-hidden>
              {a.icon}
            </p>
            <p
              className={`mt-1.5 text-sm font-extrabold ${
                a.earned ? "text-gold-soft" : "text-bone"
              }`}
            >
              {a.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">
              {a.detail}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
