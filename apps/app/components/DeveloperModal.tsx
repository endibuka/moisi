"use client";

import {
  ArrowSquareOut,
  BookOpen,
  Code,
  Image,
  Key,
  Lightning,
  MusicNotes,
  Waveform,
  X,
  type Icon,
} from "@phosphor-icons/react";
import Modal from "./Modal";
import { ScrollArea } from "./ui/scroll-area";

// Public Mintlify deployment of `/docs`. Centralised so a future custom
// domain swap is a one-line change.
const DOCS_BASE = "https://muse-6955b459.mintlify.app";

type DevLink = {
  title: string;
  description: string;
  href: string;
  Icon: Icon;
};

const DEV_LINKS: DevLink[] = [
  {
    title: "Quickstart",
    description:
      "Get from zero to a separated track in five minutes. Auth, upload, kick off a job.",
    href: `${DOCS_BASE}/quickstart`,
    Icon: Lightning,
  },
  {
    title: "Authentication",
    description:
      "Generate an API key in Settings → API and authenticate every request with a bearer token.",
    href: `${DOCS_BASE}/authentication`,
    Icon: Key,
  },
  {
    title: "Separations",
    description:
      "Run the full 7-stem pipeline or the 2-stem vocal-isolation fast path. Includes get + list.",
    href: `${DOCS_BASE}/endpoints/separations/create`,
    Icon: Waveform,
  },
  {
    title: "Music generation",
    description:
      "Generate songs from a style prompt plus optional lyrics. Returns a single mixed track.",
    href: `${DOCS_BASE}/endpoints/songs/create`,
    Icon: MusicNotes,
  },
  {
    title: "Cover art",
    description:
      "Spotify-style 1:1 album covers via Gemini. Attach to any of your existing jobs.",
    href: `${DOCS_BASE}/endpoints/cover-art/create`,
    Icon: Image,
  },
  {
    title: "Errors & status codes",
    description:
      "Standard JSON error envelope, rate-limit headers, and the full list of error codes.",
    href: `${DOCS_BASE}/errors`,
    Icon: Code,
  },
  {
    title: "Full API reference",
    description:
      "Browse every endpoint, request schema, and response example in one place.",
    href: `${DOCS_BASE}/introduction`,
    Icon: BookOpen,
  },
];

export default function DeveloperModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="For developers" size="md">
      {/* Definite height (capped at 80vh) so the ScrollArea's flex-1 child
          resolves to a real height — Radix's Viewport uses `height: 100%`
          internally, which only works if an ancestor has a *real* height
          (max-height alone doesn't count for percentage children). Same
          pattern as SettingsModal. */}
      <div className="relative flex h-[560px] max-h-[80vh] flex-col">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          <X weight="bold" className="h-4 w-4" />
        </button>

        <div className="shrink-0 px-8 pt-8 pb-4">
          <h2 className="text-[24px] font-medium tracking-[-0.4px] text-[#fcfcfd]">
            For developers
          </h2>
          <p className="mt-1 text-[13.5px] text-[rgba(252,252,253,0.6)]">
            Build on top of Moisi — REST endpoints for separation, music
            generation, and cover art.
          </p>
        </div>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="px-8 pb-8">
          <ul className="flex flex-col gap-2">
            {DEV_LINKS.map((link) => (
              <li key={link.title}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex items-start gap-3 rounded-[20px] border border-[rgba(252,253,255,0.06)] bg-[rgba(252,253,255,0.02)] p-4 transition-colors hover:border-[rgba(252,253,255,0.15)] hover:bg-[rgba(252,253,255,0.04)]"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(252,253,255,0.06)] text-[#fcfcfd]">
                    <link.Icon weight="fill" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-medium text-[#fcfcfd]">
                        {link.title}
                      </p>
                      <ArrowSquareOut
                        weight="bold"
                        className="h-3.5 w-3.5 shrink-0 text-[rgba(252,252,253,0.4)] transition-colors group-hover:text-[#fcfcfd]"
                      />
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[rgba(252,252,253,0.6)]">
                      {link.description}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>
    </Modal>
  );
}
