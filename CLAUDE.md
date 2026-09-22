# CLAUDE.md — OmniCanvas AI

Istruzioni per chi lavora su questo repository, agenti inclusi.

## Cosa stiamo costruendo

Una videochiamata dove un canvas AI genera materiale visivo mentre si parla, e lo
si esplora con le mani. A fine riunione il lavoro esce come un unico PDF mentre i
dati della sessione vengono distrutti.

Tre pilastri, in ordine: canvas generativo dentro la call, controllo gestuale,
ephemerality.

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
6. **Ogni gesto ha il suo click equivalente.** Le gesture sono più veloci, mai
   l'unico modo. Vedi ADR-0005.

## Confini del codice

| Regola | Perché |
|---|---|
| LiveKit solo in `packages/realtime` | cambiare vendor deve costare un file |
| Provider AI solo in `packages/ai` | un unico punto per quota, costi, log |
| `packages/ui` non legge dati | componenti riusabili e testabili |
| STT solo in `packages/stt`, chiamato dal client | l'audio non tocca i nostri server |
| `packages/gesture` non conosce schede né stanze | riceve un `<video>`, emette comandi, si testa senza webcam |
| `packages/canvas` non sa da dove arriva un comando | mouse, gesto e agente passano dalla stessa funzione |
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
scritto.

Spec riscritta il 22/09 dopo brainstorming (versione 2). Cambiamenti rispetto alla
v1: le gesture entrano nell'MVP (ADR-0005), la trascrizione passa a vendor esterno
chiamato dal client (ADR-0006), il canvas diventa una lista di schede (ADR-0007),
layout 35/65 invece di 75/25. MVP = slice 0-7, stimato 8-11 settimane full-time.

Il prossimo passo è il piano in `docs/plans/`.

## Lingua

Documentazione e commenti in italiano. Codice, nomi di variabile, messaggi di commit
e messaggi di errore tecnici in inglese.
