"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SocialButtons from "@/components/SocialButtons";
import SubmitButton from "@/components/SubmitButton";
import { login } from "../actions";

export default function LoginForm({
  initialError,
}: {
  initialError?: string;
}) {
  const [state, formAction] = useActionState(
    login,
    initialError ? { error: initialError } : null,
  );
  const [showEmail, setShowEmail] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <Alert error={state?.error} success={state?.success} />

      <SocialButtons />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[rgba(252,252,253,0.1)]" />
        <span className="text-[13px] text-[rgba(241,247,254,0.71)]">or</span>
        <span className="h-px flex-1 bg-[rgba(252,252,253,0.1)]" />
      </div>

      {showEmail ? (
        <form action={formAction} className="flex flex-col gap-4">
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <div className="flex flex-col gap-2">
            <Field
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <Link
              href="/forgot-password"
              className="self-end text-[13px] font-medium text-[rgba(252,252,253,0.6)] transition-colors hover:text-white"
            >
              Forgot password?
            </Link>
          </div>

          <div className="mt-1">
            <SubmitButton>Log in</SubmitButton>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="flex h-10 w-full items-center justify-center rounded-[10px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.05)] text-[14px] font-medium text-[#edeef0] transition-colors hover:bg-[rgba(252,252,253,0.08)]"
        >
          Continue with email
        </button>
      )}
    </div>
  );
}
