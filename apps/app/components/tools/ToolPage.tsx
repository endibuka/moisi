import type { ReactNode } from "react";

/** Shared shell for every Tools page so the title block + body framing
 *  stays consistent across Vocal Isolator, Karaoke Maker, Time & Pitch, etc.
 *  Server-component friendly (no "use client" needed by callers). */
export default function ToolPage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[860px] px-8 py-10">
      <header className="mb-8">
        {eyebrow && (
          <p
            className="mb-2 text-[12px] font-semibold uppercase tracking-[1.5px]"
            style={{ color: "#00dae8" }}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-medium tracking-tight text-[#fcfcfd]">
          {title}
        </h1>
        <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-[rgba(252,252,253,0.6)]">
          {subtitle}
        </p>
      </header>
      <div>{children}</div>
    </div>
  );
}
