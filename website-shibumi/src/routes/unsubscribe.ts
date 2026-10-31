/**
 * `GET /api/unsubscribe`.
 *
 * Ported from `website/src/pages/api/unsubscribe.ts` with behavior preserved
 * exactly for this migration phase: same query param, same normalization,
 * same status codes, same response bodies. Signed unsubscribe tokens are a
 * documented follow-up (see the migration plan) and are deliberately not
 * added here.
 */
import type { Hono } from "hono";

/** Minimal shape of the Resend client surface this route depends on, so a fake can be injected in tests. */
export interface UnsubscribeResendClient {
  contacts: {
    remove(payload: { audienceId: string; email: string }): Promise<{ error: { message: string } | null }>;
  };
}

export interface UnsubscribeRouteOptions {
  /** Overrides environment lookup; used to inject a fake client in tests. */
  resendClient?: UnsubscribeResendClient;
  /** Overrides `process.env` lookup; used in tests. */
  env?: Record<string, string | undefined>;
  /** Constructs the real client from an API key; overridable for tests that want to assert on construction. */
  createResendClient?: (apiKey: string) => UnsubscribeResendClient;
}

function resolveConfig(env: Record<string, string | undefined>): { apiKey: string; audienceId: string } {
  const apiKey = env.RESEND_API_KEY;
  const audienceId = env.RESEND_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    throw new Error("Missing Resend configuration (RESEND_API_KEY or RESEND_AUDIENCE_ID).");
  }

  return { apiKey, audienceId };
}

async function defaultCreateResendClient(apiKey: string): Promise<UnsubscribeResendClient> {
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

export function registerUnsubscribeRoute(app: Hono, options: UnsubscribeRouteOptions = {}): void {
  const env = options.env ?? process.env;

  app.get("/api/unsubscribe", async (c) => {
    const email = c.req.query("email");

    if (!email) {
      return c.html("<p>Missing email parameter.</p>", 400);
    }

    try {
      const { apiKey, audienceId } = resolveConfig(env);
      const client = options.resendClient ?? (await (options.createResendClient ?? defaultCreateResendClient)(apiKey));

      const { error } = await client.contacts.remove({
        audienceId,
        email: email.trim().toLowerCase(),
      });

      if (error) {
        console.error("[newsletter] unsubscribe error:", error.message);
      }

      c.header("cache-control", "no-store");
      return c.html(unsubscribePageHtml(), 200);
    } catch (err) {
      console.error("[newsletter] unsubscribe failed", err);
      return c.html("<p>Something went wrong. Please try again later.</p>", 500);
    }
  });
}

function unsubscribePageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Unsubscribed - MCPVault</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:80px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="background-color:#141414;border:1px solid #252525;border-radius:12px;padding:36px;text-align:center;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#ffffff;">You've been unsubscribed</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a0a0a0;">
            You won't receive any more emails from MCPVault. If this was a mistake, you can re-subscribe on the homepage.
          </p>
          <a href="https://mcpvault.org/" style="display:inline-block;padding:10px 24px;font-size:14px;font-weight:600;color:#ffffff;background-color:#7c3aed;border-radius:8px;text-decoration:none;">Back to mcpvault.org</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
