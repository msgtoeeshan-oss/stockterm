#!/usr/bin/env node
/*
 * Rebuilds the bundled company snapshots inside stock.html.
 *
 * Runs in CI on a schedule so the shipped figures never go stale, and can be
 * run by hand:
 *
 *     FINNHUB_KEY=xxxx node tools/build-bundle.js
 *
 * The key comes from the environment only. It is never written to disk and
 * never appears in the output — CI supplies it from a repository secret.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KEY = process.env.FINNHUB_KEY;
if (!KEY) {
  console.error('FINNHUB_KEY is not set. Supply it in the environment.');
  process.exit(1);
}

const BASE = 'https://finnhub.io/api/v1';
const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'stock.html');
const MIRROR = path.join(ROOT, 'index.html');

/* Large caps across sectors. Anything not here still works once a visitor
   connects their own key. */
const TICKERS = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AVGO','ORCL','CRM',
  'AMD','INTC','QCOM','TXN','ADBE','NFLX','CSCO','IBM','NOW','UBER',
  /* Finnhub wants a hyphen for share classes: BRK.B returns nothing, BRK-B works. */
  'JPM','V','MA','BAC','WFC','GS','AXP','BRK-B',
  'UNH','JNJ','LLY','ABBV','MRK','PFE','TMO',
  'WMT','COST','HD','PG','KO','PEP','MCD','NKE','DIS',
  'XOM','CVX','CAT','BA','GE','LIN','RTX'
];

const KEEP = ['peTTM','psTTM','pbQuarterly','revenueGrowthTTMYoy','grossMarginTTM',
  'operatingMarginTTM','netProfitMarginTTM','roeTTM','roiTTM','currentRatioQuarterly',
  'beta','dividendYieldIndicatedAnnual','totalDebt/totalEquityQuarterly',
  '52WeekHigh','52WeekLow','revenuePerShareTTM','freeCashFlowPerShareTTM'];

