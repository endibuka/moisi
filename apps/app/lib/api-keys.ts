import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Generates / hashes / displays personal API keys.
 *
 * Format: `mk_live_` + 32 random bytes hex (64 chars) — high entropy means
 * we can store a plain SHA-256 hash (no need for a slow KDF / pepper).
 *
 *   Plaintext: mk_live_3f1b...a3f1   (shown once, on creation)
 *   Storage:   hashed_key = sha256(plaintext)
 *              last_chars = "a3f1"        (Stripe-style suffix)
 *              prefix     = "mk_live_"    (always this for live keys)
 *
 * Lookup is O(1) on the hashed_key unique index. Display in the UI is built
 * from `prefix + bullets + last_chars` — the user identifies a key by its
 * last 4 chars without us ever showing the full secret again.
 */
export const API_KEY_PREFIX = "mk_live_";

export type GeneratedKey = {
  plaintext: string; // shown to the user ONCE at creation
  hashed: string; // stored in db, used for lookup
  prefix: string;
  lastChars: string;
};

/** Mint a new API key + return all the pieces we need to persist + display. */
export function generateApiKey(): GeneratedKey {
  const secret = randomBytes(32).toString("hex"); // 64 hex chars
  const plaintext = `${API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    hashed: hashApiKey(plaintext),
    prefix: API_KEY_PREFIX,
    lastChars: plaintext.slice(-4),
  };
}

/** SHA-256 hex of the plaintext — used both at creation and at auth time. */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Quick syntactic check before we even hash. Cheap reject for malformed input. */
export function looksLikeApiKey(value: string): boolean {
  return (
    value.startsWith(API_KEY_PREFIX) &&
    value.length === API_KEY_PREFIX.length + 64
  );
}

/** Display form: `mk_live_••••a3f1`. */
export function maskedKey(lastChars: string): string {
  return `${API_KEY_PREFIX}${"•".repeat(24)}${lastChars}`;
}
