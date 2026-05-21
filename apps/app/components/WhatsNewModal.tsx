"use client";

import {
  ArrowsLeftRight,
  type Icon,
  Lightning,
  Microphone,
  Sparkle,
  Waveform,
  X,
} from "@phosphor-icons/react";
import Modal from "./Modal";

type Update = {
  date: string;
  title: string;
  description: string;
  Icon: Icon;
};

const UPDATES: Update[] = [
  {
    date: "This week",
    title: "Muse, your AI music companion",
    description:
      "Chord ideas, lyrics, theory, mixing tips. Attach a track and have Muse add it to your library.",
    Icon: Sparkle,
  },
  {
    date: "This week",
    title: "Voice memos in chat",
    description:
      "Record audio right in the composer and have Muse work with it. Plus dictation for hands-free typing.",
    Icon: Microphone,
  },
  {
    date: "Last week",
    title: "Faster track loading",
    description:
      "Pre-computed waveforms render instantly; audio loads only when you hit Play.",
    Icon: Lightning,
  },
  {
    date: "Last week",
    title: "Saved conversations",
    description:
      "Every chat persists — pick up where you left off any time, switch between chats from the sidebar.",
    Icon: Waveform,
  },
  {
    date: "Earlier",
    title: "Track Separation",
    description:
      "Upload a song and we separate vocals, drums, bass, guitar, piano, and more into mixable stems.",
    Icon: ArrowsLeftRight,
  },
];

export default function WhatsNewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="What's new" size="md">
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          <X weight="bold" className="h-4 w-4" />
        </button>

        <div className="px-8 pt-8 pb-4">
          <h2 className="text-[24px] font-medium tracking-[-0.4px] text-[#fcfcfd]">
            What&apos;s new
          </h2>
          <p className="mt-1 text-[13.5px] text-[rgba(252,252,253,0.6)]">
            Recent updates to Moises.
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-8 pb-8">
          <ul className="flex flex-col gap-3">
            {UPDATES.map((u, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-[20px] border border-[rgba(252,253,255,0.06)] bg-[rgba(252,253,255,0.02)] p-4"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(0,218,232,0.08)] text-[#00dae8]">
                  <u.Icon weight="fill" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-medium text-[#fcfcfd]">
                      {u.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-[rgba(252,252,253,0.4)]">
                      {u.date}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[rgba(252,252,253,0.6)]">
                    {u.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
