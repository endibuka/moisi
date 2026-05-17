const columns = [
  {
    title: "Made for",
    links: [
      "Drummers",
      "Vocalists",
      "Bassists",
      "Guitarists",
      "Producers",
      "Educators",
    ],
  },
  {
    title: "How to",
    links: [
      "Remove Vocals from a Song",
      "Separate Vocals from a Song",
      "Master a Song",
      "What is the Difference Between Mixing and Mastering?",
    ],
  },
  {
    title: "Products",
    links: ["Moises App", "Moises Web App", "Moises iPad App"],
  },
  {
    title: "Company",
    links: [
      "About",
      "Blog",
      "Newsroom",
      "Research",
      "Careers",
      "Partner Program",
      "Privacy",
      "Terms",
      "Help Center",
      "Press Inquiries",
      "Patents",
    ],
  },
];

const socials = [0, 1, 2, 3, 4, 5];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-black">
      {/* cyan ambient glow */}
      <div className="pointer-events-none absolute -left-40 -top-40 size-[480px] rounded-full bg-[#00dae8] opacity-[0.12] blur-[140px]" />

      <div className="relative mx-auto max-w-[1920px] px-20 py-12">
        <div className="flex flex-wrap gap-x-8 gap-y-12 lg:flex-nowrap lg:justify-between">
          {/* brand */}
          <div className="flex shrink-0 flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-wordmark.svg"
              alt="Moises"
              width={152}
              height={24}
              className="h-6 w-[152px]"
            />
            <p className="mt-6 text-[22px] font-medium leading-[33.6px] text-[#fcfcfd]">
              The Creative Suite
              <br />
              for Musicians
            </p>
            <button
              type="button"
              className="mt-auto flex w-fit items-center gap-2 rounded-full border-2 border-[rgba(252,252,253,0.3)] px-4 py-2 lg:mt-12"
            >
              <span className="text-[13px] font-medium text-[rgba(252,252,253,0.6)]">
                English
              </span>
              <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                <path
                  d="M1 1.5L5.5 6L10 1.5"
                  stroke="rgba(252,252,253,0.6)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* nav columns */}
          {columns.map((col) => (
            <div key={col.title} className="w-[160px] shrink-0">
                <p className="text-[15px] font-medium text-[#fcfcfd]">
                  {col.title}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-[15px] font-medium text-[rgba(252,252,253,0.6)] transition-colors hover:text-white"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
            </div>
          ))}
        </div>
      </div>

      {/* bottom bar */}
      <div className="relative border-t border-[rgba(252,252,253,0.1)]">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-4 px-20 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {socials.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s}
                  src={`/community/soc${s}.svg`}
                  alt=""
                  className="size-5"
                />
              ))}
            </div>
            <a
              href="#"
              className="text-[13px] font-medium text-[rgba(252,252,253,0.6)] transition-colors hover:text-white"
            >
              Cookie Preferences
            </a>
          </div>
          <p className="text-[13px] font-medium text-[rgba(252,252,253,0.6)]">
            Moises Systems, Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
