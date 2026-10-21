// Scan photos, saved ON-DEVICE only (Zayne, 2026-10-21): every scan and
// re-scan keeps its front photo alongside its saved data so the history
// shows the face behind each score. Photos live in this browser's
// localStorage, downscaled — they are NEVER uploaded, exactly like the
// progress-photo timeline, so the privacy promise is untouched. Keyed
// by the account scan-row id returned when the scan was saved.

export interface ScanPhotoEntry {
  img: string; // downscaled JPEG data URL
  at: string; // ISO timestamp
}

const STORAGE_KEY = "ascend_scan_photos";
const MAX_ENTRIES = 12; // newest 12 scans keep their photo on this device

function readAll(): Record<string, ScanPhotoEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ScanPhotoEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Downscale a data URL to at most 720px wide, JPEG 0.8 — small enough
 *  for a dozen entries to sit comfortably in localStorage. */
function downscaleDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, 720 / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Attach a photo to a saved scan (fire-and-forget; storage is
 *  best-effort — a full/blocked localStorage never breaks a scan). */
export async function saveScanPhoto(
  scanId: string,
  dataUrl: string
): Promise<void> {
  try {
    const img = await downscaleDataUrl(dataUrl);
    const all = readAll();
    all[scanId] = { img, at: new Date().toISOString() };
    const entries = Object.entries(all).sort((a, b) =>
      b[1].at.localeCompare(a[1].at)
    );
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // best-effort only
  }
}

/** All on-device scan photos, keyed by scan-row id. */
export function loadScanPhotos(): Record<string, ScanPhotoEntry> {
  return readAll();
}
