# stockterm

A single-file stock analysis terminal. One HTML file, no dependencies, no build step, no server. Download it, double-click it, done.

It scores a company against rules you control, shows the full audit trace behind every point, runs a DCF you can push around with sliders, and writes a plain-English assessment — with or without an AI model.

---

## Try it

**[▶ Open the live demo](https://YOUR-USERNAME.github.io/stockterm/)** — no signup, no install, no key. Real Apple data is bundled in, so every tab works immediately.

To use it on any ticker with live prices:

1. Get a free key at [finnhub.io/register](https://finnhub.io/register) (takes a minute, no card)
2. Paste it into the app
3. Done — it's remembered on your device

The key lives in your browser's `localStorage` and is **never** written into the file or sent anywhere except Finnhub. That's why this repo is safe to be public.

Optionally add a [Google AI Studio](https://aistudio.google.com/apikey) key in **Settings** to enable the sourced research pass. Everything else works without it.

### Or run it offline

Download `stock.html` and double-click. One file, no server, no build step. It works the same.

---

## What it does

**Analysis** — the landing tab. A composite score, a plain-English verdict, and every rule that fired or missed, written as sentences rather than jargon:

> ✓ Owes less than shareholders have put in — *D/E < 1.0 · now 0.80x · 40 pts*
> ✕ Costs under 20x its annual profit — *P/E < 20 · now 39.9x · 40 pts*

Plus **what would have to change** to move the score, and the data gaps behind it. None of this needs an AI key.

### Sourced research

With a Gemini key, the same tab runs a research pass with **quote-first sourcing discipline**. Three modes, each a fixed question set answered in order:

- **Lynch Pitch** — why would I own this? One main idea, no stories.
- **Munger Invert** — how could I lose money? Assumes the idea is bad and tries to invalidate it.
- **Business Brief** — what the filings actually say, without arguing a side.

Every claim must cite a source and value, or be marked *Not found in sources*:

```
[FILING-FY2025, us-gaap:Revenues]: 416161000000 -> ...
[DOC-AAPL-ITEM1A, "component supply"]: "Because the Company currently obtains
certain components from single or limited sources..." -> ...
```

The model is told its own training knowledge does not count. Interpretations beyond a cited number are flagged as inferences, and the fiscal year used is reported.

### Drop in the 10-K

Numbers say what a company earned; only the filing says what it *does* and what management admits could go wrong. Drag a 10-K onto the Analysis tab — the app extracts **Item 1 (Business)**, **Item 1A (Risk Factors)** and **Item 7 (MD&A)** and adds them as quotable sources. The app already links the right document for you.

Measured on Apple's FY2025 10-K: without it the model refuses two Munger questions outright; with it, refusals drop to zero and 39 of 41 citations quote the filing directly.

HTML or plain text. **PDF is not supported** — that would need an external library, and SEC publishes the same filing as `.htm`. Files are read in your browser with `FileReader`; nothing is uploaded anywhere.

**Overview** — live quote, key metrics, revenue/income/cash-flow history, margin trends, a watchlist heatmap and movers table.

**Valuation** — a fading-growth DCF with a Gordon terminal value. Sliders for growth, fade period, terminal rate and discount rate; a 5×5 sensitivity grid; and an amber flag when terminal value exceeds 75% of enterprise value, because past that you're pricing an assumption rather than a business.

**Rule trace** — the full audit table, with adjustable factor weights that recompute the composite live.

---

## Design principles

**The trace is the product.** A score with no trace is a black box. Every rule shows whether it fired, the actual value it tested, and the points it earned — so you can disagree with a specific line rather than with a number.

**Missing data is never scored as zero.** A factor with under half its inputs available is dropped from the composite entirely and the remaining weights are renormalised. A 78 built on 40% coverage is not the same claim as a 78 built on 95%, and the app shows you which you're looking at.

**No confident wrong numbers.** Quotes display their exchange timestamp and how stale they are. Failed requests degrade to warnings naming what broke and what to do. Tiered rules that are mutually exclusive disclose their real scoring ceiling instead of implying an unreachable 100.

**There is deliberately no backtest.** Free providers serve *restated* fundamentals — figures as they look now, not as they looked then. Scoring rules against restated history leaks the future and makes almost any rule set look brilliant. A tab producing confident wrong numbers is worse than no tab.

---

## Known limitations

- **The DCF has no net-debt bridge.** Free cash flow is discounted to an enterprise value and divided by share count. Companies with heavy net debt look better than they are; large net-cash piles look worse. Read the per-share figure as enterprise value per share.
- **Quotes are not real-time.** Finnhub's `/quote` returns the last regular-session consolidated trade. It does not include pre-market or extended hours, which is why the price can differ from TradingView. The app polls every 15 seconds and always shows the timestamp.
- **Statement line items are matched on concept-name substrings**, which vary by filer. Spot-check the as-reported table against the real filing before leaning on a number.
- **Historical EPS is as-reported**, so figures spanning a stock split are not comparable year to year.
- **The AI lenses are prompts, not training.** They change which questions get asked of the same numbers. They add no ability to predict prices.

---

## Configuration

The script is divided into 12 numbered sections with a map in the header comment, so changes can be scoped precisely ("edit section 6").

| § | Contents |
|---|---|
| 1 | Config — factor rules, weights, bands, tabs, watchlist, AI lenses |
| 2 | Utilities — parsing, formatting, HTML escaping |
| 3 | State — single store, persistence |
| 4 | API — Finnhub + Gemini calls, error mapping |
| 5 | Metrics — derived figures |
| 6 | Signal engine — scoring + audit trace |
| 7 | DCF — model and sensitivity grid |
| 8 | Charts — hand-rolled SVG |
| 9 | Components — HTML builders |
| 10 | Views — one per tab |
| 11 | Render + events |
| 12 | Actions |

Scoring rules live in `CFG.FACTORS` in section 1. Each carries its threshold, point value, the metric keys it needs, and a plain-English description. Add or change rules there and the trace, the assessment and the export all follow automatically.

---

## Hosting your own copy

The whole app is one static file, so GitHub Pages serves it for free with no build step.

1. Push this repo to GitHub as **Public**
2. **Settings → Pages → Source: Deploy from a branch**
3. Branch **`main`**, folder **`/ (root)`**, then **Save**
4. Wait about a minute — your link is `https://YOUR-USERNAME.github.io/REPO-NAME/`

`index.html` is a copy of `stock.html`, which is what makes the bare URL work. If you edit the app, copy it across again:

```bash
cp stock.html index.html
git commit -am "update" && git push
```

### A note on data sources

Finnhub is used because it sends `Access-Control-Allow-Origin: *`, which is what lets a page with no backend call it directly.

Yahoo Finance (and therefore `yfinance`) **cannot** work here. Its endpoints return data but send no CORS headers at all, so a browser blocks the response regardless of where the page is hosted, and the richer endpoints return `401` without a server-side cookie/crumb handshake. Using Yahoo requires a backend — which would mean hosting costs and your key paying for every visitor's usage.

## Security

**No API key is committed to this repository, and none should ever be.**

Keys are entered in the app and held in browser storage. If you paste one directly into the source and commit it, git history keeps it permanently — deleting it in a later commit does not remove it. Rotate the key instead.

`.gitignore` excludes `stock.local.html`, so you can keep a personal keyed build alongside the public one without risk.

---

## Disclaimer

**A modelling tool, not investment advice. Nobody involved in it is a licensed financial advisor.**

The bands (Accumulate / Hold / Trim / Avoid) are labels attached to score ranges *you* configure — they are your own rule set scoring itself, not a recommendation. Figures come from third-party APIs and may be wrong, stale or misattributed. Verify anything before acting on it.

---

## Licence

MIT — see [LICENSE](LICENSE).
