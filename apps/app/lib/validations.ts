import * as z from "zod";

const email = z.email({ error: "Please enter a valid email." }).trim();

const password = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." });

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Password is required." }),
});

export const SignupSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters." })
    .trim(),
  email,
  password,
});

export const ForgotPasswordSchema = z.object({ email });

export const ResetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/** Shape returned by every auth Server Action to `useActionState`. */
export type AuthState = {
  error?: string;
  success?: string;
} | null;
