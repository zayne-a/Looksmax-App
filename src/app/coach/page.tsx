// The coach page no longer writes chat rows for API conversations — /api/coach persists both sides server-side (that is what makes its daily cap enforceable). The daily-questions summary message is still client-saved: it never passes through the API.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useApp } from "@/lib/store";
import { supabaseConfigured, getSupabase } from "@/lib/supabase";
import {
  fetchActivePlanId,
  listChatMessages,
  listDailyLogs,
  listPlans,
  saveChatMessage,
  saveDailyLog,
  type ChatMessage,
} from "@/lib/account";
import { dayKey, questionsForDay, type DailyQuestion } from "@/lib/daily";
import AppNav from "@/components/AppNav";
import type { AscendPlan } from "@/lib/types";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  system?: boolean;
}

export default function CoachPage() {
  const { user, profile } = useApp();
  const isPro = Boolean(profile?.is_premium || profile?.is_admin);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // The in-flight streamed reply: null when idle, otherwise the text
  // accumulated so far ("" while waiting for the first token).
  const [streamText, setStreamText] = useState<string | null>(null);
  const [plan, setPlan] = useState<AscendPlan | null>(null);

  // Daily ritual state. Questions load in the effect below: computing
  // them during render reads the clock, which breaks Next prerendering.
  const [questions, setQuestions] = useState<DailyQuestion[]>([]);
  const [ritualStep, setRitualStep] = useState<number | null>(null);
  const [ritualAnswers, setRitualAnswers] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [bubbles, ritualStep, sending, streamText]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const [history, logs, plans, activePlanId] = await Promise.all([
        listChatMessages(60),
        listDailyLogs(7),
        listPlans(50),
        fetchActivePlanId(),
      ]);
      if (!alive) return;
      setBubbles(
        history.map((m: ChatMessage) => ({ role: m.role, content: m.content }))
      );
      // The active plan version — the one the user reverted to, when
      // set; otherwise the latest, as before.
      setPlan(
        (activePlanId
          ? plans.find((p) => p.id === activePlanId)?.plan
          : undefined) ??
          plans[0]?.plan ??
          null
      );
      const qs = questionsForDay();
      setQuestions(qs);
      const todayLog = logs.find((l) => l.day === dayKey());
      const existing = todayLog?.answers ?? {};
      const missing = qs.filter((q) => !existing[q.id]);
      if (isPro && missing.length > 0) {
        setRitualStep(0);
        setRitualAnswers(existing);
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPro]);

  const finishRitual = async (answers: Record<string, string>) => {
    setRitualStep(null);
    await saveDailyLog(dayKey(), { answers });
    const summary =
      "Banked ✓ — today's 3 answers are in. They're already shaping your adjustments and your next phase. Ask me anything about your plan, or tell me how today is going.";
    setBubbles((prev) => [...prev, { role: "assistant", content: summary }]);
    await saveChatMessage("assistant", summary);
  };

  const answerRitual = (value: string) => {
    if (ritualStep === null) return;
    const q = questions[ritualStep];
    if (!q) return;
    const next = { ...ritualAnswers, [q.id]: value };
    setRitualAnswers(next);
    setBubbles((prev) => [...prev, { role: "user", content: value }]);
    if (ritualStep + 1 >= questions.length) {
      void finishRitual(next);
    } else {
      setRitualStep(ritualStep + 1);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    // While the ritual is open, the input answers the current question.
    if (ritualStep !== null) {
      setInput("");
      answerRitual(text);
      return;
    }
    setInput("");
    setSending(true);
    const history = bubbles
      .filter((b) => !b.system)
      .slice(-10)
      .map((b) => ({ role: b.role, content: b.content }));
    setBubbles((prev) => [...prev, { role: "user", content: text }]);
    // No client-side save: /api/coach persists both sides of the
    // conversation server-side (that's what makes its daily cap real).
    try {
      const sb = getSupabase();
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });
      if (
        res.ok &&
        res.body &&
        (res.headers.get("content-type") ?? "").includes("text/plain")
      ) {
        // Streaming success: the reply renders token by token, then
        // settles into a normal bubble. The API route persists it
        // server-side when the stream completes.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        setStreamText("");
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            setStreamText(acc);
          }
        } catch {
          // Stream cut mid-reply: keep whatever arrived as the reply.
        }
        setStreamText(null);
        if (acc.trim()) {
          setBubbles((prev) => [
            ...prev,
            { role: "assistant", content: acc },
          ]);
        }
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && data.reply) {
        setBubbles((prev) => [
          ...prev,
          { role: "assistant", content: data.reply as string },
        ]);
        // Reply already persisted by the API route.
      } else {
        setBubbles((prev) => [
          ...prev,
          {
            role: "assistant",
            system: true,
            content:
              data.message ??
              "The coach is under heavy demand right now — give it a minute and ask again.",
          },
        ]);
      }
    } catch {
      setBubbles((prev) => [
        ...prev,
        {
          role: "assistant",
          system: true,
          content: "Connection hiccup — your message is saved. Try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!supabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <Eyebrow>Coach</Eyebrow>
        <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-bone">
          The coach arrives with accounts
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Your free scan works fully without one — the coach needs your saved
          plan and history to be personal.
        </p>
        <Button href="/quiz" className="mt-6 px-8 py-3">
          Start free scan
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <Eyebrow>Coach</Eyebrow>
        <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-bone">
          Your coach knows your plan
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Sign in to talk to the coach that reads your protocol, your
          check-ins and your daily logs — and asks you 3 questions a day to
          keep it honest.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/login" className="px-7 py-3">
            Sign in
          </Button>
          <Button href="/signup" variant="ghost" className="px-7 py-3">
            Create account
          </Button>
        </div>
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <Reveal>
          <Card glow className="text-center">
            <p className="text-3xl" aria-hidden>
              🔥
            </p>
            <h1 className="font-display mt-3 text-3xl font-extrabold text-bone">
              The coach is a Pro feature
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              It asks you 3 questions every day, reads your answers against
              your plan and your progress, and answers with your own numbers
              — ending every reply with the next habit from your protocol.
              A static plan can&apos;t do that. A coach that remembers you
              can.
            </p>
            <Button href="/paywall" className="mt-6 px-8 py-3.5">
              Meet your coach
            </Button>
            <p className="mt-3 text-xs text-muted">
              3-day free trial on Monthly &amp; Yearly · Weekly bills from day one
            </p>
          </Card>
        </Reveal>
      </div>
    );
  }

  const currentQ = ritualStep !== null ? questions[ritualStep] : null;
  const nonNegotiables = plan?.foundations.nonNegotiables ?? [];

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col px-4 pb-28 pt-6 sm:px-6 sm:pb-10 sm:pt-10">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Ascend Coach</Eyebrow>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-bone">
              {ritualStep !== null
                ? "First — today's 3 questions"
                : "Ask your coach"}
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold text-gold-soft underline underline-offset-2 hover:text-gold"
          >
            ← Today home
          </Link>
        </div>
        {nonNegotiables.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              Your non-negotiables:
            </span>
            {nonNegotiables.slice(0, 4).map((n) => (
              <span
                key={n}
                className="rounded-full border border-gold/30 bg-gold/[0.06] px-3 py-1 text-[11px] font-semibold text-gold-soft"
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </Reveal>

      <div
        ref={scrollRef}
        className="mt-6 flex-1 space-y-3 overflow-y-auto rounded-3xl border border-white/8 bg-white/[0.02] p-4 sm:p-5"
        style={{ maxHeight: "56vh" }}
      >
        {loaded && bubbles.length === 0 && ritualStep === null && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-bone">
            I&apos;ve read your plan, your latest scan and your recent logs.
            Ask me what to fix first, why a step is in your protocol, or how
            today went — I&apos;ll answer with your numbers, not generic tips.
          </div>
        )}
        {bubbles.map((b, i) => (
          <div
            key={i}
            className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                b.role === "user"
                  ? "border border-gold/40 bg-gold/15 text-bone"
                  : b.system
                    ? "border border-white/10 bg-white/[0.04] text-muted"
                    : "border border-white/8 bg-white/[0.04] text-bone"
              }`}
            >
              {b.content}
            </div>
          </div>
        ))}

        {currentQ && (
          <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
              {currentQ.pillar} · Question {(ritualStep ?? 0) + 1} of {questions.length}
            </p>
            <p className="mt-1.5 text-sm font-bold leading-relaxed text-bone">
              {currentQ.question}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentQ.chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => answerRitual(chip)}
                  className="min-h-[44px] rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-soft transition hover:bg-gold/20"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {streamText !== null && streamText.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-bone">
              {streamText}
              <span className="ml-0.5 animate-pulse text-gold">▍</span>
            </div>
          </div>
        )}

        {sending && streamText === null && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-muted">
              Your coach is reading your plan…
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder={
            ritualStep !== null
              ? "Tap an answer above, or type your own…"
              : "Ask about your plan, your numbers, your day…"
          }
          className="w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3.5 text-sm text-bone placeholder:text-muted/60"
        />
        <Button
          onClick={() => void send()}
          className="shrink-0 px-6 py-3.5"
        >
          {sending ? "…" : "Send"}
        </Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">
        The coach works from your saved plan and logs. Softmaxxing guidance
        only — anything medical belongs with a professional in person.
      </p>
      <AppNav active="coach" />
    </div>
  );
}
