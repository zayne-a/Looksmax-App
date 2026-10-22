/**
 * MaxText — the shared renderer for Max's formatted replies:
 * **bold** → <strong> (stat-like content holding a digit gets the
 * accent highlight), CAPS label lines (with or without a leading
 * emoji) get the label treatment, bare URLs and Markdown links become
 * real anchors, and raw "**" markers never reach the screen.
 *
 * Extracted verbatim from SupportChat's renderer on 2026-10-22 so the
 * web Coach page renders Max exactly like the support widget does.
 * SupportChat still carries its own copy — keep the two in step, or
 * migrate SupportChat onto this module.
 */
import type { ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const LABEL_RE = /^([A-Z][A-Z0-9 '&/+.-]{1,40}:)\s*(.*)$/;
const EMOJI_LABEL_RE =
  /^([^\p{L}\p{N}\s]{1,4}\s+)([A-Z][A-Z0-9 '&/+.-]{1,40}:)\s*(.*)$/u;

const stripMarks = (s: string) => s.replace(/\*\*/g, "");

function linkify(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(stripMarks(text.slice(last, m.index)));
    const anchorCls =
      "font-semibold text-gold-soft underline decoration-gold/50 underline-offset-2 transition hover:text-gold";
    if (m[1] && m[2]) {
      parts.push(
        <a
          key={`${keyBase}-a${k++}`}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={anchorCls}
        >
          {stripMarks(m[1])}
        </a>,
      );
    } else if (m[3]) {
      let url = m[3];
      let trail = "";
      while (/[.,;:!?]$/.test(url)) {
        trail = url.slice(-1) + trail;
        url = url.slice(0, -1);
      }
      if (url.endsWith(")") && !url.includes("(")) {
        trail = ")" + trail;
        url = url.slice(0, -1);
      }
      parts.push(
        <a
          key={`${keyBase}-a${k++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={anchorCls}
        >
          {url}
        </a>,
      );
      if (trail) parts.push(trail);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(stripMarks(text.slice(last)));
  return parts;
}

/* One line's inline content: **bold** → <strong> (stat-like content —
   anything holding a digit — gets the accent highlight), everything
   else through the linkifier. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(text)) !== null) {
    if (m.index > last)
      out.push(...linkify(text.slice(last, m.index), `${keyBase}-p${k++}`));
    const inner = m[1];
    const statLike = /\d/.test(inner);
    out.push(
      <strong
        key={`${keyBase}-b${k++}`}
        className={
          statLike
            ? "rounded bg-gold/15 px-1 py-px font-bold text-gold-soft"
            : "font-bold text-bone"
        }
      >
        {linkify(inner, `${keyBase}-bi${k}`)}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length)
    out.push(...linkify(text.slice(last), `${keyBase}-t${k++}`));
  return out;
}

const isLabel = (label: string) =>
  (label.match(/[A-Z]/g) ?? []).length >= 2;

const LABEL_CLS = "font-semibold uppercase tracking-wide text-teal-300";

export function renderRichText(text: string): ReactNode {
  try {
    return text.split("\n").map((line, i) => {
      if (line.trim() === "") {
        return <span key={i} className="block h-2" aria-hidden="true" />;
      }
      const direct = line.match(LABEL_RE);
      if (direct && isLabel(direct[1])) {
        return (
          <span key={i} className="block">
            <span className={LABEL_CLS}>{direct[1]}</span>
            {direct[2] ? <> {renderInline(direct[2], `l${i}`)}</> : null}
          </span>
        );
      }
      const emojiLed = line.match(EMOJI_LABEL_RE);
      if (emojiLed && isLabel(emojiLed[2])) {
        return (
          <span key={i} className="block">
            {emojiLed[1]}
            <span className={LABEL_CLS}>{emojiLed[2]}</span>
            {emojiLed[3] ? <> {renderInline(emojiLed[3], `l${i}`)}</> : null}
          </span>
        );
      }
      return (
        <span key={i} className="block">
          {renderInline(line, `l${i}`)}
        </span>
      );
    });
  } catch {
    // Parse edge case — plain text, markers stripped, never raw "**".
    return stripMarks(text);
  }
}
