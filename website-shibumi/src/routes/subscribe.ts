/**
 * `POST /api/subscribe`.
 *
 * Ported from `website/src/pages/api/subscribe.ts` and hardened per the
 * migration plan:
 * - accepts JSON and form-urlencoded bodies (the no-JS form falls back to
 *   the latter; `newsletterSignup` in `client/newsletter.ts` sends JSON);
 * - validates and normalizes the email with Zod (trim + lowercase, then
 *   format-check) instead of a hand-rolled regex;
 * - the Resend client is injectable so tests never hit the network;
 * - every Resend `{ error }` result is checked and logged;
 * - the welcome email is awaited (tracked), never an untracked
 *   fire-and-forget promise, and carries a deterministic per-email
 *   `Idempotency-Key` so a retried request cannot double-send it;
 * - Cloudflare Turnstile is verified server-side before any Resend call;
 * - security decisions use structured `[newsletter-security]` logs without
 *   email addresses or tokens;
 * - the request body is capped before it is ever parsed.
 *
 * The contact-creation step is the source of truth for "did the signup
 * succeed" -- if it succeeds but the welcome email fails to send, the
 * error is logged and the signup still reports success, matching the
 * production behavior this replaces (welcome-email delivery was already
 * best-effort there; the only change here is that failures are tracked
 * and logged instead of swallowed by an un-awaited `.catch()`).
 *
 * CSRF posture (documented decision, per the migration plan's security
 * matrix): this endpoint deliberately ships without a CSRF token. The site
 * has no session or cookie authentication anywhere, so a cross-site forged
 * POST carries no ambient credentials and gains an attacker nothing beyond
 * what a direct anonymous POST already allows: subscribing an email
 * address, which the recipient can self-service unsubscribe. Abuse is
 * bounded by server-verified Turnstile, the honeypot, the 4 KB body cap,
 * and edge rate limiting.
 *
 * Rate limiting (documented decision): the container is stateless, so any
 * in-memory limiter resets on every restart and is best-effort at most.
 * Primary rate limiting is a Cloudflare WAF rate rule on the mcpvault.org
 * zone, configured at the edge (not code in this repo) before cutover:
 *   match:  http.request.uri.path eq "/api/subscribe" and
 *           http.request.method eq "POST"
 *   rate:   5 requests per 60 seconds per client IP
 *   action: block for 10 minutes
 */
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

/** Minimal shape of the Resend client surface this route depends on, so a fake can be injected in tests. */
export interface SubscribeResendClient {
  contacts: {
    create(payload: { audienceId: string; email: string }): Promise<{ error: { message: string } | null }>;
  };
  emails: {
    send(
      payload: { from: string; to: string[]; subject: string; html: string },
      options?: { idempotencyKey?: string },
    ): Promise<{ error: { message: string } | null }>;
  };
}

export interface TurnstileVerification {
  success: boolean;
  hostname?: string;
  action?: string;
  errorCodes?: string[];
}

export interface NewsletterSecurityEvent {
  ts: string;
  outcome: "accepted" | "blocked" | "error" | "passed";
  reason: string;
  ip: string;
  country: string;
  ray: string;
  errorCodes?: string[];
}

export interface SubscribeRouteOptions {
  /** Overrides environment lookup; used to inject a fake client in tests. */
  resendClient?: SubscribeResendClient;
  /** Overrides `process.env` lookup; used in tests. */
  env?: Record<string, string | undefined>;
  /** Constructs the real client from an API key; overridable for tests that want to assert on construction. */
  createResendClient?: (apiKey: string) => SubscribeResendClient;
  /** Verifies a Turnstile token; overridable so tests never call Cloudflare. */
  verifyTurnstile?: (secret: string, token: string, remoteIp: string) => Promise<TurnstileVerification>;
  /** Receives structured security events; defaults to prefixed JSON on stdout. */
  securityLogger?: (event: NewsletterSecurityEvent) => void;
  /** Absolute path to the welcome email HTML template; defaults to `src/emails/welcome.html`. */
  welcomeTemplatePath?: string;
}

