import { redirect } from "next/navigation";
import { createCode, getClient } from "@/lib/oauth-store";
import { createSupabaseServer } from "@/lib/supabase-server";

const ACCENT = "#0affa7";

type SearchParams = {
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
};

async function getUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Server action — Approve. Mint a one-shot authorization code bound to
 * (user_id, client_id, PKCE challenge), then bounce to the client's
 * registered redirect_uri with ?code=… &state=….
 */
async function approve(formData: FormData) {
  "use server";
  const client_id = String(formData.get("client_id") ?? "");
  const redirect_uri = String(formData.get("redirect_uri") ?? "");
  const code_challenge = String(formData.get("code_challenge") ?? "");
  const state = String(formData.get("state") ?? "");
  const scope = String(formData.get("scope") ?? "mcp:read mcp:write");

  const user = await getUser();
  if (!user) redirect("/oauth/login");

  const client = await getClient(client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    redirect("/?mcp=invalid_client");
  }

  const code = await createCode({
    client_id,
    redirect_uri,
    user_id: user!.id,
    code_challenge,
    scope,
  });

  const u = new URL(redirect_uri);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  redirect(u.toString());
}

async function deny(formData: FormData) {
  "use server";
  const redirect_uri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  if (!redirect_uri) redirect("/");
  const u = new URL(redirect_uri);
  u.searchParams.set("error", "access_denied");
  u.searchParams.set("error_description", "User declined the request.");
  if (state) u.searchParams.set("state", state);
  redirect(u.toString());
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) {
    const next = `/oauth/consent?${new URLSearchParams(sp as Record<string, string>).toString()}`;
    redirect(`/oauth/login?next=${encodeURIComponent(next)}`);
  }

  const client = sp.client_id ? await getClient(sp.client_id) : undefined;
  const clientName = client?.client_name || sp.client_id || "an unknown client";

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-[20px] border border-[rgba(252,252,253,0.1)] bg-[#0e0f11] p-8">
        <p
          className="mb-2 text-[12px] font-semibold uppercase tracking-[1.5px]"
          style={{ color: ACCENT }}
        >
          Authorize MCP client
        </p>
        <h1 className="text-[22px] font-medium tracking-tight">
          Allow{" "}
          <span style={{ color: ACCENT }}>{clientName}</span> to access your
          Moisi account?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[rgba(252,252,253,0.6)]">
          This will let the client read your separation jobs, start new ones,
          and download stems on your behalf. You can revoke access any time by
          rotating <code className="font-mono">MCP_JWT_SECRET</code>.
        </p>

        <div className="mt-5 rounded-[12px] border border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.03)] p-4 text-[12px]">
          <Row label="Signed in as" value={user!.email ?? user!.id} />
          <Row label="Scope" value={sp.scope || "mcp:read mcp:write"} />
          <Row label="Redirect" value={sp.redirect_uri ?? "—"} />
        </div>

        <form className="mt-6 flex gap-2">
          <input type="hidden" name="client_id" value={sp.client_id ?? ""} />
          <input type="hidden" name="redirect_uri" value={sp.redirect_uri ?? ""} />
          <input
            type="hidden"
            name="code_challenge"
            value={sp.code_challenge ?? ""}
          />
          <input type="hidden" name="state" value={sp.state ?? ""} />
          <input type="hidden" name="scope" value={sp.scope ?? ""} />
          <button
            formAction={deny}
            className="flex h-10 flex-1 items-center justify-center rounded-full border border-[rgba(252,252,253,0.1)] text-[13px] text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
          >
            Deny
          </button>
          <button
            formAction={approve}
            className="flex h-10 flex-1 items-center justify-center rounded-full text-[13px] font-medium text-[#001316]"
            style={{ background: ACCENT }}
          >
            Approve
          </button>
        </form>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="w-[80px] shrink-0 text-[rgba(252,252,253,0.6)]">
        {label}
      </span>
      <span className="flex-1 break-all text-[rgba(252,253,255,0.94)]">
        {value}
      </span>
    </div>
  );
}
