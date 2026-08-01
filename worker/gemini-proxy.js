/**
 * stockterm — Gemini proxy (Cloudflare Worker)
 *
 * Lets the app use the analyst with NO key from the visitor. The Gemini key
 * lives here as an encrypted secret and never reaches the browser.
 *
 * Without this, a public static file has only two options: ask every visitor
 * for their own key, or embed yours — and an embedded key in a public repo is
 * scraped within minutes and bills you for every stranger's usage.
 *
 * Deploy: see worker/README.md
 *
 * Bindings this Worker expects:
 *   GEMINI_KEY    (secret)   your Google AI Studio key
 *   ALLOWED_ORIGIN (var)     e.g. https://msgtoeeshan-oss.github.io
 *   RATE_KV       (KV, optional)  enables per-IP daily limits
 */

const MODEL = 'gemini-2.5-flash';
const UPSTREAM = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Ceilings. Without these, one script can drain your quota (or your card).
const MAX_BODY_BYTES = 400_000; // an evidence pack with a 10-K runs ~60 KB
const MAX_PER_IP_PER_DAY = 40;
const MAX_OUTPUT_TOKENS = 16_000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, model: MODEL, keyConfigured: !!env.GEMINI_KEY }, 200, cors);
    }
    if (url.pathname !== '/generate') return json({ error: 'Not found' }, 404, cors);
    if (request.method !== 'POST') return json({ error: 'Use POST' }, 405, cors);

    // Only serve the site this key is paying for.
    if (env.ALLOWED_ORIGIN && origin && !originAllowed(origin, env)) {
      return json({ error: 'Origin not allowed' }, 403, cors);
    }
    if (!env.GEMINI_KEY) {
      return json({ error: 'Server is missing GEMINI_KEY. Set it with: wrangler secret put GEMINI_KEY' }, 500, cors);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: `Request too large (${raw.length} bytes, limit ${MAX_BODY_BYTES}).` }, 413, cors);
    }

    let body;
    try { body = JSON.parse(raw); }
    catch { return json({ error: 'Body must be JSON' }, 400, cors); }
    if (!body || !Array.isArray(body.contents)) {
      return json({ error: 'Body must contain a contents array' }, 400, cors);
    }

    // Cap output regardless of what the client asked for.
    body.generationConfig = body.generationConfig || {};
    body.generationConfig.maxOutputTokens =
      Math.min(Number(body.generationConfig.maxOutputTokens) || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);

    // Per-IP daily limit. Skipped if no KV namespace is bound.
    if (env.RATE_KV) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const key = `rl:${new Date().toISOString().slice(0, 10)}:${ip}`;
      const used = parseInt((await env.RATE_KV.get(key)) || '0', 10);
      if (used >= MAX_PER_IP_PER_DAY) {
        return json({
          error: `Daily limit reached (${MAX_PER_IP_PER_DAY} analyses). This keeps a shared key usable for everyone. ` +
                 `Add your own key in Settings to remove the limit.`
        }, 429, cors);
      }
      await env.RATE_KV.put(key, String(used + 1), { expirationTtl: 172800 });
    }

    let upstream;
    try {
      upstream = await fetch(`${UPSTREAM}?key=${encodeURIComponent(env.GEMINI_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      return json({ error: 'Could not reach the model endpoint: ' + e.message }, 502, cors);
    }

    const text = await upstream.text();
    // Pass the upstream status through so the app's error mapping still works
    // (it special-cases 429 with "limit: 0" to explain a zero-quota project).
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};

function originAllowed(origin, env) {
  const allowed = String(env.ALLOWED_ORIGIN || '')
    .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  if (!allowed.length) return true;
  const o = origin.replace(/\/+$/, '');
  return allowed.includes(o) || allowed.includes('*');
}

function corsHeaders(origin, env) {
  const allow = originAllowed(origin, env) && origin ? origin : (env.ALLOWED_ORIGIN || '*').split(',')[0].trim();
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
