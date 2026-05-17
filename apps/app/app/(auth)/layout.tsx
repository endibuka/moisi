import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen gap-2 bg-black p-2">
      {/* left: testimonial panel — hidden on small screens */}
      <aside className="hidden w-[42%] max-w-[560px] shrink-0 flex-col gap-6 lg:flex">
        <div className="relative flex-1 overflow-hidden rounded-[12px] border border-[rgba(221,234,248,0.08)]">
          <Image
            src="/auth/testimonial.jpg"
            alt=""
            fill
            priority
            sizes="560px"
            className="object-cover"
          />
        </div>
        <div className="rounded-[12px] bg-[rgba(216,244,246,0.04)] p-6">
          <p className="text-[17px] leading-[26px] text-[rgba(252,253,255,0.94)]">
            &ldquo;I discovered Moises in 2021, and it was huge for me. As a
            professional, it saved me a lot of time practicing and learning new
            songs.&rdquo;
          </p>
          <p className="mt-4 text-[14px] leading-[20px] text-[rgba(229,237,253,0.48)]">
            Eloy Casagrande
            <br />
            (Slipknot&apos;s drummer)
          </p>
        </div>
      </aside>

      {/* right: form area */}
      <div className="relative flex flex-1 items-center justify-center overflow-y-auto px-6 py-16">
        {/* ambient cyan glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00dae8] opacity-[0.1] blur-[160px]" />
        <div className="relative">{children}</div>
      </div>
    </main>
  );
}
