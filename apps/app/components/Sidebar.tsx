"use client";

import {
  ArrowsLeftRight,
  Code,
  DotsThreeVertical,
  Gift,
  type Icon,
  Image as ImageIcon,
  Lightning,
  Microphone,
  MusicNote,
  MusicNotes,
  MusicNotesPlus,
  PencilSimple,
  Plus,
  SidebarSimple,
  Sparkle,
  Trash,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useConversations,
  useDeleteConversation,
  usePrefetchConversation,
  useRenameConversation,
} from "@/lib/muse/hooks";
import CommunityModal from "./CommunityModal";
import ConfirmModal from "./ConfirmModal";
import DeveloperModal from "./DeveloperModal";
import SettingsModal from "./SettingsModal";
import WhatsNewModal from "./WhatsNewModal";

const ic = "h-4 w-4 shrink-0";

export type SidebarJob = {
  id: string;
  original_name: string;
  status: "pending" | "processing" | "completed" | "failed";
};

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
  const [communityOpen, setCommunityOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  // Persist Go-Pro card dismissal across reloads (per-browser). Starts false
  // so SSR matches first client render, then hydrates from localStorage.
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  useEffect(() => {
    try {
      setUpgradeDismissed(localStorage.getItem("moisi.upgradeDismissed") === "1");
    } catch {
      // localStorage can throw in private mode / sandboxed iframes.
    }
  }, []);
  const dismissUpgrade = () => {
    setUpgradeDismissed(true);
    try {
      localStorage.setItem("moisi.upgradeDismissed", "1");
    } catch {
      // ignore
    }
  };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const museActive = pathname?.startsWith("/muse") ?? false;
  const activeChatId = museActive ? searchParams.get("c") : null;
  const trackActive =
    (pathname?.startsWith("/library") ?? false) ||
    (pathname?.startsWith("/track/") ?? false);
  const chatsOpen = museActive && !collapsed;
  const menuRef = useRef<HTMLDivElement>(null);

  // Conversation list via TanStack Query (server-prefetched in the layout, so
  // first paint has data; revalidates in background on focus).
  const { data: recentChats = [] } = useConversations();
  const prefetchConversation = usePrefetchConversation();
  const deleteConversation = useDeleteConversation();
  const renameConversation = useRenameConversation();

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
          <SidebarSimple weight="fill" className={ic} />
        </button>
      </div>

      {/* scrollable nav — fade overlay at the bottom hints at more chats
          below when the list is long. */}
      <div className="relative flex-1 overflow-hidden">
      <ScrollArea className="h-full" viewportClassName="px-3 pb-10">
      <div className="flex flex-col gap-1">
        {/* Muse — the featured AI entry point */}
        <Link
          href="/muse"
          title={collapsed ? "Muse" : undefined}
          aria-current={museActive ? "page" : undefined}
          className={`group relative flex h-9 items-center rounded-[8px] bg-[rgba(252,253,255,0.06)] text-[13px] font-medium text-[#fcfcfd] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-colors hover:bg-[rgba(252,253,255,0.12)] ${
            collapsed ? "justify-center" : "gap-2 px-3"
          } ${museActive ? "bg-[rgba(252,253,255,0.14)]" : ""}`}
        >
          <Sparkle weight="fill" className="h-3.5 w-3.5 shrink-0 text-[#fcfcfd]" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Muse</span>
              <span className="rounded-[3px] bg-[rgba(252,253,255,0.10)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgba(241,247,254,0.85)]">
                AI
              </span>
            </>
          )}
        </Link>

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
                <Plus weight="bold" className="h-2.5 w-2.5 shrink-0" />
              </span>
              <span className="truncate">New chat</span>
            </button>
            {recentChats.length === 0 ? (
              <p className="px-3 pt-1 text-[11px] leading-relaxed text-[rgba(229,237,253,0.36)]">
                Past conversations will appear here.
              </p>
            ) : (
              // Cap the visible list so a long chat history doesn't push the
              // rest of the sidebar (Tools, Library, etc.) off-screen.
              // ~7 chats (36px each + gap) fit before scrolling kicks in;
              // anything beyond that scrolls inside this contained area.
              <div className="relative">
                <ScrollArea className="max-h-[268px]">
                  <div className="flex flex-col">
                    {recentChats.map((chat) => (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        active={activeChatId === chat.id}
                        onHover={() => prefetchConversation(chat.id)}
                        onRename={(title) =>
                          renameConversation.mutate({ id: chat.id, title })
                        }
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
                    ))}
                  </div>
                </ScrollArea>
                {/* Fade overlay at the bottom hints at more chats below
                    when the list overflows. Pointer-events-none so it
                    doesn't intercept clicks on the last visible row. */}
                {recentChats.length > 7 && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#111113] to-transparent"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tools */}
        {!collapsed && <SectionLabel className="mt-3">Tools</SectionLabel>}
        <NavLink
          href="/library"
          label="Track Separation"
          Icon={ArrowsLeftRight}
          active={trackActive}
          collapsed={collapsed}
        />
        <NavLink
          href="/tools/vocal-isolator"
          label="Vocal Isolator"
          Icon={Microphone}
          active={pathname?.startsWith("/tools/vocal-isolator") ?? false}
          collapsed={collapsed}
        />
        <NavLink
          href="/tools/karaoke"
          label="Karaoke Maker"
          Icon={MusicNote}
          active={pathname?.startsWith("/tools/karaoke") ?? false}
          collapsed={collapsed}
        />
        <NavLink
          href="/tools/music-generator"
          label="Music Generator"
          Icon={MusicNotesPlus}
          active={pathname?.startsWith("/tools/music-generator") ?? false}
          collapsed={collapsed}
        />
        <NavLink
          href="/tools/cover-art"
          label="Cover Art"
          Icon={ImageIcon}
          active={pathname?.startsWith("/tools/cover-art") ?? false}
          collapsed={collapsed}
        />

        {/* Library — recent jobs surface live, capped at the 5 newest so the
            sidebar doesn't grow unbounded as the user's history fills up. */}
        {(() => {
          const libraryJobs = recentJobs.slice(0, 5);
          return (
            <>
              {!collapsed && (
                <SectionLabel className="mt-3">
                  Library
                  {libraryJobs.length > 0 && (
                    <span className="ml-2 text-[rgba(229,237,253,0.36)]">
                      {libraryJobs.length}
                    </span>
                  )}
                </SectionLabel>
              )}
              {libraryJobs.length === 0
                ? !collapsed && (
                    <p className="px-3 py-2 text-[11px] leading-relaxed text-[rgba(229,237,253,0.36)]">
                      Your separated tracks will land here.
                    </p>
                  )
                : libraryJobs.map((job) => (
                    <LibraryRow
                      key={job.id}
                      job={job}
                      collapsed={collapsed}
                      active={pathname === `/track/${job.id}`}
                    />
                  ))}
            </>
          );
        })()}

      </div>
      </ScrollArea>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#111113] to-transparent"
      />
      </div>

      {/* bottom: resources + developer + upgrade + user menu */}
      <div ref={menuRef} className="relative border-t border-[#212225] p-3">
        <div className="mb-1.5 flex flex-col gap-0.5">
          <NavButton
            label="Community"
            Icon={UsersThree}
            collapsed={collapsed}
            onClick={() => setCommunityOpen(true)}
          />
          <NavButton
            label="What's new"
            Icon={Gift}
            collapsed={collapsed}
            onClick={() => setWhatsNewOpen(true)}
          />
          <NavButton
            label="Developer"
            Icon={Code}
            collapsed={collapsed}
            onClick={() => setDeveloperOpen(true)}
          />
        </div>

        {!upgradeDismissed &&
          (collapsed ? (
            // Collapsed: compact glowing badge — the gradient is the only Pro
            // signifier, sized to match other sidebar icons. (No X here —
            // there's no room; dismiss is exposed in the expanded card.)
            <button
              type="button"
              title="Upgrade to Pro"
              className="mx-auto flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#00dae8] to-[#0affa7] text-[#001316] shadow-[0_4px_16px_-6px_rgba(0,218,232,0.55)] transition-transform hover:scale-105"
            >
              <Lightning weight="fill" className="h-4 w-4" />
            </button>
          ) : (
            // Expanded: small card following STYLING.md — faint inner surface,
            // card border, gradient icon badge, primary cyan CTA, dismiss X.
            <div className="relative rounded-[16px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-3">
              <button
                type="button"
                onClick={dismissUpgrade}
                aria-label="Dismiss upgrade prompt"
                className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-[rgba(252,252,253,0.5)] transition-colors hover:bg-[rgba(252,252,253,0.08)] hover:text-[#fcfcfd]"
              >
                <X weight="bold" className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-2 pr-6">
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#00dae8] to-[#0affa7] text-[#001316] shadow-[0_2px_10px_-4px_rgba(0,218,232,0.5)]">
                  <Lightning weight="fill" className="h-3.5 w-3.5" />
                </span>
                <p className="text-[13px] font-medium text-[#fcfcfd]">Go Pro</p>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[rgba(252,252,253,0.6)]">
                Unlimited separations, longer tracks, priority queue.
              </p>
              <button
                type="button"
                className="mt-3 flex h-8 w-full items-center justify-center rounded-full bg-[#00dae8] text-[12px] font-medium text-[#001316] transition-opacity hover:opacity-90"
              >
                Upgrade
              </button>
            </div>
          ))}

        <div className="my-3 h-px bg-[rgba(252,252,253,0.06)]" />
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
          className={`flex w-full items-center gap-3 rounded-[10px] p-1.5 transition-colors hover:bg-[rgba(221,234,248,0.06)] ${
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
      <CommunityModal
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
      />
      <WhatsNewModal
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
      />
      <DeveloperModal
        open={developerOpen}
        onClose={() => setDeveloperOpen(false)}
      />
    </aside>
  );
}

function NavButton({
  label,
  Icon,
  collapsed,
  onClick,
}: {
  label: string;
  Icon: Icon;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`flex h-9 w-full items-center rounded-[6px] text-[13px] text-[rgba(241,247,254,0.71)] transition-colors hover:bg-[rgba(221,234,248,0.04)] hover:text-white ${
        collapsed ? "justify-center" : "gap-3 px-3"
      }`}
    >
      <Icon weight="fill" className={ic} />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
    </button>
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
  Icon: Icon;
  href: string;
  active?: boolean;
  badge?: string;
  collapsed: boolean;
}) {
  // Eager hover prefetch — by the time the click registers, the page's RSC
  // payload + data is already warm in the router cache. Native <Link>
  // viewport prefetch only fetches the loading shell for dynamic routes,
  // which is why nav felt sluggish; this triggers the full prefetch.
  const router = useRouter();
  const prefetch = () => router.prefetch(href);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={`flex h-9 items-center rounded-[6px] text-[13px] transition-colors ${
        collapsed ? "justify-center" : "gap-3 px-3"
      } ${
        active
          ? "bg-[rgba(221,234,248,0.08)] text-[rgba(252,253,255,0.94)]"
          : "text-[rgba(241,247,254,0.71)] hover:bg-[rgba(221,234,248,0.04)] hover:text-white"
      }`}
    >
      <Icon weight="fill" className={ic} />
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
  onRename,
}: {
  chat: { id: string; title: string };
  active: boolean;
  onHover: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  // Close the dropdown on outside click. Editing mode handles its own
  // commit-on-blur, so we don't tie the two together.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Focus + select the input when entering edit mode.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(chat.title);
    setEditing(true);
    closeMenu();
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== chat.title) onRename(trimmed);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(chat.title);
    setEditing(false);
  };

  return (
    <div ref={rowRef} className="group/chat relative">
      {editing ? (
        <div
          className={`flex h-9 items-center gap-3 rounded-[6px] px-3 ${
            active ? "bg-[rgba(221,234,248,0.08)]" : "bg-[rgba(221,234,248,0.04)]"
          }`}
        >
          <span
            className={`size-1.5 shrink-0 rounded-full ${
              active ? "bg-[#00dae8]" : "bg-[rgba(252,253,255,0.18)]"
            }`}
          />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#fcfcfd] outline-none"
          />
        </div>
      ) : (
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
      )}

      {!editing && (
        <button
          type="button"
          aria-label="Chat actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className={`absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-[rgba(241,247,254,0.6)] transition-opacity hover:bg-[rgba(252,253,255,0.06)] hover:text-white ${
            menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <DotsThreeVertical weight="bold" className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-1 top-full z-20 mt-1 w-44 overflow-hidden rounded-[10px] border border-[#212225] bg-[#1a1b1e] py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={startEdit}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[rgba(241,247,254,0.85)] transition-colors hover:bg-[rgba(221,234,248,0.06)] hover:text-white"
          >
            <PencilSimple weight="fill" className="h-3.5 w-3.5 shrink-0" />
            Edit name
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              setConfirmOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#ff8a8a] transition-colors hover:bg-[rgba(255,93,93,0.10)] hover:text-[#ffaeae]"
          >
            <Trash weight="fill" className="h-3.5 w-3.5 shrink-0" />
            Delete
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        title="Delete this chat?"
        description={
          <>
            This will permanently remove the conversation and all its messages.
            <br />
            <span className="text-[rgba(252,252,253,0.85)]">{chat.title}</span>
          </>
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
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
  const href = job.status === "completed" ? `/track/${job.id}` : "/library";
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
      <MusicNotes weight="fill" className="h-3.5 w-3.5 shrink-0 opacity-70" />
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
