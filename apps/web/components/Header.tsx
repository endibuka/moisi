"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const navLinks = ["Made for", "Features", "Platforms", "Tutorials", "Media"];

export default function Header() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // ignore tiny jitters
      if (Math.abs(delta) > 6) {
        // hide when scrolling down past the header, show when scrolling up
        setHidden(delta > 0 && y > 80);
        lastY.current = y;
      }
    };
    lastY.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-solid border-[rgba(252,252,253,0.01)] backdrop-blur-[12px] transition-transform duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
      style={{
        background:
          "linear-gradient(to bottom, rgba(102,102,102,0.5) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.3) 75%, rgba(0,0,0,0) 100%)",
      }}
    >
      <div className="mx-auto flex h-20 max-w-[1920px] items-center justify-between px-8">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center">
            <Image src="/logo.svg" alt="Logo" width={40} height={22} priority />
          </Link>

          <nav className="flex items-center gap-9">
            {navLinks.map((link) => (
              <Link
                key={link}
                href="#"
                className="text-[15px] font-medium text-[rgba(252,252,253,0.6)] transition-colors hover:text-white"
              >
                {link}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="#"
            className="text-[15px] font-medium text-white transition-opacity hover:opacity-80"
          >
            Login
          </Link>
          <Link
            href="#"
            className="flex h-10 items-center rounded-full bg-white px-5 text-[15px] font-medium text-black transition-opacity hover:opacity-90"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
