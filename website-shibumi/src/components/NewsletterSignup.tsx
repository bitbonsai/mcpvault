/**
 * Newsletter signup card. Ported from NewsletterSignup.astro.
 *
 * Submission state (Phase 3) is the `newsletterSignup` Alpine.data()
 * module (`../client/newsletter.ts`): the form names it with `x-data`,
 * binds the email and honeypot inputs with `x-model`, intercepts submit with
 * `x-on:submit.prevent="submit()"`, and reflects `status` on the button
 * label/disabled state and the success/error banners. The form still has
 * a real `action`/`method`, and the input keeps `name="email"`, so it
 * degrades to a normal (if unstyled-response) POST with no JavaScript,
 * rather than doing nothing on submit -- see `newsletter.ts` for why the
 * banners bind `hidden` directly instead of a `.hidden` class.
 */
const HIGHLIGHTS = ["Release notes", "New client configuration guides", "Obsidian workflow examples"];

export function NewsletterSignup() {
  return (
    <section data-component="newsletter-signup">
      <div class="newsletter-inner">
        <div class="newsletter-card">
          <div class="newsletter-grid">
            <div>
              <p class="eyebrow">Release email</p>
              <h2>Get MCPVault updates</h2>
              <p class="lede">Receive one email when MCPVault publishes a release, adds setup instructions for a client, or documents a new Obsidian workflow.</p>
              <ul class="highlights">
                {HIGHLIGHTS.map((item) => (
                  <li>
                    <span class="check" aria-hidden="true">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div class="form-panel">
              <form method="post" action="/api/subscribe" data-newsletter-form x-data="newsletterSignup" {...{ "x-on:submit.prevent": "submit()" }}>
                <div class="form-honeypot" aria-hidden="true">
                  <label for="newsletter-website">Website</label>
                  <input id="newsletter-website" type="text" name="website" tabIndex={-1} autocomplete="off" x-model="website" />
                </div>
                <label for="newsletter-email">Email address</label>
                <div class="form-row">
                  <input id="newsletter-email" type="email" name="email" placeholder="you@vaults.dev" required x-model="email" />
                  <button type="submit" x-bind:disabled="status === 'submitting'" x-text="status === 'submitting' ? 'Adding…' : 'Join the list'">
                    Join the list
                  </button>
                </div>
                <p class="form-hint">
                  Powered by{" "}
                  <a href="https://resend.com" target="_blank" rel="noopener">
                    Resend
                  </a>
                  . Never more than once a week.
                </p>
                <p class="form-success" hidden data-newsletter-success x-bind:hidden="status !== 'success'">
                  You're on the list. We'll send the next release update straight to your inbox.
                </p>
                <p class="form-error" hidden data-newsletter-error x-bind:hidden="status !== 'error'">
                  Something went wrong. Please try again in a minute.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
