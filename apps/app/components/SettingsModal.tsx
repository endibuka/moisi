"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ApiKeySummary,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/app/actions/api-keys";
import Modal from "./Modal";
import { ScrollArea } from "@/components/ui/scroll-area";

type TabId = "account" | "billing" | "api" | "mcp" | "notifications";

type IconProps = { className?: string };
const ic = "h-4 w-4 shrink-0";

function IconUser({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function IconCard({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  );
}
function IconKey({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="14" r="4" />
      <path d="M10.5 11.5 21 1m-5 5 3 3m-5-1 3 3" />
    </svg>
  );
}
function IconPlug({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4" />
    </svg>
  );
}
function IconBell({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9ZM10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconClose({ className = ic }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

const TABS: { id: TabId; label: string; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { id: "account", label: "Account", Icon: IconUser },
  { id: "billing", label: "Billing", Icon: IconCard },
  { id: "api", label: "API", Icon: IconKey },
  { id: "mcp", label: "MCP", Icon: IconPlug },
  { id: "notifications", label: "Notifications", Icon: IconBell },
];

export default function SettingsModal({
  open,
  onClose,
  userName,
  userEmail,
  initialTab = "account",
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  initialTab?: TabId;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Settings" size="xl">
      <div className="flex h-[640px] max-h-[80vh]">
        {/* Tab nav */}
        <nav className="flex w-[224px] shrink-0 flex-col gap-0.5 border-r border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.02)] p-4">
          <h2 className="px-2 pb-3 text-[18px] font-medium text-[#fcfcfd]">
            Settings
          </h2>
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex h-9 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] transition-colors ${
                  active
                    ? "bg-[rgba(252,252,253,0.08)] text-[#fcfcfd]"
                    : "text-[rgba(252,252,253,0.6)] hover:bg-[rgba(252,252,253,0.04)] hover:text-[#fcfcfd]"
                }`}
              >
                <Icon />
                <span className="flex-1 text-left">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-[rgba(252,252,253,0.6)] transition-colors hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]"
          >
            <IconClose />
          </button>

          <ScrollArea className="h-full">
            <div className="px-8 py-6">
              {activeTab === "account" && (
                <AccountTab userName={userName} userEmail={userEmail} />
              )}
              {activeTab === "billing" && <BillingTab />}
              {activeTab === "api" && <ApiTab />}
              {activeTab === "mcp" && <McpTab />}
              {activeTab === "notifications" && <NotificationsTab />}
            </div>
          </ScrollArea>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- shared bits ---------------- */

function TabHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-6">
      <h3 className="text-[22px] font-medium text-[#fcfcfd]">{title}</h3>
      <p className="mt-1 text-[13px] text-[rgba(252,252,253,0.6)]">{subtitle}</p>
    </header>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-[16px] border border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.03)] p-5">
      <div className="mb-3">
        <h4 className="text-[14px] font-medium text-[#fcfcfd]">{title}</h4>
        {description && (
          <p className="mt-1 text-[12px] text-[rgba(252,252,253,0.6)]">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="mb-1.5 block text-[12px] font-medium text-[rgba(252,252,253,0.6)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  readOnly,
  placeholder,
}: {
  value?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      defaultValue={value}
      readOnly={readOnly}
      placeholder={placeholder}
      className="h-9 w-full rounded-[8px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[13px] text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,252,253,0.25)]"
    />
  );
}

function PillButton({
  children,
  variant = "secondary",
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
}) {
  const styles =
    variant === "primary"
      ? "bg-[#00dae8] text-[#001316] hover:opacity-90"
      : variant === "danger"
        ? "border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.06)] text-[#ff8888] hover:bg-[rgba(255,107,107,0.12)]"
        : "border border-[rgba(252,252,253,0.1)] text-[rgba(252,252,253,0.85)] hover:bg-[rgba(252,252,253,0.05)] hover:text-[#fcfcfd]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-medium transition-colors ${styles}`}
    >
      {children}
    </button>
  );
}

function RowBetween({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">{children}</div>
  );
}

/* ---------------- tabs ---------------- */

function AccountTab({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  return (
    <>
      <TabHeader
        title="Account"
        subtitle="Manage your profile and authentication."
      />

      <Section title="Profile">
        <div className="mb-5 flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-[#00dae8] text-[20px] font-medium text-[#001316]">
            {userName.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-[14px] text-[#fcfcfd]">{userName}</p>
            <p className="text-[12px] text-[rgba(252,252,253,0.6)]">
              Free plan · Member since 2026
            </p>
          </div>
          <div className="ml-auto">
            <PillButton>Change photo</PillButton>
          </div>
        </div>
        <Field label="Display name">
          <Input value={userName} />
        </Field>
        <Field label="Email">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input value={userEmail} readOnly />
            </div>
            <PillButton>Change</PillButton>
          </div>
        </Field>
      </Section>

      <Section
        title="Security"
        description="Authentication and active sessions."
      >
        <RowBetween>
          <div>
            <p className="text-[13px] text-[#fcfcfd]">Password</p>
            <p className="text-[12px] text-[rgba(252,252,253,0.6)]">
              Last changed 2 months ago
            </p>
          </div>
          <PillButton>Change password</PillButton>
        </RowBetween>
        <div className="my-4 h-px bg-[rgba(252,252,253,0.06)]" />
        <RowBetween>
          <div>
            <p className="text-[13px] text-[#fcfcfd]">Two-factor auth</p>
            <p className="text-[12px] text-[rgba(252,252,253,0.6)]">
              Not configured
            </p>
          </div>
          <PillButton>Enable 2FA</PillButton>
        </RowBetween>
      </Section>

      <Section
        title="Danger zone"
        description="These actions cannot be undone."
      >
        <RowBetween>
          <div>
            <p className="text-[13px] text-[#fcfcfd]">Delete account</p>
            <p className="text-[12px] text-[rgba(252,252,253,0.6)]">
              Permanently remove your account and all stems.
            </p>
          </div>
          <PillButton variant="danger">Delete account</PillButton>
        </RowBetween>
      </Section>
    </>
  );
}

function BillingTab() {
  return (
    <>
      <TabHeader
        title="Billing"
        subtitle="Your current plan, payment method, and invoices."
      />

      <Section title="Current plan">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[18px] font-medium text-[#fcfcfd]">Free</p>
              <span className="rounded-[3px] bg-[rgba(252,253,255,0.08)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgba(241,247,254,0.71)]">
                Current
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[rgba(252,252,253,0.6)]">
              5 separations / month · 30 MB upload size
            </p>
          </div>
          <PillButton variant="primary">Upgrade to Pro</PillButton>
        </div>

        <div className="mt-5 rounded-[10px] bg-[rgba(252,252,253,0.04)] p-4">
          <RowBetween>
            <span className="text-[12px] text-[rgba(252,252,253,0.6)]">
              Separations this month
            </span>
            <span className="text-[12px] tabular-nums text-[#fcfcfd]">
              3 / 5
            </span>
          </RowBetween>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(252,252,253,0.08)]">
            <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-[#00dae8] to-[#0affa7]" />
          </div>
        </div>
      </Section>

      <Section
        title="Payment method"
        description="Used for plan renewals and overages."
      >
        <RowBetween>
          <p className="text-[13px] text-[rgba(252,252,253,0.6)]">
            No card on file
          </p>
          <PillButton>Add payment method</PillButton>
        </RowBetween>
      </Section>

      <Section title="Invoices">
        <p className="text-[12px] text-[rgba(252,252,253,0.6)]">
          You don&apos;t have any invoices yet.
        </p>
      </Section>
    </>
  );
}

function ApiTab() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{
    plaintext: string;
    lastChars: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setKeys(await listApiKeys());
    setLoading(false);
  }, []);

  useEffect(() => {
    // One-time fetch on mount — alternatives (TanStack Query, ref-derived
    // state) are overkill for a single settings tab; suppressing the
    // set-state-in-effect rule here is the lesser cost.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const onCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    const result = await createApiKey(trimmed);
    setCreating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setJustCreated({
      plaintext: result.key.plaintext,
      lastChars: result.key.lastChars,
    });
    setNewName("");
    setCreateOpen(false);
    void load();
  };

  const onRevoke = async (id: string) => {
    setRevoking(id);
    await revokeApiKey(id);
    setRevoking(null);
    void load();
  };

  const copyPlaintext = async () => {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  // Stripe-style display: prefix + bullets + last 4. Inlined here so the UI
  // doesn't have to pull from a server-only module.
  const masked = (lastChars: string) =>
    `mk_live_${"•".repeat(24)}${lastChars}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <>
      <TabHeader
        title="API"
        subtitle="Programmatic access to your tracks and separations."
      />

      <Section title="Endpoint" description="Base URL for the Moisi API.">
        <Input value="/api/v1" readOnly />
      </Section>

      {justCreated && (
        <Section
          title="Your new API key"
          description="This is the only time we'll show the full key. Save it somewhere safe."
        >
          <div className="rounded-[12px] border border-[rgba(0,218,232,0.3)] bg-[rgba(0,218,232,0.06)] p-4">
            <p className="break-all font-mono text-[12.5px] leading-relaxed text-[#fcfcfd]">
              {justCreated.plaintext}
            </p>
            <div className="mt-3 flex gap-2">
              <PillButton onClick={copyPlaintext}>
                {copied ? "Copied" : "Copy"}
              </PillButton>
              <PillButton
                variant="primary"
                onClick={() => setJustCreated(null)}
              >
                I&apos;ve saved it
              </PillButton>
            </div>
          </div>
        </Section>
      )}

      <Section
        title="API keys"
        description="Keys give full access to your account. Treat them like passwords."
      >
        {loading ? (
          <p className="text-[12px] text-[rgba(252,252,253,0.5)]">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-[12px] text-[rgba(252,252,253,0.5)]">
            No keys yet. Create one to start hitting the API.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((key) => {
              const revoked = !!key.revoked_at;
              return (
                <div
                  key={key.id}
                  className={`rounded-[10px] border p-4 transition-opacity ${
                    revoked
                      ? "border-[rgba(252,252,253,0.04)] bg-[rgba(252,252,253,0.01)] opacity-60"
                      : "border-[rgba(252,252,253,0.06)] bg-[rgba(252,252,253,0.02)]"
                  }`}
                >
                  <RowBetween>
                    <div className="min-w-0">
                      <p className="text-[13px] text-[#fcfcfd]">
                        {key.name}
                        {revoked && (
                          <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-[rgba(252,252,253,0.4)]">
                            Revoked
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] tabular-nums text-[rgba(252,252,253,0.6)]">
                        {masked(key.last_chars)}
                      </p>
                      <p className="mt-1 text-[11px] text-[rgba(252,252,253,0.4)]">
                        Created {fmtDate(key.created_at)} ·{" "}
                        {key.last_used_at
                          ? `last used ${fmtDate(key.last_used_at)}`
                          : "never used"}
                      </p>
                    </div>
                    {!revoked && (
                      <PillButton
                        variant="danger"
                        onClick={() => onRevoke(key.id)}
                      >
                        {revoking === key.id ? "Revoking…" : "Revoke"}
                      </PillButton>
                    )}
                  </RowBetween>
                </div>
              );
            })}
          </div>
        )}

        {createOpen ? (
          <div className="mt-3 flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onCreate();
                if (e.key === "Escape") {
                  setCreateOpen(false);
                  setNewName("");
                }
              }}
              placeholder="e.g. Production server"
              maxLength={80}
              className="h-9 flex-1 rounded-full border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.03)] px-3 text-[13px] text-[#fcfcfd] outline-none placeholder:text-[rgba(252,252,253,0.3)] focus:border-[rgba(252,252,253,0.25)]"
            />
            <PillButton variant="primary" onClick={onCreate}>
              {creating ? "Creating…" : "Create"}
            </PillButton>
            <PillButton
              onClick={() => {
                setCreateOpen(false);
                setNewName("");
                setError(null);
              }}
            >
              Cancel
            </PillButton>
          </div>
        ) : (
          <div className="mt-3">
            <PillButton
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              + Create new key
            </PillButton>
          </div>
        )}

        {error && (
          <p className="mt-2 text-[12px] text-[#ff8a8a]">{error}</p>
        )}
      </Section>

      <Section title="Quick start">
        <pre className="overflow-x-auto rounded-[8px] border border-[rgba(252,252,253,0.06)] bg-[#000] p-3 text-[12px] leading-relaxed text-[rgba(252,252,253,0.85)]">
{`# 1. Get a signed upload URL
curl -X POST /api/v1/uploads \\
  -H "Authorization: Bearer mk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"filename":"song.mp3"}'

# 2. PUT your audio to the returned uploadUrl, then:
curl -X POST /api/v1/separations \\
  -H "Authorization: Bearer mk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"inputPath":"<path from step 1>","originalName":"song.mp3"}'

# 3. Poll the job until status === "completed"
curl /api/v1/separations/<id> \\
  -H "Authorization: Bearer mk_live_…"`}
        </pre>
      </Section>
    </>
  );
}

function McpTab() {
  return (
    <>
      <TabHeader
        title="MCP"
        subtitle="Connect external services via the Model Context Protocol."
      />

      <Section
        title="Connected servers"
        description="Each MCP server exposes its own toolset to your AI workflows."
      >
        <McpRow name="Stripe" subtitle="Payments, customers, invoices" status="disconnected" />
        <McpRow name="Supabase" subtitle="Database, storage, auth" status="connected" />
        <McpRow name="RunPod" subtitle="GPU compute and serverless jobs" status="connected" />
        <McpRow name="Slack" subtitle="Channels, messages, users" status="disconnected" last />
      </Section>

      <Section
        title="Add a custom server"
        description="Point at any compatible MCP server URL."
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <Input placeholder="https://my-mcp-server.example.com" />
          </div>
          <PillButton variant="primary">Add</PillButton>
        </div>
      </Section>
    </>
  );
}

function McpRow({
  name,
  subtitle,
  status,
  last,
}: {
  name: string;
  subtitle: string;
  status: "connected" | "disconnected";
  last?: boolean;
}) {
  return (
    <>
      <RowBetween>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-[rgba(252,252,253,0.05)] text-[12px] font-medium text-[rgba(252,252,253,0.6)]">
            {name.charAt(0)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] text-[#fcfcfd]">{name}</p>
              {status === "connected" ? (
                <span className="flex items-center gap-1 text-[11px] text-[#0affa7]">
                  <span className="size-1.5 rounded-full bg-[#0affa7] shadow-[0_0_6px_rgba(10,255,167,0.6)]" />
                  Connected
                </span>
              ) : (
                <span className="text-[11px] text-[rgba(252,252,253,0.3)]">
                  Not connected
                </span>
              )}
            </div>
            <p className="text-[12px] text-[rgba(252,252,253,0.6)]">
              {subtitle}
            </p>
          </div>
        </div>
        <PillButton variant={status === "connected" ? "danger" : "secondary"}>
          {status === "connected" ? "Disconnect" : "Connect"}
        </PillButton>
      </RowBetween>
      {!last && <div className="my-3 h-px bg-[rgba(252,252,253,0.04)]" />}
    </>
  );
}

function NotificationsTab() {
  return (
    <>
      <TabHeader
        title="Notifications"
        subtitle="Pick the emails we'll send."
      />

      <Section title="Email">
        <ToggleRow
          title="Separation finished"
          subtitle="Get an email the moment a track completes."
          defaultOn
        />
        <ToggleRow
          title="Weekly digest"
          subtitle="Summary of your activity every Monday."
        />
        <ToggleRow
          title="Product updates"
          subtitle="New features, new models, important changes."
          defaultOn
        />
        <ToggleRow
          title="Tips & inspiration"
          subtitle="Occasional hints on getting better results."
          last
        />
      </Section>
    </>
  );
}

function ToggleRow({
  title,
  subtitle,
  defaultOn,
  last,
}: {
  title: string;
  subtitle: string;
  defaultOn?: boolean;
  last?: boolean;
}) {
  const [on, setOn] = useState(Boolean(defaultOn));
  return (
    <>
      <RowBetween>
        <div className="pr-4">
          <p className="text-[13px] text-[#fcfcfd]">{title}</p>
          <p className="text-[12px] text-[rgba(252,252,253,0.6)]">{subtitle}</p>
        </div>
        <Toggle on={on} onChange={setOn} label={title} />
      </RowBetween>
      {!last && <div className="my-3 h-px bg-[rgba(252,252,253,0.04)]" />}
    </>
  );
}

/**
 * iOS-style toggle. 28px tall track with a 24px thumb, inset shadow on the
 * track, a soft drop shadow on the thumb, and a focus ring for keyboard
 * users. The thumb translates exactly `track_width - thumb_width - 2*inset`
 * (= 22px) so the off/on positions are visually symmetric.
 */
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00dae8]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0f11] ${
        on
          ? "bg-[#00dae8] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
          : "bg-[rgba(252,252,253,0.08)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.35),0_1px_1px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-out ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
