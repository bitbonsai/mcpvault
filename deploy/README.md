# Deploying website-shibumi

The site deploys via [`shibumi-server`](https://github.com/bitbonsai/shibumi-server)
running on the Hetzner host. No registry, no Actions: a signed push webhook makes
shibumi-server fetch the exact commit, build `website-shibumi/compose.yaml` in
place with rootless `podman compose`, health-check `/healthz`, and keep two
rollback images.

```text
GitHub push webhook
      |
Cloudflare -> Caddy (host HTTPS)
      |-- /hooks/github/<appId> -> shibumi-server (127.0.0.1:8787)
      `-- everything else       -> mcpvault-web container (127.0.0.1:9100)
```

## Install shibumi-server (once per host)

```bash
curl -fsSL https://shibumistack.dev/install/server | bash
```

Interactive setup verifies Git, Caddy, rootless Podman, and the systemd user
session, then installs a pinned release with config, secrets, and a
resource-limited user service. See the shibumi-server README for details.

## Register this app

```bash
shibumi-server add <domain> \
  --repository bitbonsai/mcpvault \
  --checkout "$HOME/shibumi/mcpvault-web" \
  --port 9100 \
  --ref refs/heads/staging \
  --compose-file website-shibumi/compose.yaml
```

- `<domain>` is the hostname Caddy will serve (staging host first; the
  production registration at cutover uses `mcpvault.org`). The app id is
  derived from the domain: existing dashes double (`-` -> `--`), then dots
  become dashes, so `mcpvault.org` -> `mcpvault-org` and the webhook path is
  `/hooks/github/mcpvault-org`.
- `--ref refs/heads/staging` tracks the migration branch for staging. Register
  production separately as `mcpvault.org` with `--ref refs/heads/main`; do not
  repurpose staging registration.
- `add` generates the webhook HMAC secret itself and writes it to
  `~/.config/shibumi-server/secrets.env` (mode 0600), then prints the webhook
  URL and secret variable name. Never invent or commit this secret.
- Defaults written by `add`: 2 GiB free-memory / 4 GiB free-disk floors,
  10-minute build timeout. This site builds far lighter; lower them in
  `config.json` if the host needs headroom for other apps.
- If the host only has the standalone Python frontend, add
  `--compose-command podman-compose` and confirm the hardening flags survive
  with `podman-compose config` (the standalone frontend has historically been
  less complete about `cap_drop`/`security_opt`).

## Newsletter secrets

Not committed, not baked into the image. Create before the first deploy:

```sh
install -d -m 700 ~/.config/shibumi-server/app-secrets
install -m 600 /dev/null \
  ~/.config/shibumi-server/app-secrets/mcpvault-web.env
# then edit in place:
#   RESEND_API_KEY=...
#   RESEND_AUDIENCE_ID=...
#   TURNSTILE_SITE_KEY=...
#   TURNSTILE_SECRET_KEY=...
```

Configure the Turnstile widget for `mcpvault.org` in Managed mode. The form
uses interaction-only appearance and the server requires hostname
`mcpvault.org` plus action `newsletter` before contacting Resend.

`compose.yaml` marks this `env_file` as `required: false`: a missing file only
breaks `/api/subscribe` and `/api/unsubscribe`, the rest of the site starts.
Create it anyway.

Newsletter security decisions are JSON logs with a dedicated prefix and no
email addresses or Turnstile tokens:

```sh
ssh alpha 'podman logs --since 24h mcpvault-org_web_1 2>&1 | grep "\[newsletter-security\]"'
```

## Caddyfile

```caddyfile
<domain> {
	handle /hooks/github/* {
		reverse_proxy 127.0.0.1:8787
	}

	handle {
		reverse_proxy 127.0.0.1:9100
	}
}
```

The wildcard webhook route covers every shibumi-server app on the host;
shibumi-server demuxes by `/hooks/github/<appId>` itself.

## GitHub webhook

On `bitbonsai/mcpvault` -> Settings -> Webhooks -> Add webhook, using the URL
and secret printed by `shibumi-server add` (secret value lives in
`~/.config/shibumi-server/secrets.env`):

| Field | Value |
| --- | --- |
| Payload URL | printed by `add` |
| Content type | `application/json` |
| Secret | copied from `secrets.env` |
| Events | just the `push` event |
| Active | yes |
