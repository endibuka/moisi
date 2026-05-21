import { getIssuer } from "@/lib/env";

export default function Home() {
  const issuer = getIssuer();
  return (
    <main className="mx-auto max-w-[720px] px-8 py-20">
      <h1 className="text-[32px] font-medium tracking-tight">Moisi MCP</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[rgba(252,252,253,0.6)]">
        Model Context Protocol server. Connect an MCP-compatible client (Claude,
        Cursor, etc.) to access Moisi tools — stem separation, job status,
        signed stem URLs — programmatically.
      </p>

      <section className="mt-10 rounded-[16px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-5">
        <h2 className="text-[14px] font-medium">Endpoint</h2>
        <code className="mt-2 block break-all font-mono text-[13px] text-[#0affa7]">
          {issuer}/mcp
        </code>
        <p className="mt-3 text-[12px] text-[rgba(252,252,253,0.6)]">
          Auth: OAuth 2.1 with PKCE + Dynamic Client Registration. Discovery at{" "}
          <code className="font-mono">{issuer}/.well-known/oauth-protected-resource</code>.
        </p>
      </section>

      <section className="mt-6 rounded-[16px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] p-5">
        <h2 className="text-[14px] font-medium">Tools exposed</h2>
        <ul className="mt-3 space-y-2 text-[13px]">
          <li>
            <code className="font-mono text-[#0affa7]">start_separation</code>
            <span className="ml-2 text-[rgba(252,252,253,0.6)]">
              — submit a track for stem separation.
            </span>
          </li>
          <li>
            <code className="font-mono text-[#0affa7]">list_jobs</code>
            <span className="ml-2 text-[rgba(252,252,253,0.6)]">
              — recent separation jobs for the authenticated user.
            </span>
          </li>
          <li>
            <code className="font-mono text-[#0affa7]">get_job_status</code>
            <span className="ml-2 text-[rgba(252,252,253,0.6)]">
              — current state of one job.
            </span>
          </li>
          <li>
            <code className="font-mono text-[#0affa7]">get_stem_url</code>
            <span className="ml-2 text-[rgba(252,252,253,0.6)]">
              — signed download URL for a completed stem.
            </span>
          </li>
        </ul>
      </section>
    </main>
  );
}
