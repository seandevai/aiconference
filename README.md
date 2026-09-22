# OmniCanvas AI

Stanza di lavoro video-first dove un agente AI ascolta la conversazione e genera
asset nel pannello laterale in tempo reale. A fine riunione tutto esce come un unico
file scaricabile e i dati della sessione vengono distrutti.

**Stato:** slice 0, fondamenta. Nessun codice applicativo ancora scritto.

## Come è fatto

Next.js App Router e TypeScript strict per l'app, LiveKit dietro un'astrazione per
audio e video, Supabase Postgres con RLS per i metadati, KV con TTL per lo stato
della stanza viva, Cloudflare R2 per gli asset temporanei, Stripe per il billing.

Il vincolo che governa tutto: **in Postgres finiscono solo metadati**. Audio, video,
trascrizioni, prompt e output non toccano mai il disco. Vedi `docs/adr/0001`.

## Documentazione

| File | Contenuto |
|---|---|
| `docs/specs/2026-09-22-omnicanvas-mvp-design.md` | cosa si costruisce e perché |
| `docs/ARCHITECTURE.md` | struttura, confini, flussi |
| `docs/DATA-MODEL.md` | tabelle, RLS, stato effimero |
| `docs/ENVIRONMENT.md` | contratto delle variabili d'ambiente |
| `docs/WORKFLOW.md` | come si lavora, definition of done |
| `docs/BACKLOG.md` | cosa manca, per slice |
| `docs/adr/` | le decisioni contestate e il motivo |
| `docs/brief/` | i due documenti sorgente originali |

## Avvio

```bash
cp .env.example .env.local   # poi riempi i valori veri
npm install
npm run dev
```

## Comandi

```bash
npm run verify     # typecheck + lint + test, da lanciare prima di ogni merge
npm run dev        # app su :3000
npm test           # unit e integrazione
npm run test:e2e   # smoke del percorso principale
```

## Slice

| # | Slice | Stato |
|---|---|---|
| 0 | Fondamenta | in corso |
| 1 | Auth e stanza | da fare |
| 2 | Video | da fare |
| 3 | AI Canvas | da fare |
| 4 | Usage e quota | da fare |
| 5 | Final Bundle | da fare |
| 6 | Gesture | post-MVP |
| 7 | Billing | post-MVP |

MVP uguale slice 0-5.
