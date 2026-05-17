import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import SignupForm from "./SignupForm";

export const metadata = { title: "Sign up · Moises" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start making great musical moments with Moises."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[#00dae8] transition-opacity hover:opacity-80"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
