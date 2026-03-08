'use strict';

// ══════════════════════════════════════════════════════════════════
//  Voice Control Research Platform — API Server
//  Handles all database operations for the research platform.
//  Runs on port 3002 (internal only, exposed through nginx /api/).
// ══════════════════════════════════════════════════════════════════

const http = require('http');
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const PORT        = parseInt(process.env.API_PORT || '3002', 10);
const EXPORTS_DIR = process.env.EXPORTS_DIR || '/exports';
const AUDIO_DIR   = path.join(EXPORTS_DIR, 'audio');

// Map MIME → file extension (and reverse)
const MIME_TO_EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' };
const AUDIO_EXTS  = Object.values(MIME_TO_EXT); // ['webm','ogg','m4a','mp3']

// ── Database pool ─────────────────────────────────────────────────
const pool = new Pool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '5432', 10),
    database:           process.env.DB_NAME     || 'vrp',
    user:               process.env.DB_USER     || 'vrp_user',
    password:           process.env.DB_PASS     || 'vrp_pass',
    max:                10,
    idleTimeoutMillis:  30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[API] Unexpected pool error:', err.message));

// ── Auth helpers ──────────────────────────────────────────────────
const crypto = require('crypto');
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// ── Schema migration ───────────────────────────────────────────────
async function migrate() {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('[API] Schema applied');

    // Seed admin user
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';
    const hashed    = hashPassword(adminPass);

    await pool.query(`
        INSERT INTO users (username, password, role)
        VALUES ($1, $2, 'Admin')
        ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password
    `, [adminUser, hashed]);
    console.log(`[API] Admin user seeded: ${adminUser}`);
}

// ── Response helpers ───────────────────────────────────────────────
function send(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type':                'application/json',
        'Content-Length':              Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'no-store',
    });
    res.end(body);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            try   { resolve(JSON.parse(raw || '{}')); }
            catch (e) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

