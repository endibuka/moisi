"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

/**
 * Per-route quick crossfade. Sidebar clicks should feel *instant* — so:
 *
 *   - No `mode="wait"`: the new page mounts immediately while the old one
 *     fades out in parallel. mode="wait" was blocking the new view from
 *     rendering for the entire exit duration.
 *   - Duration 100ms, opacity-only. Long enough to read as polish, short
 *     enough to be subliminal.
 *
 * Pathname is intentionally the only key — searchParams (e.g.
 * /muse?c=abc → /muse?c=def) don't trigger a route transition; conversation
 * switching inside Muse is handled by MuseChat's own remount logic.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
