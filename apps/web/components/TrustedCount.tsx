"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

const TARGET = 70000003;

export default function TrustedCount() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, TARGET, {
      duration: 2.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setCount(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView]);

  return (
    <section className="bg-black px-8 py-10">
      <div className="mx-auto max-w-[1920px] px-10">
        <div className="border-b-2 border-[rgba(255,255,255,0.15)] pb-4">
          <p className="text-[37px] leading-[40px] tracking-[-0.8px] text-[rgba(252,252,253,0.3)]">
            Trusted by +70 million artists worldwide
          </p>
        </div>
        <div
          ref={ref}
          className="mt-6 text-[clamp(56px,11.6vw,223px)] leading-none font-medium tracking-[-4.8px] text-white tabular-nums"
        >
          +{count.toLocaleString("en-US")}
        </div>
      </div>
    </section>
  );
}