const CONCEPTS = {
  revenue:   ['revenuefromcontract','totalrevenue','revenues','netsales','revenue'],
  netIncome: ['netincomeloss','netincome'],
  grossProfit:['grossprofit'],
  opIncome:  ['operatingincomeloss','operatingincome'],
  eps:       ['earningspersharediluted','earningspersharebasic'],
  cfo:       ['netcashprovidedbyusedinoperating','operatingactivities'],
  capex:     ['paymentstoacquirepropertyplant','capitalexpenditure']
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm  = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const r2    = v => (v === null || v === undefined || !isFinite(v)) ? null : Math.round(v * 100) / 100;

function pick(rows, keys) {
  for (const k of keys) for (const r of rows || []) {
    if (norm(r.concept).includes(k) || norm(r.label).includes(k)) {
      const v = parseFloat(r.value);
      if (isFinite(v)) return v;
    }
  }
  return null;
}

async function get(p) {
  const url = BASE + p + (p.includes('?') ? '&' : '?') + 'token=' + KEY;
  const res = await fetch(url);
  if (res.status === 429) { throw Object.assign(new Error('rate limited'), { retry: true }); }
  if (!res.ok) throw new Error('HTTP ' + res.status + ' on ' + p.split('?')[0]);
  return res.json();
}

async function grab(sym) {
  const q = encodeURIComponent(sym);
  const [quote, profile, metrics, fin, filings] = await Promise.all([
    get('/quote?symbol=' + q),
    get('/stock/profile2?symbol=' + q),
    get('/stock/metric?symbol=' + q + '&metric=all'),
    get('/stock/financials-reported?symbol=' + q + '&freq=annual'),
    get('/stock/filings?symbol=' + q)
  ]);

  if (!quote || !quote.c) throw new Error('no quote');
  if (!profile || !profile.name) throw new Error('no profile');

  const M = (metrics && metrics.metric) || {};
  const metric = {};
  KEEP.forEach(k => { if (M[k] !== undefined && M[k] !== null) metric[k] = r2(M[k]); });

  const annuals = ((fin && fin.data) || []).map(y => {
    const ic = (y.report || {}).ic || [], cf = (y.report || {}).cf || [];
    const revenue = pick(ic, CONCEPTS.revenue);
    if (revenue === null) return null;
    return {
      year: String(y.year),
      revenue,
      grossProfit: pick(ic, CONCEPTS.grossProfit),
      opIncome:    pick(ic, CONCEPTS.opIncome),
      netIncome:   pick(ic, CONCEPTS.netIncome),
      eps:         pick(ic, CONCEPTS.eps),
      cfo:         pick(cf, CONCEPTS.cfo),
      capex:       pick(cf, CONCEPTS.capex)
    };
  }).filter(Boolean).reverse().slice(-7);

  const tenKs = (filings || [])
    .filter(f => String(f.form || '').startsWith('10-K'))
    .slice(0, 3)
    .map(f => ({ form: f.form, filedDate: String(f.filedDate).slice(0, 10), reportUrl: f.reportUrl }));

  /* A ticker with no parsed history is a hollow entry: it renders, but every
     history-derived factor drops out and the user sees a half-empty product.
     Better to omit it than to ship it. */
  if (annuals.length < 4) throw new Error('only ' + annuals.length + ' years of annual data');

  return {
    quote: { c: r2(quote.c), d: r2(quote.d), dp: r2(quote.dp), o: r2(quote.o),
             h: r2(quote.h), l: r2(quote.l), pc: r2(quote.pc), t: quote.t },
    profile: { name: profile.name, currency: profile.currency, exchange: profile.exchange,
               finnhubIndustry: profile.finnhubIndustry,
               marketCapitalization: r2(profile.marketCapitalization),
               shareOutstanding: r2(profile.shareOutstanding) },
    metric, annuals, filings: tenKs
  };
}

(async () => {
  const set = {}, failed = [];
  let calls = 0;

  for (const sym of TICKERS) {
    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        set[sym] = await grab(sym);
        done = true;
        process.stdout.write('.');
      } catch (e) {
        if (e.retry) { process.stdout.write('~'); await sleep(65000); }
        else { failed.push(sym + ' (' + e.message + ')'); process.stdout.write('x'); done = true; }
      }
    }
    /* 5 calls per ticker; free tier allows 60/min. Pace to ~10 tickers/min. */
    calls += 5;
    if (calls >= 55) { calls = 0; process.stdout.write(' '); await sleep(62000); }
    else await sleep(400);
  }
  console.log('');

  const syms = Object.keys(set);
  if (syms.length < 10) {
    console.error('Only ' + syms.length + ' tickers succeeded. Refusing to write a degraded bundle.');
    process.exit(1);
  }

  const newest = Math.max.apply(null, syms.map(s => set[s].quote.t || 0));
  const asOf = new Date(newest * 1000).toISOString().slice(0, 10);
  const watch = syms.slice(0, 12).map(s => ({
    sym: s, c: set[s].quote.c, d: set[s].quote.d, dp: set[s].quote.dp,
    o: set[s].quote.o, h: set[s].quote.h, l: set[s].quote.l
  }));

  const bundle = { asOf, ticker: syms.indexOf('AAPL') >= 0 ? 'AAPL' : syms[0], watch, set };
  const line = '  DEMO: ' + JSON.stringify(bundle) + ',';

  let src = fs.readFileSync(TARGET, 'utf8');
  const nl = /\r\n/.test(src) ? '\r\n' : '\n';
  if (!/^ {2}DEMO: \{/m.test(src)) {
    console.error('No DEMO block found in stock.html — refusing to guess where to write.');
    process.exit(1);
  }
  src = src.replace(/^ {2}DEMO: \{[\s\S]*?\},\r?\n/m, line + nl);
  fs.writeFileSync(TARGET, src, 'utf8');
  fs.writeFileSync(MIRROR, src, 'utf8');

  /* the key must never survive into the output */
  if (src.indexOf(KEY) !== -1) {
    console.error('FATAL: the API key appears in the output. Not committing.');
    process.exit(1);
  }

  console.log('bundled : ' + syms.length + '/' + TICKERS.length + ' tickers');
  if (failed.length) console.log('failed  : ' + failed.join(', '));
  console.log('asOf    : ' + asOf);
  console.log('size    : ' + (line.length / 1024).toFixed(1) + ' KB');
  console.log('file    : ' + (fs.statSync(TARGET).size / 1024).toFixed(1) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
