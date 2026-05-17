import Image from "next/image";

export default function AwardsCarousel() {
  return (
    <section className="bg-black px-8 py-10">
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-6 px-10 lg:grid-cols-2">
        {/* text + award card */}
        <div className="relative aspect-square overflow-hidden rounded-[32px] border border-[rgba(252,252,253,0.1)]">
          <Image src="/awards/bg1.jpg" alt="" fill className="object-cover" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <h2 className="text-[59px] leading-[64px] tracking-[-1.28px] text-white">
              <span className="block">Recognized by</span>
              <span className="block">Apple as the iPad</span>
              <span className="block">App of the Year</span>
            </h2>
            <div className="flex items-center gap-12">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/awards/s1lL.svg" alt="" className="h-[88px] w-auto" />
                <div className="flex flex-col items-center gap-[6px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/awards/s1t1.svg" alt="" className="h-[12px] w-auto" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/awards/s1t2.svg" alt="" className="h-[12px] w-auto" />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/awards/s1lR.svg" alt="" className="h-[88px] w-auto" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/awards/im1.png" alt="" className="h-[88px] w-auto" />
            </div>
          </div>
        </div>

        {/* photo card */}
        <div className="relative aspect-square overflow-hidden rounded-[32px] border border-[rgba(252,252,253,0.1)]">
          <Image src="/awards/ph1.jpg" alt="" fill className="object-cover" />
        </div>
      </div>
    </section>
  );
}
