#!/usr/bin/env sh
set -eu

: "${DEPLOY_ENV:=development}"
[ "$DEPLOY_ENV" = development ]

docker network inspect nilx-edge >/dev/null 2>&1
COMPOSE_PROJECT_NAME=zero-x-da-market-web-app-development docker compose -f "$(dirname "$0")/compose.yaml" up -d --build

for attempt in $(seq 1 30); do
  if docker run --rm --network nilx-edge curlimages/curl:8.10.1 -fsS http://market-web-app:1703/health >/dev/null; then
    exit 0
  fi
  sleep 2
done

COMPOSE_PROJECT_NAME=zero-x-da-market-web-app-development docker compose -f "$(dirname "$0")/compose.yaml" ps
exit 1
