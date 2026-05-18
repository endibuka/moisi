import { Inngest } from "inngest";

/**
 * Inngest client for app/server-side event sending and function definitions.
 *
 * In production, `INNGEST_EVENT_KEY` (for sending) and `INNGEST_SIGNING_KEY`
 * (for the /api/inngest serve endpoint) are read from env. In local dev they
 * are unset and the Inngest CLI (`npx inngest-cli@latest dev`) handles auth.
 */
export const inngest = new Inngest({ id: "moisi-app" });

/**
 * Strongly-typed event payloads emitted by the app. Add new events here so
 * function definitions get autocompletion on `event.data`.
 */
export type AppEvents = {
  "app/separation.queued": {
    data: {
      jobId: string;
      runpodId: string;
    };
  };
};
