import Image from "next/image";
import Link from "next/link";

const glow =
  "radial-gradient(at 18% 28%, rgba(0,239,255,0.55) 0px, transparent 55%)," +
  "radial-gradient(at 78% 18%, rgba(0,239,255,0.4) 0px, transparent 50%)," +
  "radial-gradient(at 62% 72%, rgba(0,239,255,0.5) 0px, transparent 58%)," +
  "radial-gradient(at 32% 82%, rgba(0,239,255,0.35) 0px, transparent 52%)," +
  "radial-gradient(at 88% 60%, rgba(0,239,255,0.3) 0px, transparent 48%)";

const stems = [
  { icon: "/icons/inst-0.svg", fill: 75 },
  { icon: "/icons/inst-1.svg", fill: 75 },
  { icon: "/icons/inst-2.svg", fill: 75 },
  { icon: "/icons/inst-3.svg", fill: 75 },
];

function StemRow({ icon, fill }: { icon: string; fill: number }) {
  return (
    <div className="relative flex h-[86px] items-center gap-[6px] rounded-[20px] border border-[rgba(252,252,253,0.03)] bg-[rgba(252,252,253,0.05)] pl-6 pr-6">
      <button
        type="button"
        className="flex size-5 items-center justify-center rounded-[4px] bg-[rgba(252,252,253,0.1)]"
        aria-label="Mute"
      >
        <Image src="/icons/mute.svg" alt="" width={10} height={10} />
      </button>
      <button
        type="button"
        className="flex size-5 items-center justify-center rounded-[4px] bg-[rgba(252,252,253,0.1)]"
        aria-label="Solo"
      >
        <Image src="/icons/solo.svg" alt="" width={10} height={10} />
      </button>
      <Image src={icon} alt="" width={36} height={36} className="ml-[6px]" />
      <div className="relative ml-[14px] h-1 flex-1 rounded-[2px] bg-[rgba(252,252,253,0.1)]">
        <div
          className="absolute left-0 top-0 h-1 rounded-[2px] bg-gradient-to-r from-[#00dae8] to-[#0affa7]"
          style={{ width: `${fill}%` }}
        />
        <div
          className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#545454] bg-black"
          style={{ left: `${fill}%` }}
        >
          <div className="size-1.5 rounded-full bg-[#0affa7]" />
        </div>
      </div>
    </div>
  );
}

export default function StudioQuality() {
  return (
    <section className="relative overflow-hidden bg-black px-8 pt-28 pb-32">
      {/* ambient cyan glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-25px] -z-0 aspect-[960/895] w-[960px] -translate-x-1/2 opacity-25 blur-[120px]"
        style={{ backgroundImage: glow }}
      />
      <div
        className="pointer-events-none absolute left-[-260px] top-16 -z-0 aspect-[640/716] w-[640px] opacity-30 blur-[120px]"
        style={{ backgroundImage: glow }}
      />
      <div
        className="pointer-events-none absolute right-[-260px] top-16 -z-0 aspect-[640/716] w-[640px] opacity-30 blur-[120px]"
        style={{ backgroundImage: glow }}
      />

      <div className="relative mx-auto max-w-[1024px]">
        <div className="text-center">
          <h2 className="mx-auto text-[73px] leading-[80px] tracking-[-1.6px] text-white">
            Studio-Quality Sound.
            <br />
            No Studio Required.
          </h2>
          <p className="mx-auto mt-7 max-w-[850px] text-[18px] leading-[28px] font-medium text-[rgba(255,255,255,0.6)]">
            Remove vocals, isolate stems, and turn your audio into a custom
            backing track. All in one place.
          </p>
        </div>

        <div className="mt-16">
          <div className="rounded-[24px] border border-[rgba(252,252,253,0.1)] bg-[rgba(14,15,17,0.8)] p-4 backdrop-blur-[12px]">
            {/* player bar */}
            <div className="flex h-[130px] items-center rounded-[20px] border border-[rgba(252,252,253,0.1)] px-6">
              <button
                type="button"
                className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white"
                aria-label="Play"
              >
                <Image src="/icons/play.svg" alt="" width={28} height={28} />
              </button>
              <div className="relative ml-6 h-10 flex-1 overflow-hidden">
                <Image
                  src="/wave.png"
                  alt="Audio waveform"
                  fill
                  className="object-cover object-left"
                />
              </div>
            </div>

            {/* stem grid */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stems.map((stem) => (
                <StemRow key={stem.icon} icon={stem.icon} fill={stem.fill} />
              ))}
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="#"
              className="flex h-[52px] w-[196px] items-center justify-center rounded-full bg-white text-[16px] font-medium text-black transition-opacity hover:opacity-90"
            >
              Upload Your Track
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
