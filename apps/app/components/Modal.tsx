"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Size = "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  md: "max-w-[520px]",
  lg: "max-w-[760px]",
  xl: "max-w-[960px]",
};

/**
 * Generic modal wrapper. Renders into <body> via a portal, traps body scroll
 * while open, closes on Escape and on backdrop click. Children get the panel
 * surface; the modal itself handles overlay, sizing, and accessibility.
 */
export default function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  size = "xl",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  size?: Size;
}) {
  // SSR-safe portal — only mount the portal after the first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
      />
      {/* Two-layer panel:
          - Outer frame: 32px radius, faint translucent surface — gives a
            subtle halo / matted feel around the inner panel.
          - Inner panel: 24px radius, the actual card surface. Scroll lives
            here so children behave as before. */}
      <div
        className={`relative w-full ${SIZE_CLASSES[size]} rounded-[32px] border border-[rgba(252,253,255,0.05)] bg-[rgba(252,253,255,0.02)] p-1.5 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-md`}
      >
        <div className="max-h-[80vh] overflow-hidden rounded-[24px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
