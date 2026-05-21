"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";

export type LoginState = { error?: string } | null;

/**
 * Server action: sign the user in via Supabase, then bounce them to the URL
 * passed in `next` (locked to same-origin for safety).
 */
export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
  }

  // Only follow same-origin redirects so a malicious `next` can't bounce the
  // user to a phishing page after they've already entered credentials.
  const safe = next.startsWith("/") ? next : "/";
  redirect(safe);
}
