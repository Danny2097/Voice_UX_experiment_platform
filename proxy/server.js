'use strict';

// ══════════════════════════════════════════════════════════════════
//  Voice Control Research Platform — CORS Proxy (port 3001)
//  Forwards browser requests to external museum / collection APIs.
//  All database operations are handled by api/server.js (port 3002).
//
//  Endpoint (after nginx strips /proxy/ prefix):
//    GET /proxy?url=<encoded-target-url>
//    GET /health
// ══════════════════════════════════════════════════════════════════

const http  = require('http');
const https = require('https');
const { URL } = require('url');

const PORT          = parseInt(process.env.PORT || '3001', 10);
const MAX_REDIRECTS = 5;
const TIMEOUT_MS    = 30000;

// Simple per-IP rate limiter: 60 req / min
const rateMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const window = 60000, max = 60;
    const entry = rateMap.get(ip) || { count: 0, reset: now + window };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + window; }
    entry.count++;
    rateMap.set(ip, entry);
    if (rateMap.size > 10000) rateMap.clear();
    return entry.count > max;
}

function respond(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(payload);
}

function proxyRequest(targetUrl, reqHeaders, res, redirectsLeft) {
    let urlObj;
    try { urlObj = new URL(targetUrl); }
    catch { return respond(res, 400, { error: 'Invalid target URL' }); }

    const transport = urlObj.protocol === 'https:' ? https : http;
    const opts = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': reqHeaders['accept'] || 'application/json, text/plain, */*',
            'Accept-Language': reqHeaders['accept-language'] || 'en-US,en;q=0.9',
        },
        timeout: TIMEOUT_MS
    };
    if (reqHeaders['x-auth-value']) {
        opts.headers['Authorization'] = `Bearer ${reqHeaders['x-auth-value']}`;
    }

    const proxyReq = transport.request(targetUrl, opts, (proxyRes) => {
        const { statusCode, headers } = proxyRes;
        if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location && redirectsLeft > 0) {
            proxyRes.resume();
            return proxyRequest(headers.location, reqHeaders, res, redirectsLeft - 1);
        }
        res.writeHead(statusCode, {
            'Content-Type': headers['content-type'] || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=60',
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => { proxyReq.destroy(); respond(res, 504, { error: 'Upstream timed out' }); });
    proxyReq.on('error',   (err) => { if (!res.headersSent) respond(res, 502, { error: err.message }); });
    proxyReq.end();
}

http.createServer((req, res) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type, x-auth-value',
        });
        return res.end();
    }

    if (pathname === '/health') return respond(res, 200, { status: 'ok', service: 'cors-proxy' });

    if (pathname === '/proxy' && req.method === 'GET') {
        if (isRateLimited(ip)) return respond(res, 429, { error: 'Rate limit exceeded' });
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return respond(res, 400, { error: 'Missing ?url= parameter' });
        let decoded;
        try { decoded = decodeURIComponent(targetUrl); }
        catch { return respond(res, 400, { error: 'Invalid URL encoding' }); }
        return proxyRequest(decoded, req.headers, res, MAX_REDIRECTS);
    }

    respond(res, 404, { error: 'Not found' });

}).listen(PORT, '0.0.0.0', () => console.log(`[PROXY] CORS proxy listening on port ${PORT}`));
