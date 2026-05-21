"use client";

/**
 * Discrete slider — cyan-filled track, tick dots that brighten as the fill
 * crosses them, white thumb with a cyan halo. A native <input type="range">
 * sits invisible on top for drag, keyboard, and screen-reader support.
 */
export default function TickSlider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[rgba(252,252,253,0.07)]">
        <div
          className="h-full rounded-full bg-[#00dae8] transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {ticks.map((v) => {
        const tickPct = ((v - min) / (max - min)) * 100;
        const active = v <= value;
        return (
          <span
            key={v}
            aria-hidden
            className="pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-150"
            style={{
              left: `${tickPct}%`,
              backgroundColor: active
                ? "rgba(0, 19, 22, 0.55)"
                : "rgba(252,252,253,0.18)",
            }}
          />
        );
      })}

      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fcfcfd] shadow-[0_0_0_4px_rgba(0,218,232,0.18),0_2px_10px_rgba(0,0,0,0.35)] transition-[left] duration-150 ease-out"
        style={{ left: `${pct}%` }}
      />

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}
