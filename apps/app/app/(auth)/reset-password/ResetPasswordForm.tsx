"use client";

import { useActionState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SubmitButton from "@/components/SubmitButton";
import { resetPassword } from "../actions";

export default function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Alert error={state?.error} success={state?.success} />

      <Field
        label="New password"
        name="password"
        type="password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        required
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="Re-enter your password"
        autoComplete="new-password"
        required
      />

      <div className="mt-2">
        <SubmitButton>Update password</SubmitButton>
      </div>
    </form>
  );
}
