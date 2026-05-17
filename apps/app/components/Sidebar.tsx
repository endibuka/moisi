"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";

/* ---- icons (16px stroke) ---- */
type IconProps = { className?: string };
const ic = "h-4 w-4 shrink-0";

function IconSeparation({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  );
}
function IconSparkles({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v6m0 6v6m9-9h-6M9 12H3m13.5-6.5L14 8m-4 8-2.5 2.5m9 0L14 16m-4-8L7.5 5.5" />
    </svg>
  );
}
function IconSliders({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  );
}
function IconMic({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
function IconMessage({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
function IconStar({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.9-5.3-2.8L6.7 19l1-5.9L3.5 9l5.9-.9L12 3Z" />
    </svg>
  );
}
function IconDownload({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
function IconZap({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" />
    </svg>
  );
}
function IconPlus({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconPanel({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

const PRODUCTS = [
  { label: "Track Separation", Icon: IconSeparation, active: true },
  { label: "AI Studio", Icon: IconSparkles, badge: "Beta" },
  { label: "Mastering", Icon: IconSliders },
  { label: "Voice Studio", Icon: IconMic },
  { label: "Lyric Writer", Icon: IconMessage },
];

const SETLISTS = [
  { title: "Jam Sessions with Charlie Puth", by: "By Moises", img: "/dashboard/charlie-puth.png" },
  { title: "Jam Sessions with Cory Henry", by: "By Moises", img: "/dashboard/cory-henry.png" },
  { title: "Guitar Exercises", by: "By Berklee Online", img: "/dashboard/berklee.png" },
  { title: "Moises Collection", by: "By Moises", img: "/dashboard/moises-collection.png" },
];

const TOOLS = [
  { label: "Jam Sessions", Icon: IconStar },
  { label: "Downloads", Icon: IconDownload },
  { label: "Upgrade Plan", Icon: IconZap },
];

export default function Sidebar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[#212225] bg-[#111113] transition-[width] duration-200 ${
        collapsed ? "w-[64px]" : "w-[240px]"
      }`}
    >
      {/* header */}
      <div className="flex h-[64px] items-center justify-between px-4">
        {!collapsed && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/logo.svg" alt="Moises" className="h-[18px] w-auto" />
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className={`flex size-8 items-center justify-center rounded-[6px] text-[rgba(241,247,254,0.71)] transition-colors hover:bg-[rgba(221,234,248,0.08)] hover:text-white ${
            collapsed ? "mx-auto" : ""
          }`}
        >
          <IconPanel />
        </button>
      </div>

      {/* scrollable nav */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        {!collapsed && <SectionLabel>Products</SectionLabel>}
        {PRODUCTS.map((item) => (
          <NavItem key={item.label} {...item} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <>
            <SectionLabel className="mt-4">Setlists</SectionLabel>
            <button
              type="button"
              className="flex items-center gap-3 rounded-[6px] py-1.5 text-left transition-colors hover:bg-[rgba(221,234,248,0.04)]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-[#18191b] text-[rgba(241,247,254,0.71)]">
                <IconPlus />
              </span>
              <span className="text-[13px] text-[rgba(241,247,254,0.71)]">
                New Setlist
              </span>
            </button>

            {SETLISTS.map((s) => (
              <button
                key={s.title}
                type="button"
                className="flex items-center gap-3 rounded-[6px] py-1.5 text-left transition-colors hover:bg-[rgba(221,234,248,0.04)]"
              >
                <span className="size-10 shrink-0 overflow-hidden rounded-[6px] bg-[#18191b]">
                  <Image
                    src={s.img}
                    alt=""
                    width={40}
                    height={40}
                    className="size-full object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-[rgba(241,247,254,0.71)]">
                    {s.title}
                  </span>
                  <span className="block text-[11px] text-[rgba(229,237,253,0.48)]">
                    {s.by}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}

        <div className={collapsed ? "mt-2 flex flex-col gap-1" : "mt-4 flex flex-col gap-1"}>
          {TOOLS.map((item) => (
            <NavItem key={item.label} {...item} collapsed={collapsed} />
          ))}
        </div>
      </div>

      {/* user menu */}
      <div ref={menuRef} className="relative border-t border-[#212225] p-3">
        {menuOpen && (
          <div className="absolute bottom-[68px] left-3 right-3 overflow-hidden rounded-[8px] border border-[#212225] bg-[#1a1b1e] py-1 shadow-lg">
            <p className="truncate px-3 py-2 text-[12px] text-[rgba(229,237,253,0.48)]">
              {userEmail}
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full px-3 py-2 text-left text-[13px] text-[rgba(241,247,254,0.71)] transition-colors hover:bg-[rgba(221,234,248,0.06)] hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`flex w-full items-center gap-3 rounded-full p-1 transition-colors hover:bg-[rgba(221,234,248,0.06)] ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#00dae8] text-[13px] font-medium text-[#001316]">
            {userName.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[14px] text-[#edeef0]">
                  {userName}
                </span>
                <span className="block text-[11px] text-[rgba(229,237,253,0.48)]">
                  Free
                </span>
              </span>
              <span className="px-1 text-[rgba(241,247,254,0.71)]">⋮</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`px-1 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[1.5px] text-[rgba(217,237,255,0.36)] ${className}`}
    >
      {children}
    </p>
  );
}

function NavItem({
  label,
  Icon,
  active,
  badge,
  collapsed,
}: {
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
  active?: boolean;
  badge?: string;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      className={`flex h-9 items-center rounded-[6px] text-[13px] transition-colors ${
        collapsed ? "justify-center" : "gap-3 px-3"
      } ${
        active
          ? "bg-[rgba(221,234,248,0.08)] text-[rgba(252,253,255,0.94)]"
          : "text-[rgba(241,247,254,0.71)] hover:bg-[rgba(221,234,248,0.04)] hover:text-white"
      }`}
    >
      <Icon />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && badge && (
        <span className="rounded-[3px] bg-[rgba(222,238,255,0.08)] px-1.5 py-0.5 text-[11px] text-[rgba(241,247,255,0.71)]">
          {badge}
        </span>
      )}
    </button>
  );
}
