// Privacy page (new, audit fix — the footer linked to "#" before). Written from the product’s actual behaviour: photos measured on-device and never uploaded, account data under own-rows RLS, AI receives measurements/answers/logs but never photos, and the dashboard wipe button described as it works (now including device-local stores).
import { Card, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion";

export const metadata = {
  title: "Privacy — Ascend",
  description:
    "How Ascend handles your data: photos are measured on your device and never uploaded.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Reveal>
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-bone">
          Your face never leaves your phone.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Last updated October 2026. This page describes what Ascend
          actually does with data — the same rules the product is built on.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-8 space-y-4">
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            Photos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Face measurement runs entirely on your device. Your photos are
            never uploaded to our servers, never stored by us, and never
            used to train models. Progress photos you save in the app live
            only in your browser&apos;s local storage, on your device.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            What we store
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            With an account, we store your email, your measurements and
            scores, your generated plans, weekly check-ins, daily logs and
            coach conversations — so your journey is waiting on any device.
            This data is tied to your account, protected by row-level
            security (only you can read your rows), and is never sold.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            AI processing
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Premium plans and the AI coach send your measurements, quiz
            answers and logs (never your photos) to our AI provider to
            generate your content. Free scans and plans use no AI at all.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-extrabold text-bone">
            Deleting your data
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your saved scans, plans, check-ins, logs and coach history
            live in your account — signing out deletes nothing, and
            everything is restored when you log back in. If you want your
            account and all of its data permanently deleted, that is
            available on request.
          </p>
        </Card>
      </Reveal>
    </div>
  );
}
