# Contributing

Thanks for taking a look.

## The constraints

These are the point of the project, not obstacles to work around. A change that breaks one of them will not be merged, however good it is otherwise.

1. **One file.** All CSS and JS stay inline in `stock.html`.
2. **No dependencies.** No frameworks, no charting libraries, no CDN links, no build step. Charts are hand-rolled SVG.
3. **No keys in source.** Ever. See [SECURITY.md](SECURITY.md).
4. **It must run from `file://`.** Double-clicking the file has to work, which rules out anything needing a server or a bundler.
5. **No silent failure.** Every error path gets a message saying what broke and what to do about it.
6. **No confident wrong numbers.** If data is missing, say so. Never substitute a zero for an unknown.

## Setup

There isn't one. Open `stock.html` in a browser and edit it in any text editor.

## Before you open a pull request

```bash
# 1. the inline script must parse
node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('stock.html','utf8');new vm.Script(h.slice(h.indexOf('<script>')+8,h.lastIndexOf('</'+'script>')));console.log('ok')"

# 2. keep the hosted copy in sync
cp stock.html index.html
```

Then open the file and click through all five tabs, including with no API key set (you should land in the demo).

CI checks that the script parses, that no key is present, that no external resource is referenced, and that `index.html` matches `stock.html`.

## Code layout

The script is divided into 12 numbered sections with a map in the header comment. Say which section you changed — "edit section 6" is more useful than describing the feature.

| § | Contents |
|---|---|
| 1 | Config — rules, weights, bands, tabs, research modes, demo snapshot |
| 2 | Utilities — parsing, formatting, escaping, filing text extraction |
| 3 | State |
| 4 | API + evidence pack |
| 5 | Metrics |
| 6 | Signal engine |
| 7 | DCF |
| 8 | Charts |
| 9 | Components |
| 10 | Views |
| 11 | Render + events |
| 12 | Actions |

## Adding a scoring rule

Add it to the relevant factor in `CFG.FACTORS` (section 1):

```js
{ id:'roic20', label:'ROIC > 20%', plain:'Earns over 20% on invested capital',
  pts:25, needs:['roi'],
  test:function(m){ return m.roi > 20 },
  show:function(m){ return fx(m.roi,1)+'%' } }
```

- `needs` lists the metric keys the rule reads. If any are missing the rule is skipped entirely rather than scored zero — this is what stops absent data reading as bad data.
- `plain` must be **verb-initial**, so it reads correctly after both "It …" and "If it …".
- The trace, written assessment, evidence pack and markdown export all pick it up automatically.

## Things that will be declined

- Adding a data source that needs a backend proxy (Yahoo Finance, for instance — its endpoints send no CORS headers)
- A backtest tab. Free providers serve restated fundamentals; scoring rules against them leaks the future and makes any rule set look brilliant.
- Buy/sell recommendations. The bands are the user's own rules scoring themselves, and the trace is what keeps that honest.
- Anything that makes a number appear without a visible path back to where it came from.

## Style

Match what's there: `var`, function declarations, no transpiled syntax. It has to run in a browser directly with no build step, so keep to widely supported ES5/ES6.

Comments should explain *why*, not restate the code.
