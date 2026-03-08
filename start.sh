#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  Voice Control Research Platform — Container Startup Script
# ══════════════════════════════════════════════════════════════

# ── Credentials configuration ─────────────────────────────────
# Set ADMIN_USER and ADMIN_PASSWORD environment variables at
# docker run / docker compose time to override the defaults.
#
# Example (docker compose):
#   environment:
#     - ADMIN_USER=researcher
#     - ADMIN_PASSWORD=MySecurePassw0rd!
#
# Defaults if not set:
ADMIN_USER="${ADMIN_USER:-Admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Password}"

# ── Generate SHA-256 hashes via Node.js (already installed) ───
USER_HASH=$(node -e "
const crypto = require('crypto');
process.stdout.write(crypto.createHash('sha256').update('${ADMIN_USER}').digest('hex'));
")

PASS_HASH=$(node -e "
const crypto = require('crypto');
process.stdout.write(crypto.createHash('sha256').update('${ADMIN_PASSWORD}').digest('hex'));
")

# ── Write config.js to the nginx static directory ─────────────
# This file is loaded by index.html before the main script,
# setting window.VRP_ADMIN so the lock screen uses these hashes.
cat > /usr/share/nginx/html/config.js << EOF
/* Auto-generated at container start — do not edit manually */
window.VRP_ADMIN = {
  userHash: "${USER_HASH}",
  passHash: "${PASS_HASH}"
};
EOF

echo "[VRP] Config written — admin user: ${ADMIN_USER}"
echo "[VRP] Hashes: user=${USER_HASH:0:8}… pass=${PASS_HASH:0:8}…"

# ── Start the CORS proxy in background (port 3001) ────────────
echo "[VRP] Starting CORS proxy on port ${PORT:-3001}…"
cd /app/proxy && node server.js &

# ── Start the database API in background (port 3002) ──────────
echo "[VRP] Starting database API on port 3002…"
API_PORT=3002 node /app/api/server.js &

# ── Start nginx in foreground (keeps container alive) ─────────
echo "[VRP] Starting nginx…"
nginx -g 'daemon off;'
