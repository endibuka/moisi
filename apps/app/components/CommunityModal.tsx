"use client";

import { X } from "@phosphor-icons/react";
import Modal from "./Modal";

// TODO: replace with your actual server invite URL.
const DISCORD_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE ?? "https://discord.gg/moises";

export default function CommunityModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Community" size="md">
      <div className="relative p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          <X weight="bold" className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-[20px] border border-[rgba(252,253,255,0.1)] bg-[rgba(252,253,255,0.05)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/discord.svg" alt="Discord" className="h-7 w-7" />
          </span>

          <h2 className="mt-5 text-[24px] font-medium tracking-[-0.4px] text-[#fcfcfd]">
            Join the Moises community
          </h2>
          <p className="mt-2 max-w-[380px] text-[14px] leading-relaxed text-[rgba(252,252,253,0.6)]">
            Trade tips, share covers, get help from other musicians, and hear
            about features before they ship.
          </p>

          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onClose}
            className="mt-7 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/discord.svg" alt="" className="h-4 w-4" />
            Open Discord
          </a>
        </div>
      </div>
    </Modal>
  );
}
