"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  { src: "/slide-1.jpg", alt: "Singer recording vocals in a studio" },
  { src: "/slide-2.jpg", alt: "Vintage microphone in warm light" },
  { src: "/slide-3.jpg", alt: "Performer singing on stage" },
  { src: "/slide-4.jpg", alt: "Microphone on a dark stage" },
];

export default function VoiceStudio() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      4000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <section className="bg-black px-8 pt-[33px]">
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex min-h-[628px] flex-col rounded-[32px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11] p-12">
          <h2 className="text-[59px] leading-[64px] tracking-[-1.28px] text-white">
            Voice Studio
          </h2>
          <p className="mt-3 text-[26px] leading-[33.6px] text-white">
            Track-ready performances
          </p>
          <p className="mt-4 text-[18px] leading-[28px] font-medium text-[rgba(252,252,253,0.6)]">
            Add expressive vocals modeled from real singers, covering a wide
            range of styles and timbres to fit your track.
          </p>
          <Link
            href="#"
            className="mt-6 flex h-[54px] w-fit items-center rounded-full bg-white px-7 text-[16px] font-medium text-black transition-opacity hover:opacity-90"
          >
            Create Vocal Parts
          </Link>

          <div className="mt-auto flex gap-3 pt-12">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setActive(i)}
                className={`h-3 w-3 rounded-full transition-colors ${
                  i === active
                    ? "bg-white"
                    : "bg-[rgba(252,252,253,0.2)] hover:bg-[rgba(252,252,253,0.4)]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="relative min-h-[628px] overflow-hidden rounded-[32px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11]">
          {slides.map((slide, i) => (
            <Image
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              fill
              className={`object-cover transition-opacity duration-700 ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
