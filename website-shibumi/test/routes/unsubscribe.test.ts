import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import type { UnsubscribeResendClient } from "../../src/routes/unsubscribe";

const CONFIGURED_ENV = { RESEND_API_KEY: "re_test_key", RESEND_AUDIENCE_ID: "aud_test" };

function fakeClient(result: { error: { message: string } | null }): {
  client: UnsubscribeResendClient;
  calls: Array<{ audienceId: string; email: string }>;
} {
  const calls: Array<{ audienceId: string; email: string }> = [];
  return {
    calls,
    client: {
      contacts: {
        async remove(payload) {
          calls.push(payload);
          return result;
        },
      },
    },
  };
}

describe("GET /api/unsubscribe", () => {
  test("missing email returns 400 with the exact message", async () => {
    const app = createApp({ unsubscribe: { env: CONFIGURED_ENV } });
    const res = await app.request("/api/unsubscribe");
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toBe("<p>Missing email parameter.</p>");
  });

  test("normalizes email (trim + lowercase) before calling Resend", async () => {
    const { client, calls } = fakeClient({ error: null });
    const app = createApp({ unsubscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/unsubscribe?email=" + encodeURIComponent("  Person@Example.COM  "));

    expect(res.status).toBe(200);
    expect(calls).toEqual([{ audienceId: "aud_test", email: "person@example.com" }]);
  });

  test("Resend error is logged but still returns the success page (preserves current behavior)", async () => {
    const { client } = fakeClient({ error: { message: "contact not found" } });
    const app = createApp({ unsubscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/unsubscribe?email=person@example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("You've been unsubscribed");
  });

  test("successful removal returns 200 html with the unsubscribed page and no-store", async () => {
    const { client, calls } = fakeClient({ error: null });
    const app = createApp({ unsubscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/unsubscribe?email=person@example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(calls).toEqual([{ audienceId: "aud_test", email: "person@example.com" }]);
    const body = await res.text();
    expect(body).toContain("<title>Unsubscribed - MCPVault</title>");
    expect(body).toContain('href="https://mcpvault.org/"');
  });

  test("missing Resend configuration returns 500 with the exact message", async () => {
    const app = createApp({ unsubscribe: { env: {} } });
    const res = await app.request("/api/unsubscribe?email=person@example.com");
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("<p>Something went wrong. Please try again later.</p>");
  });

  test("unsupported method is not treated as the route", async () => {
    const app = createApp({ unsubscribe: { env: CONFIGURED_ENV } });
    const res = await app.request("/api/unsubscribe?email=person@example.com", { method: "POST" });
    expect(res.status).toBe(404);
  });
});
