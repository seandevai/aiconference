# OmniCanvas AI

Videochiamata fra business e clienti con un agente AI attivato a comando, che
produce grafici, testi e immagini su un palco di finestre comandato con le mani.
Sottotitoli tradotti, e a fine riunione un pacchetto cifrato nel browser con un link
che scade.

**Stato:** slice 0, fondamenta. Nessun codice applicativo ancora scritto.

## Come è fatto

Next.js App Router e TypeScript strict per l'app, LiveKit dietro un'astrazione per
audio e video, Supabase Postgres con RLS per i metadati, KV con TTL per lo stato
della stanza viva, Cloudflare R2 per i pacchetti cifrati, MediaPipe nel browser per
le gesture.

Il vincolo che governa tutto: **in Postgres finiscono solo metadati**. Audio, video,
trascrizioni, prompt e output non toccano mai il disco in chiaro. Vedi `docs/adr/0001`
e `docs/adr/0008`.

## Documentazione

| File | Contenuto |
|---|---|
| `docs/specs/2026-09-23-omnicanvas-mvp-design.md` | cosa si costruisce e perché |
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
| 2 | Call | da fare |
| 3 | Palco | da fare |
| 4 | Agente | da fare |
| 5 | Gesture | da fare |
| 6 | Sottotitoli | da fare |
| 7 | Negoziazione | da fare |
| 8 | Pacchetto | da fare |

Prima demo = slice 0-5. MVP = slice 0-8. Dettagli in `docs/specs/2026-09-23-omnicanvas-mvp-design.md` §8.
