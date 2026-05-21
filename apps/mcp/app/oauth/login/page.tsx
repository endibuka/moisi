"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const ACCENT = "#0affa7";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [next, setNext] = useNextParam(searchParams);
  const [state, formAction] = useActionState<LoginState, FormData>(login, null);

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-[20px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11] p-8">
        <p
          className="mb-2 text-[12px] font-semibold uppercase tracking-[1.5px]"
          style={{ color: ACCENT }}
        >
          Moisi MCP
        </p>
        <h1 className="text-[22px] font-medium tracking-tight">
          Sign in to authorize
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[rgba(252,252,253,0.6)]">
          Sign in with your Moisi account to let an MCP client access your
          tracks. This is the same email and password you use at the main
          dashboard.
        </p>

        {state?.error && (
          <p className="mt-4 rounded-[8px] border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.06)] px-3 py-2 text-[13px] text-[#ff8888]">
            {state.error}
          </p>
        )}

        <form action={formAction} className="mt-5 flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[rgba(252,252,253,0.6)]">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-10 rounded-[8px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[13px] text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,252,253,0.25)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[rgba(252,252,253,0.6)]">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 rounded-[8px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[13px] text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,252,253,0.25)]"
            />
          </label>
          <button
            type="submit"
            className="mt-2 flex h-10 items-center justify-center rounded-full text-[13px] font-medium text-[#001316]"
            style={{ background: ACCENT }}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

/* Tiny client helper — unwraps the searchParams promise so the form has the
   `next` hidden input ready on first paint. */
import { use, useState } from "react";

function useNextParam(
  sp: Promise<{ next?: string }>,
): [string, (v: string) => void] {
  const resolved = use(sp);
  const initial = resolved.next && resolved.next.startsWith("/") ? resolved.next : "/";
  return useState(initial);
}
