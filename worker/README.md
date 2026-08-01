# Making the analyst work without asking visitors for a key

By default, each visitor supplies their own Google AI Studio key. This directory removes that step: a tiny Cloudflare Worker holds **your** key server-side, and the app calls the Worker instead of Google.

Visitors get the analyst with nothing to sign up for.

---

## Why the key cannot simply go in `stock.html`

`stock.html` is downloaded by the browser. Anything in it is readable by anyone who presses F12 — there is no way to hide, obfuscate or encrypt a key in client-side code, because the code must be able to use it.

For Finnhub that means a broken app (60 calls/minute shared by everyone). For **Gemini it means your money**: a scraped key on a billed project runs up charges with no ceiling, and bots scan public GitHub repos for exactly this within minutes of a push.

A Worker fixes it properly. The key sits in Cloudflare's encrypted secret store. The browser never sees it.

---

## Cost

Cloudflare Workers: **100,000 requests/day free**, which is far more than this will use.

Gemini is the real cost, and it is now **yours**, not the visitor's. One research pass sends roughly 60 KB and returns up to 16k tokens — on `gemini-2.5-flash` that lands around **1–3 cents**. The Worker ships with a **40-analyses-per-IP-per-day** cap so one script cannot drain you.

If you would rather not pay for strangers at all, skip this directory. The app already works: visitors add their own free key, which costs you nothing.

---

## Deploy

### 1. Get a Gemini key
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key in new project**.

> If a request later returns `429` with `limit: 0`, that project has no free-tier quota. Make a key in a *different* new project, or enable billing.

### 2. Install the CLI
```bash
npm install -g wrangler
wrangler login
```

### 3. Create the Worker
From this `worker/` directory:

```bash
wrangler init stockterm-ai --no-git
```
Replace the generated `src/index.js` with `gemini-proxy.js` from this folder.

### 4. Store the key as a secret
```bash
wrangler secret put GEMINI_KEY
```
Paste the key when prompted. It is encrypted and never appears in your repo.

### 5. Lock it to your site
In `wrangler.toml`:

```toml
name = "stockterm-ai"
main = "src/index.js"
compatibility_date = "2026-01-01"

[vars]
ALLOWED_ORIGIN = "https://YOUR-USERNAME.github.io"
```

This stops other sites pointing at your Worker and spending your quota.

### 6. Optional but recommended — per-IP rate limiting
```bash
wrangler kv namespace create RATE_KV
```
Add the returned id to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_KV"
id = "paste-the-id-here"
```

Without this binding the Worker still runs, but the daily cap is not enforced.

### 7. Publish
```bash
wrangler deploy
```

You get a URL like `https://stockterm-ai.your-subdomain.workers.dev`.

### 8. Point the app at it
In `stock.html`, section 1:

```js
AI_PROXY: 'https://stockterm-ai.your-subdomain.workers.dev',
```

Then `cp stock.html index.html`, commit, push.

---

## Check it works

```bash
curl https://stockterm-ai.your-subdomain.workers.dev/health
```

Expected:
```json
{"ok":true,"model":"gemini-2.5-flash","keyConfigured":true}
```

If `keyConfigured` is `false`, step 4 did not take.

Then open the app. The Analysis tab should run without ever asking for a key.

---

## How the app behaves

| `AI_PROXY` | `AI_KEY` in browser | Result |
|---|---|---|
| set | anything | Analyst works for everyone, no signup, your cost |
| empty | set by visitor | Analyst works, visitor's cost |
| empty | empty | Analyst is offline; every other feature still works |

A visitor's own key always overrides nothing — the proxy is preferred when configured, because it needs nothing from them.

---

## Limits in the Worker

| Guard | Default | Why |
|---|---|---|
| `MAX_BODY_BYTES` | 400 KB | an evidence pack with a full 10-K is ~60 KB |
| `MAX_PER_IP_PER_DAY` | 40 | one script cannot drain your quota |
| `MAX_OUTPUT_TOKENS` | 16,000 | caps cost per call regardless of what the client asks |
| `ALLOWED_ORIGIN` | your site | other sites cannot spend your quota |

Upstream status codes pass through unchanged, so the app's existing error handling — including the `limit: 0` zero-quota explanation — still works.