// One email address, JSON or urlencoded, never needs more than this; also
// bounds the in-memory buffering the size-limit middleware does below.
const MAX_BODY_BYTES = 4 * 1024;

const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";
const VERIFICATION_FAILED_MESSAGE = "Complete verification and try again.";
const SUBSCRIBE_FAILED_MESSAGE = "Unable to save subscription.";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

function resolveConfig(env: Record<string, string | undefined>): { apiKey: string; audienceId: string } {
  const apiKey = env.RESEND_API_KEY;
  const audienceId = env.RESEND_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    throw new Error("Missing Resend configuration (RESEND_API_KEY or RESEND_AUDIENCE_ID).");
  }

  return { apiKey, audienceId };
}

async function defaultCreateResendClient(apiKey: string): Promise<SubscribeResendClient> {
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

async function defaultVerifyTurnstile(secret: string, token: string, remoteIp: string): Promise<TurnstileVerification> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Turnstile siteverify returned HTTP ${response.status}`);

  const result = (await response.json()) as {
    success?: unknown;
    hostname?: unknown;
    action?: unknown;
    "error-codes"?: unknown;
  };
  return {
    success: result.success === true,
    hostname: typeof result.hostname === "string" ? result.hostname : undefined,
    action: typeof result.action === "string" ? result.action : undefined,
    errorCodes: Array.isArray(result["error-codes"])
      ? result["error-codes"].filter((value): value is string => typeof value === "string")
      : undefined,
  };
}

function defaultSecurityLogger(event: NewsletterSecurityEvent): void {
  if (process.env.NODE_ENV !== "test") console.log(`[newsletter-security] ${JSON.stringify(event)}`);
}

interface SubscribeFields {
  email: string | null;
  website: string | null;
  turnstileToken: string | null;
}

/** Extracts form fields from JSON or form-urlencoded bodies; anything else yields null. */
async function readSubscribeFields(request: Request): Promise<SubscribeFields | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const parsed: unknown = await request.json().catch(() => null);
    if (!parsed || typeof parsed !== "object") return null;
    const { email, website, turnstileToken } = parsed as { email?: unknown; website?: unknown; turnstileToken?: unknown };
    return {
      email: typeof email === "string" ? email : null,
      website: typeof website === "string" ? website : null,
      turnstileToken: typeof turnstileToken === "string" ? turnstileToken : null,
    };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const fields = new URLSearchParams(await request.text());
    return {
      email: fields.get("email"),
      website: fields.get("website"),
      turnstileToken: fields.get("cf-turnstile-response"),
    };
  }

  return null;
}

/**
 * Deterministic per-email idempotency key. Retrying the same subscribe
 * attempt (same normalized email) reuses this key, so Resend's idempotency
 * window prevents a duplicate welcome-email send; a genuinely new
 * subscribe attempt for the same address after that window still gets a
 * fresh delivery, since idempotency keys are time-boxed on Resend's side.
 */
export function welcomeIdempotencyKey(email: string): string {
  return `newsletter-welcome:${email}`;
}

async function loadWelcomeHtml(templatePath: string, email: string): Promise<string> {
  const template = await Bun.file(templatePath).text();
  const unsubscribeUrl = `https://mcpvault.org/api/unsubscribe?email=${encodeURIComponent(email)}`;
  return template.replaceAll("{{unsubscribeUrl}}", unsubscribeUrl);
}

