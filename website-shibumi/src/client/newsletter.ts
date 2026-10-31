/**
 * Alpine.data() module backing the newsletter signup form
 * (`NewsletterSignup.tsx`). Ported from `NewsletterSignup.astro`'s vanilla
 * `astro:page-load` submit handler: prevent the real POST, `fetch()`
 * `/api/subscribe` as JSON, and swap between hint/success/error banners
 * plus a disabled "Adding…" button label while the request is in flight.
 *
 * Registered under the name `newsletterSignup` in `alpine.ts`.
 * `NewsletterSignup.tsx` only ever *names* this module and its `submit()`
 * method in HTML attributes (`x-data="newsletterSignup"`, `x-model`,
 * `x-on:submit.prevent="submit()"`, `x-bind:disabled="status ===
 * 'submitting'"`, `x-text="status === 'submitting' ? 'Adding…' : 'Join the
 * list'"`, `x-bind:hidden="status !== 'success'"`) -- every attribute above
 * is grammar the `@alpinejs/csp` build's restricted evaluator accepts
 * (bare identifiers, `===`/`!==`, ternaries, string literals), never an
 * inline function body. The actual submit logic lives here, in a plain,
 * unit-testable async method.
 *
 * `status` toggles the success/error banners via `x-bind:hidden`, the real
 * boolean attribute already on those elements in the server-rendered
 * markup (`hidden` on both `<p>`s by default), not a `.hidden` class --
 * same reasoning as `nav.ts`'s mobile menu panel: nothing else ever sets
 * that attribute, so there's no static class to lose a fight against.
 *
 * The form keeps its real `method="post" action="/api/subscribe"`, while
 * Turnstile verification requires JavaScript before either submission path
 * can reach Resend.
 */
export type NewsletterStatus = "idle" | "submitting" | "success" | "error";

interface NewsletterRoot {
  querySelector(selector: string): HTMLInputElement | null;
}

export interface NewsletterSignupData {
  email: string;
  website: string;
  status: NewsletterStatus;
  $root?: NewsletterRoot;
  submit(this: NewsletterSignupData): Promise<void>;
}

/**
 * @param fetchImpl Injectable so tests don't need a real network/server;
 * `alpine.ts` calls this with no arguments, which defaults to the global
 * `fetch`.
 */
export function newsletterSignup(fetchImpl: typeof fetch = fetch): NewsletterSignupData {
  return {
    email: "",
    website: "",
    status: "idle",
    async submit() {
      const email = this.email.trim();
      const turnstileToken = this.$root?.querySelector('[name="cf-turnstile-response"]')?.value.trim() ?? "";
      if (!email || !turnstileToken) {
        this.status = "error";
        return;
      }

      this.status = "submitting";

      try {
        const res = await fetchImpl("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, website: this.website, turnstileToken }),
        });

        if (!res.ok) throw new Error(`subscribe request failed with status ${res.status}`);

        const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
        if (!data?.success) throw new Error("subscribe response missing success:true");

        this.status = "success";
        this.email = "";
        this.website = "";
      } catch {
        this.status = "error";
      } finally {
        (globalThis as typeof globalThis & { turnstile?: { reset(): void } }).turnstile?.reset();
      }
    },
  };
}
