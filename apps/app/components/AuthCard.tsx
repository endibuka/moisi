import Link from "next/link";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="w-full max-w-[360px]">
      <Link href="/" className="mb-10 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Moises" className="h-8 w-auto" />
      </Link>

      <h1 className="text-center text-[24px] font-medium tracking-[-0.1px] text-[#edeef0]">
        {title}
      </h1>
      <p className="mt-2 text-center text-[14px] leading-[20px] text-[rgba(241,247,254,0.71)]">
        {subtitle}
      </p>

      <div className="mt-7">{children}</div>

      {footer && (
        <p className="mt-6 text-center text-[13px] text-[rgba(241,247,254,0.71)]">
          {footer}
        </p>
      )}
    </div>
  );
}
