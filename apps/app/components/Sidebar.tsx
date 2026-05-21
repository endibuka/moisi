"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useConversations,
  useDeleteConversation,
  usePrefetchConversation,
} from "@/lib/muse/hooks";
import SettingsModal from "./SettingsModal";

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
function IconMuse({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5 13.7 8 19 9.7 13.7 11.4 12 17l-1.7-5.6L5 9.7 10.3 8 12 2.5Z" />
      <path d="M19 14.5 19.9 17 22.5 18l-2.6 1L19 21.5 18.1 19 15.5 18l2.6-1L19 14.5Z" opacity="0.7" />
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
function IconPanel({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}
function IconPlus({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconMusic({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}
function IconBook({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2Z" />
      <path d="M8 7h7M8 11h7" />
    </svg>
  );
}
function IconUsers({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M16 14.5A5.5 5.5 0 0 1 21.5 20" />
    </svg>
  );
}
function IconGift({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13M12 8c0-3-4-5-4-2 0 1.5 2 2 4 2Zm0 0c0-3 4-5 4-2 0 1.5-2 2-4 2Z" />
    </svg>
  );
}

export type SidebarJob = {
  id: string;
  original_name: string;
  status: "pending" | "processing" | "completed" | "failed";
};


const RESOURCES = [
  { label: "Docs", Icon: IconBook, href: "/docs" },
  { label: "Community", Icon: IconUsers, href: "#" },
  { label: "What's new", Icon: IconGift, href: "#" },
];

export default function Sidebar({
  userName,
  userEmail,
  recentJobs,
}: {
  userName: string;
  userEmail: string;
  recentJobs: SidebarJob[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const museActive = pathname?.startsWith("/muse") ?? false;
  const activeChatId = museActive ? searchParams.get("c") : null;
  const trackActive =
    pathname === "/" || (pathname?.startsWith("/track/") ?? false);
  const chatsOpen = museActive && !collapsed;
  const menuRef = useRef<HTMLDivElement>(null);

  // Conversation list via TanStack Query (server-prefetched in the layout, so
  // first paint has data; revalidates in background on focus).
  const { data: recentChats = [] } = useConversations();
  const prefetchConversation = usePrefetchConversation();
  const deleteConversation = useDeleteConversation();

  const startNewChat = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    router.push(`/muse?c=${id}`);
  };

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
      <ScrollArea className="flex-1" viewportClassName="px-3 pb-3">
      <div className="flex flex-col gap-1">
        {/* Muse — the featured AI entry point */}
        <Link
          href="/muse"
          title={collapsed ? "Muse" : undefined}
          aria-current={museActive ? "page" : undefined}
          className={`group relative flex h-9 items-center rounded-[8px] bg-[rgba(252,253,255,0.06)] text-[13px] font-medium text-[#fcfcfd] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] transition-colors hover:bg-[rgba(252,253,255,0.10)] ${
            collapsed ? "justify-center" : "gap-2 px-3"
          } ${museActive ? "bg-[rgba(252,253,255,0.12)]" : ""}`}
        >
          <IconMuse className="h-3.5 w-3.5 text-[#fcfcfd]" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Muse</span>
              <span className="rounded-[3px] bg-[rgba(252,253,255,0.10)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgba(241,247,254,0.85)]">
                AI
              </span>
            </>
          )}
        </Link>

        {/* Tools */}
        {!collapsed && <SectionLabel className="mt-3">Tools</SectionLabel>}
        <NavLink
          href="/"
          label="Track Separation"
          Icon={IconSeparation}
          active={trackActive}
          collapsed={collapsed}
        />

        {/* Library — recent jobs surface live */}
        {!collapsed && (
          <SectionLabel className="mt-3">
            Library
            {recentJobs.length > 0 && (
              <span className="ml-2 text-[rgba(229,237,253,0.36)]">
                {recentJobs.length}
              </span>
            )}
          </SectionLabel>
        )}
        {recentJobs.length === 0 ? (
          !collapsed && (
            <p className="px-3 py-2 text-[11px] leading-relaxed text-[rgba(229,237,253,0.36)]">
              Your separated tracks will land here.
            </p>
          )
        ) : (
          recentJobs.map((job) => (
            <LibraryRow
              key={job.id}
              job={job}
              collapsed={collapsed}
              active={pathname === `/track/${job.id}`}
            />
          ))
        )}

        {/* Chats — contextual sub-nav, only visible while on /muse */}
        <div
          aria-hidden={!chatsOpen}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            chatsOpen
              ? "mt-3 grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            {!collapsed && (
              <SectionLabel>
                Chats
                {recentChats.length > 0 && (
                  <span className="ml-2 text-[rgba(229,237,253,0.36)]">
                    {recentChats.length}
                  </span>
                )}
              </SectionLabel>
            )}
            <button
              type="button"
              onClick={startNewChat}
              className="flex h-9 w-full items-center gap-3 rounded-[6px] px-3 text-[13px] text-[rgba(241,247,254,0.71)] transition-colors hover:bg-[rgba(221,234,248,0.04)] hover:text-white"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-[rgba(252,253,255,0.18)]">
                <IconPlus className="h-2.5 w-2.5" />
              </span>
              <span className="truncate">New chat</span>
            </button>
            {recentChats.length === 0 ? (
              <p className="px-3 pt-1 text-[11px] leading-relaxed text-[rgba(229,237,253,0.36)]">
                Past conversations will appear here.
              </p>
            ) : (
              recentChats.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  active={activeChatId === chat.id}
                  onHover={() => prefetchConversation(chat.id)}
                  onDelete={() => {
                    deleteConversation.mutate(chat.id);
                    if (activeChatId === chat.id) {
                      // Active chat got deleted — start a fresh one.
                      const id =
                        typeof crypto !== "undefined" &&
                        "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                      router.push(`/muse?c=${id}`);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Resources */}
        {!collapsed && (
          <SectionLabel className="mt-3">Resources</SectionLabel>
        )}
        {RESOURCES.map((item) => (
          <NavLink
            key={item.label}
            href={item.href}
            label={item.label}
            Icon={item.Icon}
            collapsed={collapsed}
          />
        ))}
      </div>
      </ScrollArea>

      {/* bottom: upgrade + user menu */}
      <div ref={menuRef} className="relative p-3">
        <button
          type="button"
          title={collapsed ? "Upgrade Plan" : undefined}
          className={`flex h-9 w-full items-center rounded-[6px] bg-gradient-to-r from-[#00dae8] to-[#0affa7] text-[13px] font-medium text-[#001316] shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_24px_-12px_rgba(0,218,232,0.55)] transition-opacity hover:opacity-90 ${
            collapsed ? "justify-center" : "justify-center gap-2 px-3"
          }`}
        >
          <IconZap />
          {!collapsed && <span>Upgrade Plan</span>}
        </button>

        <div className="my-3 h-px bg-[#212225]" />
        {menuOpen && (
          <div className="absolute bottom-[68px] left-3 right-3 overflow-hidden rounded-[8px] border border-[#212225] bg-[#1a1b1e] py-1 shadow-lg">
            <p className="truncate px-3 py-2 text-[12px] text-[rgba(229,237,253,0.48)]">
              {userEmail}
            </p>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="w-full px-3 py-2 text-left text-[13px] text-[rgba(241,247,254,0.71)] transition-colors hover:bg-[rgba(221,234,248,0.06)] hover:text-white"
            >
              Settings
            </button>
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

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userName={userName}
        userEmail={userEmail}
      />
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

function NavLink({
  label,
  Icon,
  href,
  active,
  badge,
  collapsed,
}: {
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
  href: string;
  active?: boolean;
  badge?: string;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
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
    </Link>
  );
}

function ChatRow({
  chat,
  active,
  onHover,
  onDelete,
}: {
  chat: { id: string; title: string };
  active: boolean;
  onHover: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group/chat relative">
      <Link
        href={`/muse?c=${chat.id}`}
        onMouseEnter={onHover}
        onFocus={onHover}
        className={`flex h-9 items-center gap-3 rounded-[6px] pl-3 pr-8 text-[13px] transition-colors ${
          active
            ? "bg-[rgba(221,234,248,0.08)] text-[rgba(252,253,255,0.94)]"
            : "text-[rgba(241,247,254,0.71)] hover:bg-[rgba(221,234,248,0.04)] hover:text-white"
        }`}
      >
        <span
          className={`size-1.5 shrink-0 rounded-full ${
            active ? "bg-[#00dae8]" : "bg-[rgba(252,253,255,0.18)]"
          }`}
        />
        <span className="min-w-0 flex-1 truncate">{chat.title}</span>
      </Link>
      <button
        type="button"
        title="Delete chat"
        aria-label="Delete chat"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            typeof window !== "undefined" &&
            !window.confirm(`Delete "${chat.title}"?`)
          ) {
            return;
          }
          onDelete();
        }}
        className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-[rgba(241,247,254,0.45)] opacity-0 transition-opacity hover:bg-[rgba(255,93,93,0.12)] hover:text-[#ff8a8a] group-hover/chat:opacity-100"
      >
        <IconTrash className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IconTrash({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
    </svg>
  );
}

function LibraryRow({
  job,
  active,
  collapsed,
}: {
  job: SidebarJob;
  active: boolean;
  collapsed: boolean;
}) {
  // Completed jobs route to the mixer; in-flight ones go to the library
  // (where the status / spinner is rendered).
  const href = job.status === "completed" ? `/track/${job.id}` : "/";
  const inFlight = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";
  const router = useRouter();
  const prefetch =
    job.status === "completed"
      ? () => router.prefetch(href)
      : undefined;

  return (
    <Link
      href={href}
      title={collapsed ? job.original_name : undefined}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={`flex h-9 items-center rounded-[6px] text-[13px] transition-colors ${
        collapsed ? "justify-center" : "gap-2 px-3"
      } ${
        active
          ? "bg-[rgba(221,234,248,0.08)] text-[rgba(252,253,255,0.94)]"
          : "text-[rgba(241,247,254,0.71)] hover:bg-[rgba(221,234,248,0.04)] hover:text-white"
      }`}
    >
      <IconMusic className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">
            {job.original_name.replace(/\.[^.]+$/, "")}
          </span>
          {inFlight && (
            <span
              className="size-1.5 shrink-0 animate-pulse rounded-full bg-[#00dae8]"
              title="Processing"
            />
          )}
          {failed && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-[#ff6b6b]"
              title="Failed"
            />
          )}
        </>
      )}
    </Link>
  );
}
