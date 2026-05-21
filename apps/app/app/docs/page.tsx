import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";

/* STYLING.md accent green — keeps docs visually distinct from the app's cyan. */
const ACCENT = "#0affa7";

/* ----- icons ----- */
type IconProps = { className?: string };

function IconSparkles({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v6m0 6v6m9-9h-6M9 12H3m13.5-6.5L14 8m-4 8-2.5 2.5m9 0L14 16m-4-8L7.5 5.5" />
    </svg>
  );
}
function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function IconBack({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
function IconBook({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2Z" />
      <path d="M8 7h7M8 11h7" />
    </svg>
  );
}
function IconUpload({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function IconLayers({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M2 13l10 5 10-5M2 18l10 5 10-5" />
    </svg>
  );
}
function IconSliders({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  );
}
function IconWave({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h2M7 12v-3M7 12v3M11 12v-7M11 12v7M15 12v-5M15 12v5M19 12v-3M19 12v3M21 12h0" />
    </svg>
  );
}
function IconMic({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
function IconBroom({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3 21 10M19 8 8 19l-5-2 2-5L16 1ZM7 16l1 5" />
    </svg>
  );
}
function IconEcho({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.55" />
    </svg>
  );
}
function IconKey({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="4" />
      <path d="M10.5 11.5 21 1m-5 5 3 3m-5-1 3 3" />
    </svg>
  );
}
function IconRoute({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3" />
    </svg>
  );
}
function IconBolt({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" />
    </svg>
  );
}
function IconServer({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}

/* ----- big illustration icons for the feature cards ----- */

function IllRocket() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16">
      <path d="M32 4c8 6 12 14 12 24v8l-6 6h-12l-6-6v-8c0-10 4-18 12-24Z" />
      <circle cx="32" cy="24" r="4" />
      <path d="M20 36c-4 2-8 6-8 14 8 0 12-4 14-8M44 36c4 2 8 6 8 14-8 0-12-4-14-8M26 50l-2 8M38 50l2 8M32 50v8" />
    </svg>
  );
}
function IllPipeline() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16">
      <rect x="4" y="14" width="14" height="36" rx="2" />
      <rect x="46" y="14" width="14" height="36" rx="2" />
      <path d="M18 32h28M40 26l6 6-6 6M11 22v20M53 22v20" />
    </svg>
  );
}
function IllTerminal() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16">
      <rect x="6" y="12" width="52" height="40" rx="3" />
      <path d="M6 22h52" />
      <circle cx="13" cy="17" r="1.2" fill="currentColor" />
      <circle cx="18" cy="17" r="1.2" fill="currentColor" />
      <circle cx="23" cy="17" r="1.2" fill="currentColor" />
      <path d="m18 32 6 6-6 6M28 44h12" />
    </svg>
  );
}
function IllServer() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16">
      <rect x="8" y="10" width="48" height="14" rx="2" />
      <rect x="8" y="28" width="48" height="14" rx="2" />
      <rect x="8" y="46" width="48" height="10" rx="2" />
      <circle cx="14" cy="17" r="1.2" fill="currentColor" />
      <circle cx="14" cy="35" r="1.2" fill="currentColor" />
      <circle cx="14" cy="51" r="1.2" fill="currentColor" />
      <path d="M22 17h26M22 35h26M22 51h18" />
    </svg>
  );
}

/* ----- real nav data ----- */

const NAV_SECTIONS: {
  title: string;
  items: { label: string; Icon: (p: IconProps) => React.JSX.Element; active?: boolean; href?: string }[];
}[] = [
  {
    title: "Get Started",
    items: [
      { label: "Quickstart", Icon: IconBook, active: true },
      { label: "Upload a track", Icon: IconUpload },
      { label: "The 7 stems", Icon: IconLayers },
      { label: "Mixer controls", Icon: IconSliders },
    ],
  },
  {
    title: "Pipeline",
    items: [
      { label: "Mel-Roformer", Icon: IconWave },
      { label: "htdemucs_6s", Icon: IconMic },
      { label: "MDX23C-InstVoc", Icon: IconBroom },
      { label: "DeEcho-DeReverb", Icon: IconEcho },
    ],
  },
  {
    title: "Developer",
    items: [
      { label: "API keys", Icon: IconKey },
      { label: "Endpoints", Icon: IconRoute },
      { label: "Webhooks", Icon: IconBolt },
      { label: "Self-host on RunPod", Icon: IconServer },
    ],
  },
];

