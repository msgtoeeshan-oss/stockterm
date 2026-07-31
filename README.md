# stockterm

A single-file stock analysis terminal. One HTML file, no dependencies, no build step, no server. Download it, double-click it, done.

It scores a company against rules you control, shows the full audit trace behind every point, runs a DCF you can push around with sliders, and writes a plain-English assessment — with or without an AI model.

---

## Quick start

1. Download **`stock.html`**
2. Open it in a browser (double-click is fine — no server needed)
3. Paste a free [Finnhub](https://finnhub.io/register) API key when prompted

That's it. The key is stored in your browser's `localStorage` and never written back into the file.

Optionally add a [Google AI Studio](https://aistudio.google.com/apikey) key in **Settings** to enable the model-written thesis. Everything else works without it.

---

## What it does

**Analysis** — the landing tab. A composite score, a plain-English verdict, and every rule that fired or missed, written as sentences rather than jargon:

> ✓ Owes less than shareholders have put in — *D/E < 1.0 · now 0.80x · 40 pts*
> ✕ Costs under 20x its annual profit — *P/E < 20 · now 39.9x · 40 pts*

Plus **what would have to change** to move the score, and the data gaps behind it.

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
