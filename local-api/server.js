const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3003;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(__dirname, 'data.json');
const CLOTHING_FILE = path.join(__dirname, 'clothing-data.json');

// Ensure DATA_DIR exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const send = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
};

const handleDataRequest = (req, res, filePath) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const query = url.searchParams.get('q')?.toLowerCase();

    if (query) {
      const filtered = data.items.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
      return send(res, 200, { count: filtered.length, items: filtered });
    }
    return send(res, 200, data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return send(res, 500, { error: 'Failed to read data' });
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (pathname === '/health' && req.method === 'GET') {
    return send(res, 200, { status: 'ok', service: 'local-rest-api' });
  }

  if (pathname === '/api/objects' && req.method === 'GET') {
    return handleDataRequest(req, res, DATA_FILE);
  }

  if (pathname === '/api/clothing' && req.method === 'GET') {
    return handleDataRequest(req, res, CLOTHING_FILE);
  }

  // Handle dynamic local datasets
  const localMatch = pathname.match(/^\/api\/local\/([^/]+)$/);
  if (localMatch && req.method === 'GET') {
    const filePath = path.join(DATA_DIR, `${localMatch[1]}.json`);
    if (fs.existsSync(filePath)) {
      return handleDataRequest(req, res, filePath);
    }
  }

  return send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[LOCAL-API] Standing REST API running at http://localhost:${PORT}`);
  console.log(`[LOCAL-API] Objects: http://localhost:${PORT}/api/objects`);
  console.log(`[LOCAL-API] Clothing: http://localhost:${PORT}/api/clothing`);
});