const TOC = [
  { label: "Quickstart", anchor: "quickstart", active: true },
  { label: "The pipeline", anchor: "pipeline" },
  { label: "API", anchor: "api" },
  { label: "Self-host", anchor: "self-host" },
];

const CARDS = [
  {
    id: "quickstart",
    title: "Quickstart",
    description:
      "Upload a track, get back six clean stems plus a studio-acapella in about three minutes.",
    Illustration: IllRocket,
    href: "#quickstart",
  },
  {
    id: "pipeline",
    title: "The pipeline",
    description:
      "How four chained models — Mel-Roformer, htdemucs_6s, MDX23C, DeEcho — produce studio-quality stems.",
    Illustration: IllPipeline,
    href: "#pipeline",
  },
  {
    id: "api",
    title: "API",
    description:
      "Programmatically trigger separations and pull stems from your own code over HTTP.",
    Illustration: IllTerminal,
    href: "#api",
  },
  {
    id: "self-host",
    title: "Self-host",
    description:
      "Run the GPU worker on your own RunPod serverless endpoint. Bring your own image and weights.",
    Illustration: IllServer,
    href: "#self-host",
  },
];

const TABS = [
  { label: "Guides", active: true },
  { label: "API Reference" },
  { label: "Changelog" },
];

/* ----- page ----- */