export function registerSubscribeRoute(app: Hono, options: SubscribeRouteOptions = {}): void {
  const env = options.env ?? process.env;
  const welcomeTemplatePath =
    options.welcomeTemplatePath ?? new URL("../emails/welcome.html", import.meta.url).pathname;
  const verifyTurnstile = options.verifyTurnstile ?? defaultVerifyTurnstile;
  const securityLogger = options.securityLogger ?? defaultSecurityLogger;

  app.post(
    "/api/subscribe",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => {
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: "Request body too large." }, 413);
      },
    }),
    async (c) => {
      const logSecurity = (outcome: NewsletterSecurityEvent["outcome"], reason: string, errorCodes?: string[]) =>
        securityLogger({
          ts: new Date().toISOString(),
          outcome,
          reason,
          ip: c.req.header("cf-connecting-ip") ?? "",
          country: c.req.header("cf-ipcountry") ?? "",
          ray: c.req.header("cf-ray") ?? "",
          ...(errorCodes?.length ? { errorCodes } : {}),
        });
      const fields = await readSubscribeFields(c.req.raw).catch(() => null);

      if (!fields) {
        logSecurity("blocked", "invalid-body");
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: INVALID_EMAIL_MESSAGE }, 400);
      }

      // Missing catches direct callers using the old payload; filled catches form bots.
      if (fields.website !== "") {
        logSecurity("blocked", "honeypot");
        c.header("cache-control", "no-store");
        return c.json({ success: true }, 200);
      }

      const parsed = fields.email === null ? null : emailSchema.safeParse(fields.email);
      if (!parsed || !parsed.success) {
        logSecurity("blocked", "invalid-email");
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: INVALID_EMAIL_MESSAGE }, 400);
      }

      const token = fields.turnstileToken?.trim() ?? "";
      if (!token) {
        logSecurity("blocked", "turnstile-missing");
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: VERIFICATION_FAILED_MESSAGE }, 400);
      }

      let verification: TurnstileVerification;
      try {
        const secret = env.TURNSTILE_SECRET_KEY;
        if (!secret) throw new Error("Missing Turnstile configuration (TURNSTILE_SECRET_KEY).");
        verification = await verifyTurnstile(secret, token, c.req.header("cf-connecting-ip") ?? "");
      } catch (error) {
        logSecurity("error", "turnstile-service-error");
        console.error("[newsletter] Turnstile verification failed", error);
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: VERIFICATION_FAILED_MESSAGE }, 503);
      }

      const expectedHostname = new URL(c.req.url).hostname;
      if (!verification.success || verification.hostname !== expectedHostname || verification.action !== "newsletter") {
        const reason = !verification.success
          ? "turnstile-rejected"
          : verification.hostname !== expectedHostname
            ? "turnstile-hostname-mismatch"
            : "turnstile-action-mismatch";
        logSecurity("blocked", reason, verification.errorCodes);
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: VERIFICATION_FAILED_MESSAGE }, 400);
      }

      logSecurity("passed", "turnstile");
      const email = parsed.data;

      try {
        const { apiKey, audienceId } = resolveConfig(env);
        const client = options.resendClient ?? (await (options.createResendClient ?? defaultCreateResendClient)(apiKey));

        const { error: contactError } = await client.contacts.create({ audienceId, email });

        if (contactError) {
          logSecurity("error", "resend-contact");
          console.error("[newsletter] Resend contact error:", contactError.message);
          c.header("cache-control", "no-store");
          return c.json({ success: false, message: SUBSCRIBE_FAILED_MESSAGE }, 500);
        }

        const welcomeHtml = await loadWelcomeHtml(welcomeTemplatePath, email);

        // Awaited (tracked), not fire-and-forget, and carries a deterministic
        // Idempotency-Key so retries of this request cannot double-send it.
        const { error: sendError } = await client.emails.send(
          {
            from: "MCPVault <info@mcpvault.org>",
            to: [email],
            subject: "You're on the list",
            html: welcomeHtml,
          },
          { idempotencyKey: welcomeIdempotencyKey(email) },
        );

        if (sendError) {
          // Contact is already saved -- log the delivery failure but don't
          // fail the signup over it, same as the production behavior this replaces.
          logSecurity("error", "resend-welcome");
          console.error("[newsletter] welcome email error:", sendError.message);
        }

        logSecurity("accepted", "subscribed");
        c.header("cache-control", "no-store");
        return c.json({ success: true }, 200);
      } catch (err) {
        logSecurity("error", "subscription");
        console.error("[newsletter] subscription failed", err);
        c.header("cache-control", "no-store");
        return c.json({ success: false, message: SUBSCRIBE_FAILED_MESSAGE }, 500);
      }
    },
  );
}
