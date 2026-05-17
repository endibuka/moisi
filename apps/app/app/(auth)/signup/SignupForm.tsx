"use client";

import { useActionState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SubmitButton from "@/components/SubmitButton";
import { signup } from "../actions";

export default function SignupForm() {
  const [state, formAction] = useActionState(signup, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Alert error={state?.error} success={state?.success} />

      {!state?.success && (
        <>
          <Field
            label="Name"
            name="name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />

          <div className="mt-2">
            <SubmitButton>Create account</SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
