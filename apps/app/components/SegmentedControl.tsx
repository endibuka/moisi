"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

/**
 * Segmented control. Shows all options inline; the active one is highlighted
 * by a sliding indicator that animates between buttons. Use for mutually
 * exclusive choices where both labels are useful to see — "Vocals vs
 * Instrumental", "Daily / Weekly / Monthly", etc. Cleaner than a toggle
 * switch for non-binary or symmetric-binary choices.
 */
export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const btn = btnRefs.current[value];
    if (!root || !btn) return;
    const rootBox = root.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    setIndicator({ left: btnBox.left - rootBox.left, width: btnBox.width });
  }, [value, options]);

  const h = size === "sm" ? "h-8" : "h-9";
  const textCls = size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative inline-flex ${h} items-stretch rounded-full border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-1`}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-[rgba(252,252,253,0.08)] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] transition-[left,width] duration-200 ease-out"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[opt.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative z-[1] flex items-center justify-center gap-1.5 rounded-full px-4 font-medium transition-colors ${textCls} ${
              active
                ? "text-[#fcfcfd]"
                : "text-[rgba(252,252,253,0.55)] hover:text-[#fcfcfd]"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
