"use client";

import { useActionState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SubmitButton from "@/components/SubmitButton";
import { forgotPassword } from "../actions";

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Alert error={state?.error} success={state?.success} />

      {!state?.success && (
        <>
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <div className="mt-2">
            <SubmitButton>Send reset link</SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
