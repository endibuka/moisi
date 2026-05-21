"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import * as React from "react";

/**
 * shadcn-style ScrollArea on top of @radix-ui/react-scroll-area.
 *
 * The scrollbar overlays the content with a thin, subtle thumb tuned to the
 * dark theme (see STYLING.md). The thumb appears on hover / scroll and fades
 * out, so it never competes with the content.
 *
 * To programmatically scroll the contents (e.g. scroll-to-bottom on a new
 * chat message), pass a ref via `viewportRef` — Radix exposes the actual
 * scrollable element as the Viewport, not the Root.
 */
type ScrollAreaProps = React.ComponentPropsWithoutRef<
  typeof ScrollAreaPrimitive.Root
> & {
  viewportRef?: React.Ref<HTMLDivElement>;
  viewportClassName?: string;
};

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(function ScrollArea(
  { className = "", children, viewportRef, viewportClassName = "", ...props },
  ref,
) {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        // Override Radix's internal `display:table` wrapper so children honor
        // the viewport width (truncate / max-w would otherwise be ignored and
        // content would overflow horizontally). Also give the wrapper an
        // explicit `h-full` so `h-full` children resolve their percentage
        // height — `min-h-full` doesn't count for percentage-height children
        // per CSS spec, which is why centered empty states were hugging the
        // top. Content that genuinely overflows the wrapper still triggers
        // Viewport scrolling.
        className={`h-full w-full rounded-[inherit] [&>div]:!block [&>div]:!h-full ${viewportClassName}`}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<
    typeof ScrollAreaPrimitive.ScrollAreaScrollbar
  >
>(function ScrollBar(
  { className = "", orientation = "vertical", ...props },
  ref,
) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={`flex touch-none select-none transition-opacity data-[state=hidden]:opacity-0 ${
        orientation === "vertical"
          ? "h-full w-1.5 border-l border-l-transparent p-px"
          : "h-1.5 flex-col border-t border-t-transparent p-px"
      } ${className}`}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-[rgba(252,253,255,0.18)] transition-colors hover:bg-[rgba(252,253,255,0.3)]" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});

export { ScrollArea, ScrollBar };
