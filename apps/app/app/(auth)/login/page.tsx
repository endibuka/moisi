import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in · Moises" };

const ERRORS: Record<string, string> = {
  invalid_link: "That link is invalid or has expired. Please try again.",
  auth: "We couldn't sign you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Only honour same-origin paths so a crafted ?next can't bounce the user
  // off-site after they've entered credentials.
  const safeNext = next && next.startsWith("/") ? next : undefined;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to your Moises account to keep creating."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[#00dae8] transition-opacity hover:opacity-80"
          >
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm
        initialError={error ? ERRORS[error] : undefined}
        next={safeNext}
      />
    </AuthCard>
  );
}
