import AuthCard from "@/components/AuthCard";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "New password · Moises" };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a new password for your Moises account."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
