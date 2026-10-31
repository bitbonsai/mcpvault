/**
 * Unit tests for the `newsletterSignup` Alpine.data() module.
 * `fetchImpl` is injected so these tests never touch the network/a real
 * `/api/subscribe` route.
 */
import { describe, expect, test } from "bun:test";
import { newsletterSignup } from "../../src/client/newsletter";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }): typeof fetch {
  return (async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (async () => ({ success: response.ok })),
  })) as unknown as typeof fetch;
}

function withTurnstileToken(data: ReturnType<typeof newsletterSignup>) {
  data.$root = { querySelector: () => ({ value: "test-token" }) as HTMLInputElement };
  return data;
}

describe("newsletterSignup()", () => {
  test("starts idle with an empty email", () => {
    const data = newsletterSignup(fakeFetch({ ok: true }));
    expect(data.email).toBe("");
    expect(data.website).toBe("");
    expect(data.status).toBe("idle");
  });

  test("submit() rejects an empty email without calling fetch", async () => {
    let called = false;
    const data = newsletterSignup((async () => {
      called = true;
      return { ok: true, json: async () => ({ success: true }) } as unknown as Response;
    }) as unknown as typeof fetch);
    data.email = "   ";
    await data.submit();
    expect(called).toBe(false);
    expect(data.status).toBe("error");
  });

  test("submit() succeeds, clears the email, and sets status to success", async () => {
    let requestBody: unknown;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return { ok: true, status: 200, json: async () => ({ success: true }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const data = withTurnstileToken(newsletterSignup(fetchImpl));
    data.email = "reader@example.com";
    await data.submit();

    expect(requestBody).toEqual({ email: "reader@example.com", website: "", turnstileToken: "test-token" });
    expect(data.status).toBe("success");
    expect(data.email).toBe("");
  });

  test("submit() rejects a missing Turnstile token without calling fetch", async () => {
    let called = false;
    const data = newsletterSignup((async () => {
      called = true;
      return { ok: true } as Response;
    }) as unknown as typeof fetch);
    data.email = "reader@example.com";
    await data.submit();
    expect(called).toBe(false);
    expect(data.status).toBe("error");
  });

  test("submit() sets status to error on a non-ok response", async () => {
    const data = withTurnstileToken(newsletterSignup(fakeFetch({ ok: false, status: 500 })));
    data.email = "reader@example.com";
    await data.submit();
    expect(data.status).toBe("error");
  });

  test("submit() sets status to error when the response body lacks success:true", async () => {
    const data = withTurnstileToken(newsletterSignup(fakeFetch({ ok: true, json: async () => ({ success: false }) })));
    data.email = "reader@example.com";
    await data.submit();
    expect(data.status).toBe("error");
  });

  test("submit() sets status to error when fetch itself rejects", async () => {
    const data = withTurnstileToken(newsletterSignup((async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch));
    data.email = "reader@example.com";
    await data.submit();
    expect(data.status).toBe("error");
  });

  test("submit() flips to submitting synchronously before the fetch settles", () => {
    let resolveFetch!: () => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = () => resolve({ ok: true, status: 200, json: async () => ({ success: true }) } as unknown as Response);
    });
    const data = withTurnstileToken(newsletterSignup((async () => pending) as unknown as typeof fetch));
    data.email = "reader@example.com";
    const submitPromise = data.submit();
    expect(data.status).toBe("submitting");
    resolveFetch();
    return submitPromise;
  });
});
