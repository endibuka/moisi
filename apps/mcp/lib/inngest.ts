import { Inngest } from "inngest";

/**
 * MCP-side Inngest client. Fires the same `app/separation.queued` event the
 * main Next.js app uses so the existing watcher functions (hosted at the
 * app's `/api/inngest`) pick up MCP-queued jobs without any new wiring.
 *
 * Locally the Inngest dev server intercepts events from both apps; in prod
 * INNGEST_EVENT_KEY must match between MCP + app deployments.
 */
export const inngest = new Inngest({ id: "moisi-mcp" });
