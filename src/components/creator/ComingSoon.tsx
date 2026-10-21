import Link from "next/link";

/** Bare centred Coming Soon page — the reference's pattern for its
 *  not-yet-live creator sections (Back button, heading, Coming Soon). */
export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0a0a0c] p-4 text-[#f4f1e8] md:p-8">
      <Link
        href="/creator"
        className="absolute top-4 left-4 rounded-lg px-3 py-2 text-sm text-[#9b9ba4] transition-colors hover:bg-white/5 hover:text-[#5EEAD4]"
      >
        ← Back
      </Link>
      <h1 className="font-[family-name:var(--font-archivo)] text-4xl font-extrabold tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-lg text-[#9b9ba4]">Coming Soon</p>
    </div>
  );
}
