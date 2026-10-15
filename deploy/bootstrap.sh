#!/usr/bin/env sh
set -eu

cd /opt/ohmium
mkdir -p data/core data/worker data/runs \
  data/workers/ohm-sense data/workers/ohm-filter data/workers/ohm-oracle \
  data/workers/ohm-guard data/workers/ohm-router data/workers/ohm-memory data/workers/ohm-archive
chown -R 1000:1000 data

if [ ! -f .env.production ]; then
  umask 077
  printf '%s\n' \
    "OHMIUM_ADMIN_TOKEN=$(openssl rand -hex 32)" \
    "OHMIUM_REGISTRATION_KEY=$(openssl rand -hex 32)" \
    "OHMIUM_ALLOWED_ORIGIN=https://ohmium.fun" \
    "DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)" > .env.production
fi

# The public frontend is served from the custom GitHub Pages domain. Keep the
# persisted production configuration aligned across later code deployments.
if grep -q '^OHMIUM_ALLOWED_ORIGIN=' .env.production; then
  sed -i 's|^OHMIUM_ALLOWED_ORIGIN=.*$|OHMIUM_ALLOWED_ORIGIN=https://ohmium.fun|' .env.production
else
  printf '%s\n' 'OHMIUM_ALLOWED_ORIGIN=https://ohmium.fun' >> .env.production
fi

if ! docker network inspect cennomo_default >/dev/null 2>&1; then
  echo "required Docker network cennomo_default is missing" >&2
  exit 1
fi

docker compose --env-file .env.production -f docker-compose.production.yml up -d --build --remove-orphans
docker compose --env-file .env.production -f docker-compose.production.yml ps
release_commit="$(cat .release-commit 2>/dev/null || git rev-parse HEAD 2>/dev/null || printf local)"
docker compose --env-file .env.production -f docker-compose.production.yml --profile tools run --rm -e "OHMIUM_RELEASE_COMMIT=${release_commit}" genesis
