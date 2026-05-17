"use client";

import { useState } from "react";

const faqs = [
  {
    q: "What is Moises?",
    a: "Moises is an AI-powered toolkit for musicians that lets you separate stems, remove vocals, change keys and tempo, and turn any track into a custom practice or backing track.",
  },
  {
    q: "Will Moises ever train on my data?",
    a: "No. Your uploads stay private and are never used to train our models.",
  },
  {
    q: "How does Moises train its models?",
    a: "Our models are trained on licensed and properly sourced audio datasets, never on user-uploaded content.",
  },
  {
    q: "Is Moises free?",
    a: "Moises offers a free plan with core features, plus Premium and Pro plans that unlock higher quality processing and advanced tools.",
  },
  {
    q: "Is Moises available online, or do I need to download an app?",
    a: "Both. You can use Moises directly in your browser, or download the desktop and mobile apps for iOS, Android, Mac and Windows.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="bg-black px-8 py-16">
      <div className="mx-auto max-w-[768px]">
        <h2 className="text-center text-[30px] leading-[38.4px] text-[#fcfcfd]">
          Frequently Asked Questions
        </h2>

        <div className="mt-10">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={faq.q} className="border-t border-[#3b3b3b]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[16.7px] font-medium text-[#fcfcfd]">
                    {faq.q}
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`shrink-0 text-[#fcfcfd] transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-6 text-[15px] leading-[24px] text-[rgba(255,255,255,0.6)]">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
