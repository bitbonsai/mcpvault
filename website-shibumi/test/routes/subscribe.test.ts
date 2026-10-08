import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { welcomeIdempotencyKey, type SubscribeResendClient } from "../../src/routes/subscribe";

const CONFIGURED_ENV = { RESEND_API_KEY: "re_test_key", RESEND_AUDIENCE_ID: "aud_test" };

interface SendCall {
  payload: { from: string; to: string[]; subject: string; html: string };
  options?: { idempotencyKey?: string };
}

function fakeClient(overrides?: {
  createError?: { message: string } | null;
  sendError?: { message: string } | null;
}): {
  client: SubscribeResendClient;
  createCalls: Array<{ audienceId: string; email: string }>;
  sendCalls: SendCall[];
} {
  const createCalls: Array<{ audienceId: string; email: string }> = [];
  const sendCalls: SendCall[] = [];
  const createError = overrides?.createError ?? null;
  const sendError = overrides?.sendError ?? null;

  return {
    createCalls,
    sendCalls,
    client: {
      contacts: {
        async create(payload) {
          createCalls.push(payload);
          return { error: createError };
        },
      },
      emails: {
        async send(payload, options) {
          sendCalls.push({ payload, options });
          return { error: sendError };
        },
      },
    },
  };
}

describe("POST /api/subscribe", () => {
  test("JSON body with a valid email subscribes and returns success", async () => {
    const { client, createCalls, sendCalls } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", website: "" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true });
    expect(createCalls).toEqual([{ audienceId: "aud_test", email: "person@example.com" }]);
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.payload.to).toEqual(["person@example.com"]);
  });

  test("form-urlencoded body with a valid email subscribes and returns success", async () => {
    const { client, createCalls } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=person%40example.com&website=",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(createCalls).toEqual([{ audienceId: "aud_test", email: "person@example.com" }]);
  });

  test("missing or filled honeypots return fake success without contacting Resend", async () => {
    const { client, createCalls, sendCalls } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });
    const requests = [
      { contentType: "application/json", body: JSON.stringify({ email: "person@example.com" }) },
      { contentType: "application/json", body: JSON.stringify({ email: "person@example.com", website: "https://spam.test" }) },
      { contentType: "application/x-www-form-urlencoded", body: "email=person%40example.com" },
      { contentType: "application/x-www-form-urlencoded", body: "email=person%40example.com&website=https%3A%2F%2Fspam.test" },
    ];

    for (const request of requests) {
      const res = await app.request("/api/subscribe", {
        method: "POST",
        headers: { "content-type": request.contentType },
        body: request.body,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    }

    expect(createCalls).toHaveLength(0);
    expect(sendCalls).toHaveLength(0);
  });

  test("normalizes email (trim + lowercase) before calling Resend, for both body formats", async () => {
    const { client, createCalls } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const jsonRes = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "  Person@Example.COM  ", website: "" }),
    });
    expect(jsonRes.status).toBe(200);

    const formRes = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=" + encodeURIComponent("  Other@Example.COM  ") + "&website=",
    });
    expect(formRes.status).toBe(200);

    expect(createCalls).toEqual([
      { audienceId: "aud_test", email: "person@example.com" },
      { audienceId: "aud_test", email: "other@example.com" },
    ]);
  });

  test("missing email field returns 400 without contacting Resend", async () => {
    const { client, createCalls } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ website: "" }),
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: false, message: "Enter a valid email address." });
    expect(createCalls).toHaveLength(0);
  });

  test("malformed email returns 400 without contacting Resend", async () => {
    const { client, createCalls } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", website: "" }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, message: "Enter a valid email address." });
    expect(createCalls).toHaveLength(0);
  });

  test("unsupported content-type is treated as a missing email (400)", async () => {
    const { client } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "email=person@example.com",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, message: "Enter a valid email address." });
  });

  test("malformed JSON body returns 400 instead of throwing", async () => {
    const { client } = fakeClient();
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, message: "Enter a valid email address." });
  });

  test("Resend contact creation error returns 500 and never attempts the welcome email", async () => {
    const { client, sendCalls } = fakeClient({ createError: { message: "boom" } });
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", website: "" }),
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: false, message: "Unable to save subscription." });
    expect(sendCalls).toHaveLength(0);
  });

  test("welcome email send error is tracked/logged but subscription still reports success", async () => {
    const { client, createCalls, sendCalls } = fakeClient({ sendError: { message: "delivery failed" } });
    const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", website: "" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(createCalls).toHaveLength(1);
    expect(sendCalls).toHaveLength(1);
  });

  test("missing Resend configuration returns 500 without throwing", async () => {
    const app = createApp({ subscribe: { env: {} } });

    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", website: "" }),
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, message: "Unable to save subscription." });
  });

  describe("welcome email", () => {
    test("is awaited (tracked) before the response is sent, not fire-and-forget", async () => {
      let resolveSend: (() => void) | undefined;
      let sendStarted = false;
      const createCalls: Array<{ audienceId: string; email: string }> = [];

      const client: SubscribeResendClient = {
        contacts: {
          async create(payload) {
            createCalls.push(payload);
            return { error: null };
          },
        },
        emails: {
          send() {
            sendStarted = true;
            return new Promise((resolve) => {
              resolveSend = () => resolve({ error: null });
            });
          },
        },
      };

      const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

      const responsePromise = Promise.resolve(
        app.request("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "person@example.com", website: "" }),
        }),
      );

      // Give the handler a tick to reach (and block on) the email send.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(sendStarted).toBe(true);

      let settled = false;
      responsePromise.then(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(settled).toBe(false); // still awaiting the unresolved send() promise

      resolveSend?.();
      const res = await responsePromise;
      expect(res.status).toBe(200);
    });

    test("carries a deterministic Idempotency-Key derived from the normalized email", async () => {
      const { client, sendCalls } = fakeClient();
      const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

      await app.request("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "  Person@Example.COM  ", website: "" }),
      });

      expect(sendCalls[0]?.options?.idempotencyKey).toBe(welcomeIdempotencyKey("person@example.com"));
    });

    test("retrying the same subscribe request reuses the same Idempotency-Key", async () => {
      const { client, sendCalls } = fakeClient();
      const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

      const body = JSON.stringify({ email: "person@example.com", website: "" });
      await app.request("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body });
      await app.request("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body });

      expect(sendCalls).toHaveLength(2);
      expect(sendCalls[0]?.options?.idempotencyKey).toBe(sendCalls[1]?.options?.idempotencyKey);
    });

    test("different emails get different Idempotency-Keys", () => {
      expect(welcomeIdempotencyKey("a@example.com")).not.toBe(welcomeIdempotencyKey("b@example.com"));
    });

    test("renders the unsubscribe link for the subscribed address", async () => {
      const { client, sendCalls } = fakeClient();
      const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

      await app.request("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "person@example.com", website: "" }),
      });

      expect(sendCalls[0]?.payload.html).toContain(
        "https://mcpvault.org/api/unsubscribe?email=person%40example.com",
      );
      expect(sendCalls[0]?.payload.html).not.toContain("{{unsubscribeUrl}}");
    });
  });

  describe("request size limit", () => {
    test("oversized JSON body is rejected with 413 before parsing", async () => {
      const { client, createCalls } = fakeClient();
      const app = createApp({ subscribe: { env: CONFIGURED_ENV, resendClient: client } });

      const oversized = JSON.stringify({ email: "person@example.com", website: "", padding: "x".repeat(8 * 1024) });
      const res = await app.request("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: oversized,
      });

      expect(res.status).toBe(413);
      expect(createCalls).toHaveLength(0);
    });
  });

  test("unsupported method is not treated as the route", async () => {
    const app = createApp({ subscribe: { env: CONFIGURED_ENV } });
    const res = await app.request("/api/subscribe", { method: "GET" });
    expect(res.status).toBe(404);
  });
});
