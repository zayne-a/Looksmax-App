"use client";

import { useState } from "react";
import AdminGate from "@/components/admin/AdminGate";

/**
 * /admin/android — the Mewmax app running in an Android phone frame
 * in the browser, so the owner can try the latest app without
 * installing each APK. Admin-only via AdminGate (non-admins get the
 * real 404, like every other admin page).
 *
 * The frame loads /api/admin/android-preview, which streams the
 * latest web export of the native app (re-exported on every publish
 * — OTA or new build — so this page always shows the current app).
 * Same origin as the site, so the preview shares the site's backend
 * but keeps its own session (see the native supabase client: web
 * uses its own storage key): the preview starts as guest, and
 * signing in inside it never signs the owner out of this site.
 *
 * Honest limits of the browser preview: the camera scan cannot run
 * here (phone-native measurement pipeline) — the scan screen shows
 * its no-camera branch and the gallery path, and measurement
 * reports it as unavailable. Everything else runs the real app
 * code: funnel, questions, sign-in, existing scans, deck.
 */
export default function AndroidPreviewPage() {
  const [frameKey, setFrameKey] = useState(0);

  return (
    <AdminGate>
      {(token) => (
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center px-4 py-8">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Android preview
          </h1>
          <p className="mt-2 max-w-xl text-center text-sm text-zinc-400">
            The latest Mewmax app, live in your browser — no APK
            install needed. Camera scanning doesn&apos;t run here
            (use the gallery option, or the APK for full scanning).
            The preview starts as guest; sign in inside it to test
            signed-in views.
          </p>
          <button
            type="button"
            onClick={() => setFrameKey((k) => k + 1)}
            className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-bold text-black"
          >
            Reload preview
          </button>
          {/* Android phone frame: 412×915, black bezel, punch-hole. */}
          <div className="mt-6 w-[min(412px,94vw)] rounded-[2.5rem] border-[10px] border-black bg-black shadow-2xl shadow-black/60">
            <div className="relative aspect-[412/915] w-full overflow-hidden rounded-[1.9rem] bg-[#0A0A0C]">
              <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-4 w-4 -translate-x-1/2 rounded-full bg-black" />
              {/* The token rides the first load only; the handler
                  sets a path-scoped cookie so the frame's asset
                  requests stay authed without it in every URL. */}
              <iframe
                key={frameKey}
                title="Mewmax Android preview"
                src={`/api/admin/android-preview?token=${encodeURIComponent(token)}`}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </AdminGate>
  );
}