export default function DocsPage() {
  return (
    <div className="flex h-screen flex-col bg-[#0c0c0e] text-[#edeef0]">
      {/* Header bar — logo column (matches nav width) + tabs/search/AskAI */}
      <header className="flex h-14 shrink-0 border-b border-[rgba(252,252,253,0.06)]">
        <div className="flex w-[240px] shrink-0 items-center gap-3 border-r border-[rgba(252,252,253,0.06)] px-4">
          <Link
            href="/"
            aria-label="Back to app"
            className="flex size-7 items-center justify-center rounded-[6px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
          >
            <IconBack className="h-4 w-4" />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Moisi" className="h-[18px] w-auto" />
          <span className="ml-1 text-[12px] font-medium uppercase tracking-[2px] text-[rgba(252,252,253,0.45)]">
            Docs
          </span>
        </div>

        <div className="relative flex flex-1 items-center gap-6 px-6">
          <nav className="flex h-full items-center gap-6 text-[14px]">
            {TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                className={`relative h-full ${
                  t.active
                    ? "text-[#fcfcfd]"
                    : "text-[rgba(252,252,253,0.6)] transition-colors hover:text-[#fcfcfd]"
                }`}
              >
                {t.label}
                {t.active && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full"
                    style={{ background: ACCENT }}
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex h-9 w-[300px] items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[rgba(252,252,253,0.5)]">
              <IconSearch className="h-4 w-4" />
              <span className="flex-1 text-[13px]">Search the docs</span>
              <kbd className="rounded-[4px] bg-[rgba(252,252,253,0.08)] px-1.5 py-0.5 text-[10px] text-[rgba(252,252,253,0.6)]">
                ⌘K
              </kbd>
            </div>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-full border border-[rgba(252,252,253,0.1)] px-3 text-[12px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
            >
              <IconSparkles className="h-4 w-4" />
              Ask AI
            </button>
          </div>
        </div>
      </header>

      {/* Body: docs-nav | content | TOC */}
      <div className="flex flex-1 overflow-hidden">
        {/* Docs nav */}
        <ScrollArea
          className="w-[240px] shrink-0 border-r border-[rgba(252,252,253,0.06)]"
          viewportClassName="px-3 py-4"
        >
        <aside className="flex flex-col gap-1">
          <button
            type="button"
            className="mb-2 flex h-9 items-center gap-3 rounded-[6px] px-3 text-[13px] text-[rgba(252,252,253,0.85)] transition-colors hover:bg-[rgba(252,252,253,0.04)] hover:text-[#fcfcfd]"
          >
            <IconSparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
            <span className="flex-1 text-left">Ask Assistant</span>
          </button>

          {NAV_SECTIONS.map((section, i) => (
            <div key={section.title} className="mb-2">
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-[rgba(252,252,253,0.3)]">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <button
                    key={`${i}-${item.label}`}
                    type="button"
                    className={`flex h-9 items-center gap-3 rounded-[6px] px-3 text-[13px] transition-colors ${
                      item.active
                        ? ""
                        : "text-[rgba(252,252,253,0.6)] hover:bg-[rgba(252,252,253,0.04)] hover:text-[#fcfcfd]"
                    }`}
                    style={
                      item.active
                        ? {
                            backgroundColor: "rgba(10,255,167,0.12)",
                            color: ACCENT,
                          }
                        : undefined
                    }
                  >
                    <item.Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
        </ScrollArea>

        {/* Main content */}
        <ScrollArea className="flex-1">
        <main>
          <div className="mx-auto max-w-[760px] px-10 py-10">
            {/* Hero */}
            <p
              className="mb-2 text-[13px] font-medium"
              style={{ color: ACCENT }}
            >
              Documentation
            </p>
            <h1 className="text-[36px] font-medium tracking-tight text-[#fcfcfd]">
              Welcome to Moisi
            </h1>
            <p className="mt-2 max-w-[600px] text-[15px] leading-relaxed text-[rgba(252,252,253,0.6)]">
              Studio-clean vocals, drums, bass, guitar, piano, and instrumentals
              from any track in about three minutes — plus a separate dry
              acapella for production work.
            </p>

            {/* Feature cards */}
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {CARDS.map(({ id, title, description, Illustration, href }) => (
                <Link
                  key={id}
                  id={id}
                  href={href}
                  className="group relative flex h-[240px] flex-col overflow-hidden rounded-[16px] border border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.02)] p-6 transition-colors hover:border-[rgba(10,255,167,0.3)]"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(252,252,253,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(252,252,253,0.04) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                      maskImage:
                        "radial-gradient(ellipse at center, black 40%, transparent 75%)",
                    }}
                  />
                  <div
                    className="relative flex flex-1 items-center justify-center transition-transform group-hover:scale-105"
                    style={{ color: ACCENT }}
                  >
                    <Illustration />
                  </div>
                  <div className="relative">
                    <h3 className="text-[16px] font-medium text-[#fcfcfd]">
                      {title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[rgba(252,252,253,0.6)]">
                      {description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Short real-content section beneath the cards */}
            <section className="mt-12 rounded-[16px] border border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.02)] p-6">
              <h2 className="text-[18px] font-medium text-[#fcfcfd]">
                What you get back
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[rgba(252,252,253,0.6)]">
                Every job returns the same seven files in your private
                Supabase Storage bucket:
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-[rgba(252,252,253,0.85)]">
                <li>vocals.mp3</li>
                <li>vocals_acapella.mp3</li>
                <li>drums.mp3</li>
                <li>bass.mp3</li>
                <li>guitar.mp3</li>
                <li>piano.mp3</li>
                <li>other.mp3</li>
              </ul>
            </section>
          </div>
        </main>
        </ScrollArea>

        {/* TOC */}
        <ScrollArea
          className="hidden w-[200px] shrink-0 lg:block"
          viewportClassName="px-4 py-10"
        >
        <aside>
          <p className="mb-4 flex items-center gap-2 text-[12px] font-medium text-[rgba(252,252,253,0.6)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M4 6h16M4 12h10M4 18h16" />
            </svg>
            On this page
          </p>
          <ul className="flex flex-col gap-2.5 text-[13px]">
            {TOC.map((item) => (
              <li
                key={item.anchor}
                className={`relative pl-3 ${
                  item.active
                    ? ""
                    : "text-[rgba(252,252,253,0.6)] transition-colors hover:text-[#fcfcfd]"
                }`}
                style={item.active ? { color: ACCENT } : undefined}
              >
                {item.active && (
                  <span
                    className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ background: ACCENT }}
                  />
                )}
                <a href={`#${item.anchor}`}>{item.label}</a>
              </li>
            ))}
          </ul>
        </aside>
        </ScrollArea>
      </div>
    </div>
  );
}
