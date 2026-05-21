"use client";

import { X } from "@phosphor-icons/react";
import Modal from "./Modal";

/**
 * Centered confirmation dialog. Use for destructive-or-irreversible actions
 * where a tiny inline confirm doesn't carry enough weight (deleting a chat,
 * a track, an account, etc.).
 *
 * The two-button row uses STYLING.md primary white button for "Cancel" (safe
 * default focus) and a red accent for destructive. Non-destructive defaults
 * to the white primary on the confirm side.
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const confirmClasses = destructive
    ? "bg-[#ff5d5d] text-white hover:opacity-90"
    : "bg-white text-black hover:opacity-90";

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} size="md">
      <div className="relative px-6 py-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
        >
          <X weight="bold" className="h-4 w-4" />
        </button>

        <h2 className="pr-10 text-[18px] font-medium tracking-[-0.2px] text-[#fcfcfd]">
          {title}
        </h2>
        {description && (
          <div className="mt-2 text-[13.5px] leading-relaxed text-[rgba(252,252,253,0.6)]">
            {description}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-full border border-[rgba(255,255,255,0.15)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium transition-opacity ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
