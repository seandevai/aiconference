#!/usr/bin/env bash
# Avvia i servizi locali del Codespace: Supabase e LiveKit in modalità dev.
# Completa .env.local con le variabili che mancano, senza toccare quelle presenti.
set -euo pipefail

cd "$(dirname "$0")/.."

npx supabase start

if ! docker ps --format '{{.Names}}' | grep -qx livekit; then
  docker rm -f livekit >/dev/null 2>&1 || true
  docker run -d --name livekit --network host livekit/livekit-server:v1.13.7 --dev --bind 0.0.0.0
fi

# KV con la stessa API REST di Upstash: Redis più serverless-redis-http.
docker network inspect kv >/dev/null 2>&1 || docker network create kv >/dev/null
if ! docker ps --format '{{.Names}}' | grep -qx kv-srh; then
  docker rm -f kv-redis kv-srh >/dev/null 2>&1 || true
  docker run -d --name kv-redis --network kv redis:7-alpine
  docker run -d --name kv-srh --network kv -p 8079:80     -e SRH_MODE=env -e SRH_TOKEN=local_kv_token     -e SRH_CONNECTION_STRING=redis://kv-redis:6379     hiett/serverless-redis-http:0.0.10
fi

eval "$(npx supabase status -o env)"
touch .env.local
ensure() { grep -q "^$1=" .env.local || echo "$1=$2" >> .env.local; }

ensure NEXT_PUBLIC_SUPABASE_URL "$API_URL"
ensure NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON_KEY"
ensure NEXT_PUBLIC_APP_URL "http://localhost:3000"
ensure NEXT_PUBLIC_LIVEKIT_URL "ws://localhost:7880"
ensure SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
ensure GUEST_SESSION_SECRET "$(openssl rand -hex 32)"
# Chiavi fisse di `livekit-server --dev`: valgono solo per il server locale.
ensure LIVEKIT_API_KEY devkey
ensure LIVEKIT_API_SECRET secret
ensure KV_REST_API_URL "http://localhost:8079"
ensure KV_REST_API_TOKEN local_kv_token
ensure AI_PROVIDER fake