// Reads raw binary body (for audio uploads) — max 500 MB
function readBinaryBody(req, maxBytes = 500 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', chunk => {
            total += chunk.length;
            if (total > maxBytes) { req.destroy(); return reject(new Error('Upload exceeds 500 MB limit')); }
            chunks.push(chunk);
        });
        req.on('end',   () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

// Finds an audio file for a participant regardless of extension
function findAudioFile(expId, participantId) {
    for (const ext of AUDIO_EXTS) {
        const p = path.join(AUDIO_DIR, expId, `${participantId}.${ext}`);
        if (fs.existsSync(p)) return { filePath: p, ext };
    }
    return null;
}

// ── Route handler ──────────────────────────────────────────────────
async function handle(req, res) {
    const { method } = req;
    // Strip query string, normalise trailing slash
    const pathname = req.url.replace(/\?.*$/, '').replace(/\/+$/, '') || '/';

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    try {

        // ── GET /api/health ───────────────────────────────────────
        if (pathname === '/api/health' && method === 'GET') {
            await pool.query('SELECT 1');
            return send(res, 200, { status: 'ok' });
        }

        // ── POST /api/login ───────────────────────────────────────
        if (pathname === '/api/login' && method === 'POST') {
            const { username, password } = await parseBody(req);
            const hashed = hashPassword(password || '');
            const result = await pool.query(
                'SELECT id, username, role FROM users WHERE username = $1 AND password = $2',
                [username, hashed]
            );

            if (result.rows.length === 0) {
                return send(res, 401, { error: 'Invalid username or password' });
            }

            const user = result.rows[0];
            return send(res, 200, { ok: true, user: { id: user.id, username: user.username, role: user.role } });
        }

        // ── GET /api/mock-data ────────────────────────────────────
        if (pathname === '/api/mock-data' && method === 'GET') {
            const mockData = JSON.parse(fs.readFileSync(path.join(__dirname, 'mock-data.json'), 'utf8'));
            const urlObj = new URL(req.url, `http://localhost:${PORT}`);
            const query = urlObj.searchParams.get('q')?.toLowerCase();

            if (query) {
                const filtered = mockData.items.filter(item => 
                    item.title.toLowerCase().includes(query) || 
                    item.description.toLowerCase().includes(query) ||
                    item.category.toLowerCase().includes(query) ||
                    item.tags.some(tag => tag.toLowerCase().includes(query))
                );
                return send(res, 200, { count: filtered.length, items: filtered });
            }
            return send(res, 200, mockData);
        }

        // ── GET /api/experiments ──────────────────────────────────
        if (pathname === '/api/experiments' && method === 'GET') {
            const exps  = await pool.query(
                'SELECT * FROM experiments ORDER BY created_at DESC'
            );
            const parts = await pool.query(
                'SELECT * FROM participants ORDER BY started_at ASC'
            );
            const experiments = exps.rows.map(exp => ({
                id:          exp.id,
                name:        exp.name,
                description: exp.description,
                status:      exp.status,
                mode:        exp.mode,
                pis:         exp.pis_data,
                grid:        exp.grid_config,
                api:         exp.api_config,
                createdAt:   exp.created_at,
                updatedAt:   exp.updated_at,
                participants: parts.rows
                    .filter(p => p.experiment_id === exp.id)
                    .map(p => ({
                        id:           p.id,
                        experimentId: p.experiment_id,
                        startedAt:    p.started_at,
                        endedAt:      p.ended_at,
                        exported:     p.exported,
                        hasAudio:     !!findAudioFile(exp.id, p.id),
                    })),
            }));
            return send(res, 200, { experiments });
        }

        // ── POST /api/experiments (upsert) ────────────────────────
        if (pathname === '/api/experiments' && method === 'POST') {
            const exp = await parseBody(req);
            await pool.query(`
                INSERT INTO experiments
                    (id, name, description, status, mode, pis_data, grid_config, api_config, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name        = EXCLUDED.name,
                    description = EXCLUDED.description,
                    status      = EXCLUDED.status,
                    mode        = EXCLUDED.mode,
                    pis_data    = EXCLUDED.pis_data,
                    grid_config = EXCLUDED.grid_config,
                    api_config  = EXCLUDED.api_config,
                    updated_at  = NOW()
            `, [
                exp.id,
                exp.name        || 'Untitled Experiment',
                exp.description || '',
                exp.status      || 'Draft',
                exp.mode        || 'action_transcript',
                JSON.stringify(exp.pis  || {}),
                JSON.stringify(exp.grid || {}),
                JSON.stringify(exp.api  || {}),
            ]);
            return send(res, 200, { ok: true });
        }

        // ── GET /api/experiments/:id ─────────────────────────────
        const expMatch = pathname.match(/^\/api\/experiments\/([^/]+)$/);
        if (expMatch && method === 'GET') {
            const expId = expMatch[1];
            const exps = await pool.query(
                'SELECT * FROM experiments WHERE id = $1',
                [expId]
            );
            if (exps.rows.length === 0) {
                return send(res, 404, { error: 'Experiment not found' });
            }
            
            const parts = await pool.query(
                'SELECT * FROM participants WHERE experiment_id = $1 ORDER BY started_at ASC',
                [expId]
            );
            
            const exp = exps.rows[0];
            const experiment = {
                id:          exp.id,
                name:        exp.name,
                description: exp.description,
                status:      exp.status,
                mode:        exp.mode,
                pis:         exp.pis_data,
                grid:        exp.grid_config,
                api:         exp.api_config,
                createdAt:   exp.created_at,
                updatedAt:   exp.updated_at,
                participants: parts.rows.map(p => ({
                    id:           p.id,
                    experimentId: p.experiment_id,
                    startedAt:    p.started_at,
                    endedAt:      p.ended_at,
                    exported:     p.exported,
                    hasAudio:     !!findAudioFile(expId, p.id),
                })),
            };
            return send(res, 200, experiment);
        }

        // ── DELETE /api/experiments/:id ───────────────────────────
        if (expMatch && method === 'DELETE') {
            const expId = expMatch[1];
            await pool.query('DELETE FROM experiments WHERE id = $1', [expId]);
            // Delete audio folder for this experiment
            const expDir = path.join(AUDIO_DIR, expId);
            if (fs.existsSync(expDir)) {
                try { fs.rmSync(expDir, { recursive: true, force: true }); } catch(e) {}
            }
            return send(res, 200, { ok: true });
        }

        // ── POST /api/participants ────────────────────────────────
        if (pathname === '/api/participants' && method === 'POST') {
            const body = await parseBody(req);
            await pool.query(`
                INSERT INTO participants (id, experiment_id, started_at, ended_at, exported)
                VALUES ($1,$2,$3,NULL,FALSE)
                ON CONFLICT (id) DO NOTHING
            `, [
                body.id,
                body.experimentId,
                body.startedAt || new Date().toISOString(),
            ]);
            return send(res, 200, { ok: true, id: body.id });
        }

        // ── PUT /api/participants/:id ─────────────────────────────
        const partMatch = pathname.match(/^\/api\/participants\/([^/]+)$/);
        if (partMatch && method === 'PUT') {
            const body = await parseBody(req);
            await pool.query(
                'UPDATE participants SET ended_at=$1, exported=$2 WHERE id=$3',
                [body.endedAt || null, body.exported || false, partMatch[1]]
            );
            return send(res, 200, { ok: true });
        }

        // ── DELETE /api/participants/:id ──────────────────────────
        if (partMatch && method === 'DELETE') {
            const partId = partMatch[1];
            // 1. Get experiment ID to find audio folder
            const result = await pool.query('SELECT experiment_id FROM participants WHERE id = $1', [partId]);
            if (result.rows.length > 0) {
                const expId = result.rows[0].experiment_id;
                // 2. Delete database record (cascades to sessions)
                await pool.query('DELETE FROM participants WHERE id = $1', [partId]);
                // 3. Try to delete audio file if it exists
                const found = findAudioFile(expId, partId);
                if (found) {
                    try { fs.unlinkSync(found.filePath); } catch(e) {}
                }
            }
            return send(res, 200, { ok: true });
        }

        // ── POST /api/sessions ────────────────────────────────────
        if (pathname === '/api/sessions' && method === 'POST') {
            const body = await parseBody(req);
            // Store full session
            await pool.query(`
                INSERT INTO sessions (participant_id, experiment_id, session_data)
                VALUES ($1,$2,$3)
            `, [
                body.participantId,
                body.experimentId,
                JSON.stringify(body),
            ]);
            // Update participant end time if provided
            if (body.sessionEnd) {
                await pool.query(
                    `UPDATE participants
                     SET ended_at = $1, exported = FALSE
                     WHERE id = $2 AND ended_at IS NULL`,
                    [body.sessionEnd, body.participantId]
                );
            }
            return send(res, 200, { ok: true });
        }

        // ── GET /api/sessions/by-participant/:id ──────────────────
        const sessionMatch = pathname.match(
            /^\/api\/sessions\/by-participant\/([^/]+)$/
        );
        if (sessionMatch && method === 'GET') {
            const result = await pool.query(
                `SELECT session_data FROM sessions
                 WHERE participant_id = $1
                 ORDER BY created_at DESC LIMIT 1`,
                [sessionMatch[1]]
            );
            if (result.rows.length === 0)
                return send(res, 404, { error: 'No session found' });
            return send(res, 200, result.rows[0].session_data);
        }

        // ── GET /api/sessions/by-experiment/:id ───────────────────
        //    Returns all session rows for bulk export
        const expSessionMatch = pathname.match(
            /^\/api\/sessions\/by-experiment\/([^/]+)$/
        );
        if (expSessionMatch && method === 'GET') {
            const result = await pool.query(
                `SELECT session_data FROM sessions
                 WHERE experiment_id = $1
                 ORDER BY created_at ASC`,
                [expSessionMatch[1]]
            );
            return send(res, 200, { sessions: result.rows.map(r => r.session_data) });
        }

        // ── GET /api/grid-presets ────────────────────────────────
        if (pathname === '/api/grid-presets' && method === 'GET') {
            const result = await pool.query('SELECT * FROM grid_presets ORDER BY created_at DESC');
            return send(res, 200, { presets: result.rows });
        }

        // ── POST /api/grid-presets ───────────────────────────────
        if (pathname === '/api/grid-presets' && method === 'POST') {
            const body = await parseBody(req);
            const result = await pool.query(`
                INSERT INTO grid_presets (name, category, description, config)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [
                body.name,
                body.category || 'Custom',
                body.description || '',
                JSON.stringify(body.config)
            ]);
            return send(res, 200, result.rows[0]);
        }

        // ── PUT /api/audio/:experimentId/:participantId ───────────
        //    Accepts a raw audio blob (audio/webm, audio/ogg, audio/mp4)
        //    and writes it to /exports/audio/{expId}/{participantId}.{ext}
        const audioRwMatch = pathname.match(/^\/api\/audio\/([^/]+)\/([^/]+)$/);
        if (audioRwMatch && method === 'PUT') {
            const [, expId, partId] = audioRwMatch;
            const contentType = (req.headers['content-type'] || 'audio/webm').split(';')[0].trim();
            const ext = MIME_TO_EXT[contentType] || 'webm';
            const expDir = path.join(AUDIO_DIR, expId);
            fs.mkdirSync(expDir, { recursive: true });
            const filePath = path.join(expDir, `${partId}.${ext}`);
            const body = await readBinaryBody(req);
            fs.writeFileSync(filePath, body);
            console.log(`[API] Audio saved: ${expId}/${partId}.${ext} (${(body.length / 1024).toFixed(1)} KB)`);
            return send(res, 200, { ok: true, bytes: body.length, file: `${partId}.${ext}` });
        }

        // ── GET /api/audio/:experimentId/:participantId ───────────
        //    Streams the audio file back with download headers
        if (audioRwMatch && method === 'GET') {
            const [, expId, partId] = audioRwMatch;
            const found = findAudioFile(expId, partId);
            if (!found) return send(res, 404, { error: 'Audio not found for this participant' });
            const stat = fs.statSync(found.filePath);
            const mime = Object.entries(MIME_TO_EXT).find(([, e]) => e === found.ext)?.[0] || 'audio/webm';
            res.writeHead(200, {
                'Content-Type':                mime,
                'Content-Length':              stat.size,
                'Content-Disposition':         `attachment; filename="${partId}.${found.ext}"`,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control':               'no-store',
            });
            fs.createReadStream(found.filePath).pipe(res);
            return;
        }

        // ── GET /api/audio/:experimentId ──────────────────────────
        //    Lists all audio files available for an experiment
        const audioListMatch = pathname.match(/^\/api\/audio\/([^/]+)$/);
        if (audioListMatch && method === 'GET') {
            const expDir = path.join(AUDIO_DIR, audioListMatch[1]);
            if (!fs.existsSync(expDir)) return send(res, 200, { files: [] });
            const files = fs.readdirSync(expDir)
                .filter(f => AUDIO_EXTS.some(ext => f.endsWith(`.${ext}`)))
                .map(f => ({ filename: f, participantId: f.replace(/\.[^.]+$/, '') }));
            return send(res, 200, { files });
        }

        // ── 404 ───────────────────────────────────────────────────
        return send(res, 404, { error: `No route: ${method} ${pathname}` });

    } catch (err) {
        console.error('[API] Error:', err.message);
        return send(res, 500, { error: 'Internal server error', detail: err.message });
    }
}

// ── Startup ────────────────────────────────────────────────────────
async function start() {
    // Retry DB connection
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            await pool.query('SELECT 1');
            console.log('[API] Database connected');
            break;
        } catch (err) {
            if (attempt === 30) {
                console.error('[API] Could not connect to database after 30 attempts. Exiting.');
                process.exit(1);
            }
            console.log(`[API] Waiting for database... (${attempt}/30)`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    await migrate();

    // Ensure audio directory exists
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    console.log(`[API] Audio storage: ${AUDIO_DIR}`);

    http.createServer(handle).listen(PORT, '0.0.0.0', () => {
        console.log(`[API] Listening on port ${PORT}`);
    });
}

start().catch(err => {
    console.error('[API] Fatal startup error:', err);
    process.exit(1);
});
