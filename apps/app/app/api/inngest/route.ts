import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest hits this route to register functions and invoke them. Locally the
// Inngest dev server discovers this URL automatically; in production the
// Inngest cloud reaches it on the deployed Next.js host.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
