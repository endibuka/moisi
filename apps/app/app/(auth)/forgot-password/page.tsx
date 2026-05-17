import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = { title: "Reset password · Moises" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={
        <Link
          href="/login"
          className="font-medium text-white transition-opacity hover:opacity-80"
        >
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
