# Guida — task 0.5: ambiente di staging

Da fare **una volta**, da Sean (servono account a suo nome). Tutti i piani gratuiti
bastano. Quando ha finito, Claude configura il resto e prova la preview.

## 1. Account da creare

| Servizio | Cosa creare | Cosa annotare |
|---|---|---|
| Supabase | progetto in regione UE (Francoforte) | Project ref, URL, anon key, service role key |
| LiveKit Cloud | progetto (free tier) | URL `wss://…`, API key, API secret |
| Upstash | database Redis (regione UE) | REST URL, REST token |
| Anthropic | chiave API | `sk-ant-…` |
| Vercel | account collegato a GitHub | — |

Le chiavi non vanno scritte in chat: si inseriscono direttamente con i comandi sotto.

## 2. Comandi (nel terminale di Claude Code, prefisso `!`)

```bash
# Supabase: collega il progetto e applica le 4 migrazioni
! npx supabase login
! npx supabase link --project-ref <ref>
! npx supabase db push

# Vercel: collega il repo (Root Directory = apps/web nelle impostazioni del progetto)
! npx vercel link
```

Variabili per l'ambiente Preview (ognuno chiede il valore, che non passa dalla chat):

```bash
! npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
! npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
! npx vercel env add NEXT_PUBLIC_APP_URL preview
! npx vercel env add NEXT_PUBLIC_LIVEKIT_URL preview
! npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
! npx vercel env add GUEST_SESSION_SECRET preview        # openssl rand -hex 32
! npx vercel env add LIVEKIT_API_KEY preview
! npx vercel env add LIVEKIT_API_SECRET preview
! npx vercel env add KV_REST_API_URL preview
! npx vercel env add KV_REST_API_TOKEN preview
! npx vercel env add AI_PROVIDER preview                 # anthropic
! npx vercel env add ANTHROPIC_API_KEY preview
```

In Supabase → Authentication → URL Configuration: Site URL = URL della preview Vercel.

## 3. Poi Claude fa

1. `npx vercel deploy` del branch `slice/5-gesture` e prova del percorso completo
   (registrazione, stanza, ospite da telefono, palco, agente vero, gesture).
2. Carica crediti di prova con `npm run credits:grant`.
3. Aggiorna BACKLOG (task 0.5 chiuso) e prepara la preview per lo spike iOS e per il
   test con i consulenti.
