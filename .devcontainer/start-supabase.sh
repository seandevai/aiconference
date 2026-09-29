#!/usr/bin/env bash
# Avvia Supabase locale nel Codespace e, se manca, scrive .env.local con le
# chiavi della sola istanza locale. Stesso schema del job `db` della CI.
set -euo pipefail

cd "$(dirname "$0")/.."

npx supabase start

if [ ! -f .env.local ]; then
  eval "$(npx supabase status -o env)"
  {
    echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
    echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
    echo "GUEST_SESSION_SECRET=$(openssl rand -hex 32)"
  } > .env.local
  echo ".env.local scritto per Supabase locale"
fi
