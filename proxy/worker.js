// Cloudflare Worker: CORS proxy for the official Overwatch patch notes, nothing else.
// The site calls it as  https://<worker>.workers.dev/?url=<encoded Blizzard URL>
// Free plan: 100 000 requests a day, no card needed.

const ALLOWED = /^https:\/\/overwatch\.blizzard\.com\/en-us\/news\/patch-notes\/(live\/\d{4}\/\d{2}\/?)?$/;
const EDGE_CACHE = 30 * 60;   // seconds; browsers keep their own 12 h copy on top of this

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });

    const target = new URL(request.url).searchParams.get('url') || '';
    if (!ALLOWED.test(target)) return new Response('URL not allowed', { status: 400, headers: CORS });

    const cache = caches.default;
    const key = new Request(request.url, { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) return hit;

    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CounterpickAtlas/1.0; +https://adruztv.github.io/counterpick-atlas/)' },
      redirect: 'follow',
    });
    if (!upstream.ok) return new Response(`Blizzard returned ${upstream.status}`, { status: 502, headers: CORS });

    const res = new Response(upstream.body, {
      headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': `public, max-age=${EDGE_CACHE}` },
    });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
