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
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
EOF
fi

# Keep the public site non-frameable now that all figures are local assets.
sed -i "/^ohmium\.167-99-74-236\.sslip\.io {/,/^}/ s/X-Frame-Options \"SAMEORIGIN\"/X-Frame-Options \"DENY\"/" "$CADDYFILE"

cd /opt/cennomo
docker compose -f docker-compose.production.yml exec -T caddy caddy validate --config /etc/caddy/Caddyfile
docker compose -f docker-compose.production.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile
