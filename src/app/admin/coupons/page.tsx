"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import AdminGate from "@/components/admin/AdminGate";

/**
 * /admin/coupons — owner-managed discount codes (2026-10-24,
 * Zayne). Create a code, choose its % off, switch it on/off,
 * re-price it, or delete it. The same console exists in the phone
 * app (/admin-coupons); both ride /api/admin/coupons.
 *
 * Codes apply to MONTHLY and YEARLY plans only — never Weekly.
 * Payments are parked, so a code's effect today is validated +
 * priced truthfully at the paywalls; checkout consumes the applied
 * code when payments launch.
 */

interface Coupon {
  code: string;
  percent_off: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-gold";
const inputCls =
  "w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-bone outline-none focus:border-gold";

function CouponsConsole({ token }: { token: string }) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/coupons", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus("Could not load coupons.");
        return;
      }
      const json = (await res.json()) as { coupons: Coupon[] };
      setCoupons(json.coupons ?? []);
    } catch {
      setStatus("Could not load coupons.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const call = useCallback(
    async (method: string, body: Record<string, unknown>) => {
      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch("/api/admin/coupons", {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as {
          coupons?: Coupon[];
          error?: string;
        };
        if (!res.ok) {
          setStatus(json.error ?? "Something went wrong.");
          return false;
        }
        if (json.coupons) setCoupons(json.coupons);
        return true;
      } catch {
        setStatus("Network error — try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token]
  );

  const create = async () => {
    const ok = await call("POST", {
      code: code.trim().toUpperCase(),
      percent_off: Number(percent),
    });
    if (ok) {
      setCode("");
      setStatus("Coupon created — it's live at the paywalls now.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-bone">
        ← Admin
      </Link>
      <div className="mt-4">
        <Eyebrow>Admin</Eyebrow>
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-bone">
        Coupons
      </h1>
      <p className="mt-2 text-sm text-muted">
        Discount codes for the paywalls. A code takes its % off the
        Monthly and Yearly plans — codes never apply to Weekly.
      </p>

      {status ? (
        <p className="mt-4 rounded-lg border border-line bg-ink px-3 py-2 text-sm text-bone">
          {status}
        </p>
      ) : null}

      <Card className="mt-6">
        <p className={labelCls}>New coupon</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={inputCls}
            placeholder="CODE (e.g. CREATOR20)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={24}
          />
          <div className="flex items-center gap-2">
            <input
              className={`${inputCls} w-24`}
              type="number"
              min={1}
              max={90}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <span className="text-sm text-muted">% off</span>
          </div>
          <Button onClick={() => void create()} disabled={busy || !code.trim()}>
            Create
          </Button>
        </div>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {coupons === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-muted">
            No coupons yet. Create the first one above.
          </p>
        ) : (
          coupons.map((c) => (
            <Card key={c.code} className="!p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-lg font-extrabold tracking-wide text-bone">
                  {c.code}
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-gold">
                  {c.percent_off}% off
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    c.active
                      ? "bg-mint/15 text-mint"
                      : "bg-white/5 text-muted"
                  }`}
                >
                  {c.active ? "Active" : "Off"}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void call("PATCH", { code: c.code, active: !c.active })
                    }
                  >
                    {c.active ? "Switch off" : "Switch on"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      const next = window.prompt(
                        `New % off for ${c.code} (1–90):`,
                        String(c.percent_off)
                      );
                      if (next === null) return;
                      void call("PATCH", {
                        code: c.code,
                        percent_off: Number(next),
                      });
                    }}
                  >
                    Re-price
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Delete ${c.code} for good?`)) return;
                      void call("DELETE", { code: c.code });
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Monthly + Yearly only · created{" "}
                {new Date(c.created_at).toLocaleString("en-IN")}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function CouponsPage() {
  return (
    <AdminGate>{(token) => <CouponsConsole token={token} />}</AdminGate>
  );
}
