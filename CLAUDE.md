# CLAUDE.md — OmniCanvas AI

Istruzioni per chi lavora su questo repository, agenti inclusi.

## Cosa stiamo costruendo

Una stanza di lavoro video-first dove un agente AI ascolta la conversazione e genera
asset nel pannello laterale, e dove a fine riunione tutto esce come un unico file
scaricabile mentre i dati della sessione vengono distrutti.

Leggere prima di toccare codice:

- `docs/specs/2026-09-22-omnicanvas-mvp-design.md` — cosa si costruisce e perché
- `docs/ARCHITECTURE.md` — struttura, confini, flussi
- `docs/adr/` — le decisioni contestate e il motivo
- `docs/WORKFLOW.md` — come si lavora
- `docs/plans/` — il piano della slice in corso

## Le cinque regole che non si violano

1. **Nessun contenuto di riunione tocca il disco.** Audio, video, trascrizioni,
   prompt e output in chiaro non vanno in Postgres, nei log o in un file. Solo
   metadati. Vedi ADR-0001.
2. **Autorizzazione sempre server-side.** RLS deny by default più controllo nella
   route. Nascondere un bottone non è sicurezza.
3. **Nessun segreto nel client.** Niente chiavi sotto `NEXT_PUBLIC_`, niente
   service role key importata in un componente.
4. **Ogni funzione che costa soldi passa da `AIService`** e scrive sul ledger, con
   controllo quota prima della chiamata al provider.
5. **Ogni cambiamento significativo ha un test**, e i test si scrivono prima.

## Confini del codice

| Regola | Perché |
|---|---|
| LiveKit solo in `packages/realtime` | cambiare vendor deve costare un file |
| Provider AI solo in `packages/ai` | un unico punto per quota, costi, log |
| `packages/ui` non legge dati | componenti riusabili e testabili |
| Presence e cursori mai su Postgres | il database non regge quel traffico e non serve |
| Nuova tabella, policy RLS nella stessa migrazione | altrimenti resta aperta |

## Comandi

```bash
npm install            # installa il workspace
npm run dev            # app in sviluppo su :3000
npm run typecheck      # TypeScript strict su tutto il monorepo
npm run lint           # ESLint
npm test               # unit e integrazione
npm run test:e2e       # smoke del percorso principale
npm run build          # build di produzione
```

## Metodo di lavoro

Task piccoli e verificabili. Per ognuno: leggere il piano, scrivere il test che
fallisce, verificare che fallisca, implementare il minimo, verificare che passi,
commit.

A fine task riportare: file toccati, comandi eseguiti, test ed esito, limitazioni
note, prossimi tre passi.

Non allargare lo scope in silenzio. Se emerge altro lavoro, va in `docs/BACKLOG.md`.

Non introdurre un'astrazione alla prima implementazione. Alla seconda.

Non toccare segreti, billing o policy di sicurezza senza dichiararlo nel piano.

## Stato attuale

Slice 0 in corso: fondamenta del repository. Nessun codice applicativo ancora
scritto. Il prossimo passo è il piano in `docs/plans/`.

## Lingua

Documentazione e commenti in italiano. Codice, nomi di variabile, messaggi di commit
e messaggi di errore tecnici in inglese.
