import Image from "next/image";

const cards = [
  { img: "/community/card1.png", name: "Isaiah Weatherspoon", handle: "@isaiah.weatherspoon" },
  { img: "/community/card2.png", name: "Anastasia Pshokina", handle: "@ana.pshokina" },
  { img: "/community/card3.png", name: "Samurai Guitarist", handle: "@samuraiguitarist" },
  { img: "/community/card4.png", name: "Archie Beatz", handle: "@archiebeatz" },
];

const socials = [0, 1, 2, 3, 4, 5];

export default function Community() {
  return (
    <section className="bg-black px-8 py-10">
      <div className="mx-auto max-w-[1920px] px-10">
        <div className="text-center">
          <p className="text-[26px] leading-[33.6px] text-[rgba(252,252,253,0.6)]">
            #MadeWithMoises
          </p>
          <h2 className="mx-auto mt-4 max-w-[810px] text-[37px] leading-[40px] tracking-[-0.8px] text-white">
            See how our global community of creators uses Moises to make great
            musical moments.
          </h2>
          <div className="mt-7 flex justify-center gap-4">
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
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.name}
              className="relative aspect-[302/537] overflow-hidden rounded-[24px]"
            >
              <Image src={card.img} alt={card.name} fill className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 top-[55%] bg-gradient-to-b from-transparent to-black" />

              <div className="absolute left-6 top-6 flex h-[41px] items-center gap-1.5 rounded-full bg-[rgba(17,17,19,0.5)] px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/community/play.svg" alt="" className="size-4" />
                <span className="text-[17px] font-medium text-white">Play</span>
              </div>

              <div className="absolute inset-x-6 bottom-6">
                <p className="text-[22px] font-medium leading-[33.6px] text-white">
                  {card.name}
                </p>
                <p className="text-[15px] font-medium leading-[22.4px] text-[rgba(255,255,255,0.6)]">
                  {card.handle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
