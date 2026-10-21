"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { AscendPlan, QuizAnswers } from "@/lib/types";

interface ShelfItem {
  id: string;
  name: string;
  opened: string; // day key
  paoMonths: number;
}

const STORAGE_KEY = "ascend_shelf";

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * My Shelf: the products in the subscriber's routine, with opened
 * dates and PAO (period-after-opening) replacement timing. No product
 * database — their shelf is typed by them and seeded with quick-adds
 * from their own plan. Lives on this device, like the photo timeline.
 */
export default function MyShelf({
  plan,
  quiz,
  todayKey,
}: {
  plan: AscendPlan | null;
  quiz: QuizAnswers | null;
  todayKey: string | null;
}) {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [name, setName] = useState("");
  const [pao, setPao] = useState(12);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as ShelfItem[]);
    } catch {
      /* start empty */
    }
  }, []);

  const persist = (next: ShelfItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* device storage full — shelf keeps working for this session */
    }
  };

  const add = (n: string, months: number) => {
    if (!n.trim() || !todayKey) return;
    persist([
      { id: `${Date.now()}`, name: n.trim(), opened: todayKey, paoMonths: months },
      ...items,
    ]);
    setName("");
  };

  const suggestions: string[] = [];
  if (quiz?.skinType === "oily") suggestions.push("Gel cleanser");
  else if (quiz?.skinType === "dry") suggestions.push("Cream cleanser");
  else suggestions.push("Gentle cleanser");
  suggestions.push("SPF 50 sunscreen", "Moisturiser");
  const skinTasks =
    plan?.sections.find((s) => s.id === "skin")?.weeks[0]?.tasks ?? [];
  for (const t of skinTasks.filter((t) => !t.locked).slice(0, 2)) {
    if (!suggestions.includes(t.title)) suggestions.push(t.title);
  }

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
        My shelf
      </p>
      <h3 className="font-display mt-1.5 text-2xl font-extrabold text-bone">
        What&apos;s in your routine — and when it expires
      </h3>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
        Expired actives quietly stop working — a dead serum looks exactly
        like a live one. Track opened dates here; the PAO number is the
        little open-jar symbol on the bottle. Stored on this device only.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions
          .filter((s) => !items.some((i) => i.name === s))
          .map((s) => (
            <button
              key={s}
              onClick={() => add(s, 12)}
              className="rounded-full border border-gold/30 bg-gold/[0.06] px-3.5 py-1.5 text-xs font-semibold text-gold-soft transition hover:bg-gold/15"
            >
              + {s} · from your plan
            </button>
          ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name — e.g. Vitamin C serum"
          className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-muted/60"
        />
        <select
          value={pao}
          onChange={(e) => setPao(Number(e.target.value))}
          className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-bone"
          aria-label="Months after opening"
        >
          {[3, 6, 9, 12, 24].map((m) => (
            <option key={m} value={m} className="bg-ink">
              {m}M PAO
            </option>
          ))}
        </select>
        <Button
          onClick={() => add(name, pao)}
          variant="ghost"
          className="px-5 py-2.5 text-sm"
        >
          Add — opened today
        </Button>
      </div>

      {items.length > 0 && (
        <ul className="mt-5 space-y-2.5">
          {items.map((item) => {
            const replaceBy = addMonths(item.opened, item.paoMonths);
            const state = !todayKey
              ? "ok"
              : replaceBy < todayKey
                ? "expired"
                : replaceBy <= addMonths(todayKey, 1)
                  ? "soon"
                  : "ok";
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-bone">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Opened {item.opened} · {item.paoMonths}M PAO · replace by{" "}
                    {replaceBy}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {state === "expired" && (
                    <span className="rounded-full border border-red-300/40 bg-red-300/10 px-3 py-1 text-[11px] font-bold text-red-300">
                      Expired — replace it
                    </span>
                  )}
                  {state === "soon" && (
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold-soft">
                      Replace within a month
                    </span>
                  )}
                  {state === "ok" && (
                    <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-semibold text-muted">
                      In date
                    </span>
                  )}
                  <button
                    onClick={() => persist(items.filter((i) => i.id !== item.id))}
                    className="text-xs font-semibold text-muted transition hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
