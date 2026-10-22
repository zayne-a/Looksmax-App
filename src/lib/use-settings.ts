"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  resolveSettings,
  type AppSettings,
} from "./settings";

/**
 * Client read of GET /api/settings (2026-10-22). One fetch per page
 * load, shared by every hook consumer through a module-level cache.
 * Until the fetch lands, consumers render with DEFAULT_SETTINGS —
 * which is exactly the pre-settings product behaviour (no
 * maintenance, creator program on, 3-day trial), so nothing flashes
 * a wrong state that the owner didn't choose.
 */

let cache: AppSettings | null = null;
let inflight: Promise<AppSettings> | null = null;

function load(): Promise<AppSettings> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        cache = resolveSettings(
          json && typeof json === "object"
            ? (json as Record<string, unknown>)
            : null
        );
        return cache;
      })
      .catch(() => DEFAULT_SETTINGS);
  }
  return inflight;
}

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(
    cache ?? DEFAULT_SETTINGS
  );
  useEffect(() => {
    let live = true;
    void load().then((s) => {
      if (live) setSettings(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return settings;
}
