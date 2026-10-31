/**
 * Local dev server with a mocked Resend client, so the newsletter
 * subscribe/unsubscribe flow can be exercised in a browser without real
 * credentials. Every Resend call is logged to the console instead of
 * hitting the API. Never used in production; the container runs server.ts.
 *
 *   bun scripts/dev-mock.ts            # http://localhost:8788
 *   PORT=9000 bun scripts/dev-mock.ts
 */
import { createApp } from "../src/app";

const mockEnv = { RESEND_API_KEY: "mock", RESEND_AUDIENCE_ID: "mock" };

const app = createApp({
  subscribe: {
    env: mockEnv,
    resendClient: {
      contacts: {
        async create(payload) {
          console.log(`[mock resend] contacts.create ${payload.email}`);
          return { error: null };
        },
      },
      emails: {
        async send(payload, options) {
          console.log(
            `[mock resend] emails.send to=${payload.to.join(",")} subject="${payload.subject}" idempotencyKey=${options?.idempotencyKey}`,
          );
          return { error: null };
        },
      },
    },
  },
  unsubscribe: {
    env: mockEnv,
    resendClient: {
      contacts: {
        async remove(payload) {
          console.log(`[mock resend] contacts.remove ${payload.email}`);
          return { error: null };
        },
      },
    },
  },
});

const port = Number(process.env.PORT ?? 8788);
Bun.serve({ port, fetch: app.fetch });
console.log(`website-shibumi (mock Resend) listening on http://localhost:${port}`);
