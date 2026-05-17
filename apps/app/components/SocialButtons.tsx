const SOCIALS = [
  { name: "Google", icon: "/auth/google.svg" },
  { name: "Facebook", icon: "/auth/facebook.svg" },
  { name: "Apple", icon: "/auth/apple.svg" },
  { name: "X", icon: "/auth/x.svg" },
];

export default function SocialButtons() {
  return (
    <div className="flex justify-center gap-3">
      {SOCIALS.map((s) => (
        <button
          key={s.name}
          type="button"
          aria-label={`Continue with ${s.name}`}
          className="flex h-11 w-[74px] items-center justify-center rounded-[10px] bg-[#edeef0] transition-opacity hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.icon} alt="" className="h-5 w-auto" />
        </button>
      ))}
    </div>
  );
}
