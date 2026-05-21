import { Inngest } from "inngest";
import type { RunpodEndpointKind } from "@/lib/runpod";

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
      /**
       * Which RunPod endpoint this job lives on — set by the producer so the
       * watcher polls the right /status URL. Optional for backwards-compat
       * with already-queued events; the watcher defaults to "separation"
       * when missing, which is what every existing in-flight event needs.
       */
      endpointKind?: RunpodEndpointKind;
    };
  };
  /**
   * Fired by the separation watcher right after a music_generation job
   * completes — kicks off auto-cover-art generation so the user doesn't
   * have to think about it. Cover failure is non-fatal: the song still
   * stands without one.
   */
  "app/cover.requested": {
    data: {
      jobId: string;
    };
  };
};
