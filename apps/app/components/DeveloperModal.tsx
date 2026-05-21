"use client";

import {
  ArrowSquareOut,
  Code,
  GithubLogo,
  type Icon,
  Plug,
  Terminal,
  X,
} from "@phosphor-icons/react";
import Modal from "./Modal";

type DevLink = {
  title: string;
  description: string;
  href: string;
  Icon: Icon;
};

const DEV_LINKS: DevLink[] = [
  {
    title: "API reference",
    description:
      "REST endpoints for stem separation, jobs, and signed URLs. Auth via Supabase tokens.",
    href: "#",
    Icon: Code,
  },
  {
    title: "Webhooks",
    description:
      "Receive callbacks when separation jobs finish. Configure once, verify with HMAC.",
    href: "#",
    Icon: Plug,
  },
  {
    title: "CLI",
    description:
      "Manage separations, batch-upload tracks, and inspect jobs from your terminal.",
    href: "#",
    Icon: Terminal,
  },
  {
    title: "GitHub",
    description:
      "Open-source SDKs, examples, and the public roadmap. PRs welcome.",
    href: "#",
    Icon: GithubLogo,
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
            For developers
          </h2>
          <p className="mt-1 text-[13.5px] text-[rgba(252,252,253,0.6)]">
            Build on top of Moises.
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-8 pb-8">
          <ul className="flex flex-col gap-2">
            {DEV_LINKS.map((link) => (
              <li key={link.title}>
                <a
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    link.href.startsWith("http")
                      ? "noreferrer noopener"
                      : undefined
                  }
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
        </div>
      </div>
    </Modal>
  );
}
