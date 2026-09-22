# Workflow di sviluppo

Un solo modo di lavorare, per ogni pezzo di prodotto. Serve a impedire che una
sessione lunga con un agente finisca per riscrivere mezzo progetto senza che nessuno
se ne accorga.

## Il ciclo

```
spec → piano → slice → task → test → review → merge → aggiorna docs
```

1. **Spec** in `docs/specs/AAAA-MM-GG-<nome>-design.md`. Cosa si costruisce e
   perché, non come. Le decisioni contestate diventano ADR.
2. **Piano** in `docs/plans/AAAA-MM-GG-<nome>.md`. Task a passi di 2-5 minuti, con
   il codice dei test scritto per esteso. Nessun "TODO" e nessun "gestire gli
   errori appropriati": se non è scritto, non è pianificato.
3. **Branch** per slice: `slice/<numero>-<nome>`, per esempio `slice/1-auth-room`.
4. **Task** uno alla volta, in ordine TDD: test che fallisce, verifica che
   fallisca, implementazione minima, verifica che passi, commit.
5. **Review** prima del merge: typecheck, lint, test, controllo del diff, verifica
   manuale riproducibile.
6. **Merge in main** a fine slice. Main resta sempre deployabile.
7. **Docs** aggiornate nello stesso commit che cambia il comportamento.

## Definition of Done di un task

Un task è finito quando tutte e sei sono vere:

- [ ] I test scritti per il task passano.
- [ ] `npm run typecheck` e `npm run lint` sono puliti.
- [ ] Esiste una prova manuale riproducibile, scritta nel commit o nel piano.
- [ ] Nessun segreto nel codice client.
- [ ] Se tocca i dati: RLS verificata con un test da utente non autorizzato.
- [ ] Se costa soldi: passa da `AIService` e scrive sul ledger.

## Convenzione dei commit

```
<tipo>(<ambito>): <cosa cambia>
```

Tipi: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
Ambiti: `web`, `realtime`, `ai`, `canvas`, `db`, `ui`, `gesture`, `ci`.

Esempio: `feat(db): schema rooms con policy RLS per membri workspace`

Commit frequenti e piccoli. Un commit che tocca quaranta file non è revisionabile.

## Regole per il lavoro con un agente

Queste valgono per Claude Code e per chiunque altro lavori sul repo.

1. **Leggere prima di scrivere.** Spec, ADR e piano della slice corrente prima di
   toccare codice.
2. **Niente astrazioni premature.** Un'interfaccia si introduce alla seconda
   implementazione reale, non alla prima ipotizzata.
3. **Non allargare lo scope in silenzio.** Se serve altro lavoro, si dice e si
   aggiunge al backlog. Non si fa e basta.
4. **Non toccare segreti, billing o policy di sicurezza** senza dichiararlo
   esplicitamente nel piano.
5. **Ogni cambiamento significativo ha un test.**
6. **Implementazione minima e reversibile.** Meglio un passo piccolo che regge che
   un salto elegante da rifare.
7. **Riportare a fine task:** file toccati, comandi eseguiti, test ed esito,
   limitazioni note, prossimi tre passi consigliati.

## Cosa fa fallire una review

- Un `any` in TypeScript senza commento che spieghi perché è inevitabile.
- Una query al database dentro un componente di `packages/ui`.
- Una chiamata a un provider AI fuori da `packages/ai`.
- Un riferimento a LiveKit fuori da `packages/realtime`.
- Una scrittura su Postgres nel percorso di presence o dei cursori.
- Un nuovo endpoint che costa soldi senza rate limit e senza controllo quota.
- Una tabella nuova senza policy RLS nella stessa migrazione.
- Contenuto di riunione scritto in un log o in una colonna.
