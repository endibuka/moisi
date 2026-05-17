import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-black px-8 pb-4 pt-4">
      <div className="relative h-[700px] overflow-hidden rounded-[32px] border border-[rgba(252,252,253,0.1)]">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/hero.mp4"
          poster="/hero.jpg"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black to-transparent" />

        <div className="relative flex h-full max-w-[760px] flex-col justify-center px-20">
          <h1 className="text-[73px] font-normal leading-[80px] tracking-[-1.6px] text-white">
            The Creative Suite
            <br />
            for Musicians
          </h1>
          <p className="mt-6 max-w-[540px] text-[18px] leading-[28px] font-medium text-[rgba(255,255,255,0.6)]">
            Moises is the essential toolkit for musicians to practice, perform,
            create and collaborate anywhere.
          </p>
          <div className="mt-8 flex items-center gap-2">
            <Link
              href="#"
              className="flex h-[52px] items-center rounded-full bg-[#00dae8] px-7 text-[16px] font-medium text-[#001316] transition-opacity hover:opacity-90"
            >
              Start Creating
            </Link>
            <Link
              href="#"
              className="flex h-[52px] items-center rounded-full border border-[rgba(255,255,255,0.15)] px-7 text-[17px] font-medium text-[#fcfcfd] transition-colors hover:bg-white/5"
            >
              Download Desktop App
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
