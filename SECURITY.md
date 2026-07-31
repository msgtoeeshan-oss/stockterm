# Security

## API keys are never in this repository

`stock.html` ships with empty key constants:

```js
var FINNHUB_KEY = '';
var AI_KEY      = '';
```

Keys are entered in the app and held in the browser's `localStorage` under `stockterm.keys.v1`. They are never written back into the file and are sent only to the API they belong to.

This is what makes the repo safe to be public, and it is why the app cannot ship with a working key for everyone: anything in a static file is readable by anyone who opens DevTools. A shared key would be scraped within minutes, and the free tier is 60 calls/minute *in total* — a handful of strangers would exhaust it for everybody, including you.

## If you accidentally commit a key

**Rotate it. Do not just delete it.**

Removing a key in a later commit does not remove it from the repository — git history keeps every version, and GitHub's API serves old commits indefinitely. Anyone who cloned or forked the repo has it. Automated scrapers monitor public repos for exactly this and typically find a key in minutes.

1. Revoke and regenerate at [finnhub.io/dashboard](https://finnhub.io/dashboard) or [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Paste the new key into the app, not the file
3. Only then worry about scrubbing history

## Automated guard

`.github/workflows/no-secrets.yml` runs on every push and pull request. It fails the build if:

- `FINNHUB_KEY` or `AI_KEY` is assigned a non-empty string literal
- A Google API key pattern (`AIza…`) appears anywhere
- A long token-like literal appears where one should not

This is a safety net, not a substitute for care. It cannot catch every possible key format.

## Keeping a local copy with your key

If you want a personal build that skips the setup screen, keep it as `stock.local.html`. That filename is in `.gitignore` and will not be committed.

## What this app sends where

| Destination | What | When |
|---|---|---|
| `finnhub.io` | ticker symbol, your Finnhub key | on load, and every 15s while the live poll is on |
| `generativelanguage.googleapis.com` | the evidence pack, your Gemini key | only when you press Generate or Run debate |
| anywhere else | nothing | — |

Filings you drop in are read locally with `FileReader`. They are only transmitted if you then run a research pass, which sends the extracted sections to Gemini as part of the evidence pack.

There is no analytics, no telemetry, and no third-party script. The page loads no external resources at all.

## Reporting a vulnerability

Open an issue. This is a static client-side tool with no backend and no user accounts, so the realistic surface is limited to:

- Cross-site scripting via an API response rendered without escaping
- A key being leaked into the source or into a URL

Both are worth reporting. Everything reaching `innerHTML` is escaped through `esc()`; if you find a path that isn't, that's a real bug.
