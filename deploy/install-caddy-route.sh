#!/usr/bin/env sh
set -eu

CADDYFILE=/opt/cennomo/deploy/Caddyfile
MARKER='ohmium.167-99-74-236.sslip.io'
if [ ! -f "$CADDYFILE" ]; then
  echo "Tardumo Caddyfile not found at $CADDYFILE" >&2
  exit 1
fi

if ! grep -q "$MARKER" "$CADDYFILE"; then
  cp "$CADDYFILE" "${CADDYFILE}.before-ohmium"
  cat >> "$CADDYFILE" <<'EOF'

ohmium.167-99-74-236.sslip.io {
  encode zstd gzip
  reverse_proxy ohmium-core:4210
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
EOF
fi

# The interactive rack is served by Ohmium itself and must be frameable only by
# the same origin. Reconcile older installed blocks that still used DENY.
sed -i "/^ohmium\.167-99-74-236\.sslip\.io {/,/^}/ s/X-Frame-Options \"DENY\"/X-Frame-Options \"SAMEORIGIN\"/" "$CADDYFILE"

cd /opt/cennomo
docker compose -f docker-compose.production.yml exec -T caddy caddy validate --config /etc/caddy/Caddyfile
docker compose -f docker-compose.production.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile
