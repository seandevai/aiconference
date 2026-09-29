# Contratto delle variabili d'ambiente

Regola non negoziabile: una variabile con prefisso `NEXT_PUBLIC_` finisce nel
bundle del browser ed è pubblica. Nessuna chiave segreta può portare quel prefisso.
In caso di dubbio, la variabile è segreta.

## Client, pubbliche

| nome | uso | esempio |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | endpoint Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chiave anon, protetta da RLS | `eyJ...` |
| `NEXT_PUBLIC_LIVEKIT_URL` | endpoint WebSocket LiveKit | `wss://xxx.livekit.cloud` |
| `NEXT_PUBLIC_APP_URL` | base URL per i link di invito | `http://localhost:3000` |

La chiave anon è pubblica per disegno, ma è sicura **solo se le policy RLS sono
attive**. Se una tabella non ha RLS, quella chiave la espone a Internet.

## Server, segrete

| nome | uso |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | scritture su ledger e job di purga. Bypassa RLS |
| `GUEST_SESSION_SECRET` | firma HMAC del cookie dell'ospite senza account. Almeno 32 caratteri |
| `LIVEKIT_API_KEY` | firma dei token di stanza |
| `LIVEKIT_API_SECRET` | firma dei token di stanza |
| `DEEPGRAM_API_KEY` | emissione dei token STT a vita breve. Mai esposta al client (ADR-0006) |
| `ANTHROPIC_API_KEY` | agente, riassunti, classificazione intento |
| `OPENAI_API_KEY` | generazione immagini |
| `FAL_KEY` | generazione immagini alternativa |
| `R2_ACCOUNT_ID` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `R2_BUCKET` | nome del bucket asset |
| `KV_REST_API_URL` | store effimero |
| `KV_REST_API_TOKEN` | store effimero |
| `STRIPE_SECRET_KEY` | billing, post-MVP |
| `STRIPE_WEBHOOK_SECRET` | verifica firma webhook, post-MVP |
| `CRON_SECRET` | autentica il job di purga |

`SUPABASE_SERVICE_ROLE_KEY` bypassa ogni policy RLS. Va usata solo nelle route
server che ne hanno davvero bisogno, mai importata in un componente client, mai
passata a un package che venga incluso nel bundle browser.

## Regole

1. `.env.local` non entra mai in git. `.env.example` sì, con valori finti.
2. Ogni variabile nuova va aggiunta qui e in `.env.example` nello stesso commit che
   la introduce.
3. All'avvio l'applicazione valida le variabili con uno schema e fallisce subito se
   ne manca una, invece di rompersi a metà di una richiesta.
4. In produzione le variabili vivono su Vercel, gestite con `vercel env`. Nessun
   segreto passa da chat, ticket o screenshot.
5. La rotazione di una chiave non richiede un deploy di codice.

## Verifica rapida

Prima di ogni merge su main, nessun segreto deve comparire nel bundle client:

```bash
npm run build
grep -rEl "SERVICE_ROLE|sk-|sk_live|LIVEKIT_API_SECRET" apps/web/.next/static/ && echo "SEGRETO NEL BUNDLE" || echo "pulito"
```
