# CLAUDE.md — OmniCanvas AI

Istruzioni per chi lavora su questo repository, agenti inclusi.

## Cosa stiamo costruendo

Una videochiamata fra business e clienti dove un agente AI, attivato a comando,
produce grafici, testi e immagini mentre si parla, e chi presenta li dispone su un
palco di finestre con le mani. I sottotitoli tradotti tolgono il vincolo di lingua.
A fine riunione il lavoro esce in un pacchetto cifrato nel browser, con un link che
scade, mentre i dati della sessione vengono distrutti.

Pilastri, in ordine: palco generativo dentro la call, controllo gestuale, nessun
vincolo di lingua, ephemerality. Vincolo trasversale: investimento iniziale minimo.

Leggere prima di toccare codice:

- `docs/specs/2026-09-23-omnicanvas-mvp-design.md` — cosa si costruisce e perché
- `docs/ARCHITECTURE.md` — struttura, confini, flussi
- `docs/adr/` — le decisioni contestate e il motivo
- `docs/WORKFLOW.md` — come si lavora
- `docs/plans/` — il piano della slice in corso

## Le sei regole che non si violano

1. **Nessun contenuto di riunione tocca il disco.** Audio, video, trascrizioni,
   prompt e output in chiaro non vanno in Postgres, nei log o in un file. Solo
   metadati. Il pacchetto finale arriva allo storage solo cifrato nel browser, e la
   chiave non lascia mai il frammento del link. Vedi ADR-0001 e ADR-0008.
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
| `packages/gesture` non conosce finestre né stanze | riceve un `<video>`, emette comandi, si testa senza webcam |
| `packages/canvas` non sa da dove arriva un comando | mouse, gesto e agente passano dalla stessa funzione |
| Cifratura del pacchetto solo in `packages/bundle`, nel browser | il server non deve mai poter leggere il contenuto |
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

Slice 0, 1, 2 (call), 3 (palco), 4A (agente a comando con richiesta scritta,
`AIService`, ledger) e 5 (gesture) in `main` dal 29/09 (PR #1-#6), con la call da
telefono (PR #7). Nome di prodotto proposto: «Nod» (da verificare il marchio; bozze del
logo in `design/`, fuori da git). In `main` anche: redesign della call e del palco nella veste Nod
(antracite, lime, Manrope, laboratorio dell'host, PR #9), accesso «Sobrio» e dashboard «Agenda» (PR #10,
spec `docs/specs/2026-09-30-accesso-dashboard-design.md`), nucleo del pacchetto cifrato (slice 8, PR #13)
e della negoziazione (slice 7, PR #14), robustezza della call (PR #16), contratto delle variabili (PR #15),
report notturno del 02/10 (PR #19). PR aperte al 07/10: #11 profondità di call e palco, #17 untrack
`.claude/settings.json`, #18 recupero immagini dagli ospiti, #20 timer della stanza, #21 e #22
laboratorio gesture. Spike CPU e iOS in attesa di misura. Prima demo =
slice 0-5: completa lato codice salvo la voce (slice 4B), in attesa del test con i consulenti.
Laboratorio gesture `/dev/gesture-lab` su `slice/gesture-lab` (spec
`docs/specs/2026-10-05-gesture-lab-design.md`): solo sviluppo (`notFound()` in produzione), predefiniti
invariati e quindi call invariata; la traduzione gesto → palco sta in
`apps/web/src/lib/stage/stage-gesture-handler.ts`, condivisa da call e laboratorio. Su
`slice/gesture-lab-staging` il laboratorio va su staging per gli admin
(`docs/GESTURE-LAB.md`), con registrazioni e preset su Supabase (migrazione 0006). Redesign del laboratorio
(spec `docs/specs/2026-10-06-gesture-lab-redesign-design.md`, piano
`docs/plans/2026-10-07-gesture-lab-redesign.md`): pagina iniziale con Prova, Registra a passi
e Rigioca, tecnico in «Avanzate», usabile da telefono.

Spec v3 del 23/09, dopo un secondo brainstorming con Sean. Rispetto alla v2: palco a
finestre a slot magnetici invece della lista di schede (ADR-0009), agente a comando
con parola chiave locale e modalità companion opzionale, sottotitoli tradotti
nell'MVP, negoziazione del cliente aperta dall'host, pacchetto cifrato con link che
scade al posto del PDF unico (ADR-0008), dizionario gesture provvisorio (ADR-0010),
mobile in visione. Economia rinviata a dopo l'MVP.

Prima demo = slice 0-5 (6-8 settimane), MVP = slice 0-8 (8-12 settimane).

### Ripresa — dove eravamo (29/09/2026)

Spec v3 approvata; `ARCHITECTURE.md`, `DATA-MODEL.md` e `BACKLOG.md` allineati.

Piano delle slice 0-1: `docs/plans/2026-09-23-slice-0-1-fondamenta-auth-stanza.md`.

Slice 0 e 1 implementate e verificate su Supabase reale. Docker locale non gira
(virtualizzazione spenta nel BIOS), quindi si lavora con GitHub: repo privato
`seandevai/aiconference`, CI con job `db` ed `e2e` su Supabase nel runner, e un
Codespace (`.devcontainer/`) che avvia Supabase e scrive `.env.local`. `gh` è in
`C:\Program Files\GitHub CLI\gh.exe` (non nel PATH della sessione).

PR #1-#7 unite in `main` il 29/09 (merge commit, branch conservati). Il merge lo fa Sean: l'auto mode di Claude Code blocca `gh pr merge`. La build di produzione su
Vercel fallisce perché le variabili sono solo su Preview: voluto, per ora si testa su staging.

Call da telefono (`slice/mobile-call`, 27-29/09): orizzontale, tocco sul volto a tutto schermo,
«Gira fotocamera», PiP di chi parla (con iniziale e nome se ha la camera spenta), proprio
riquadro specchiato con la fotocamera anteriore. Checklist iPhone fatta il 29/09: PiP solo
dal pulsante «Riquadro», l'automatico allo swipe su iPhone non è possibile dal web. Worktree e2e nel Codespace: `/workspaces/aiconf-mobile`.

Staging (27/09): progetto Vercel `omnicanvas` (Root Directory `apps/web`, install
`cd ../.. && npm ci`), alias fisso `https://omnicanvas-staging.vercel.app`, Supabase
`aiconference` (ref `okymzngnbxkwklhfdrjj`, migrazioni 0001-0004), Upstash via Marketplace,
Deployment Protection disattivata, variabili su Preview. Deploy: `npx vercel deploy --yes`
poi `npx vercel alias set <url> omnicanvas-staging.vercel.app`. In Git Bash le chiamate
`npx vercel api /v...` vogliono `MSYS_NO_PATHCONV=1`.

Nel Codespace, `git` via SSH richiede `set -a; . /workspaces/.codespaces/shared/.env; set +a`
(il token non è esportato nelle sessioni SSH). LiveKit locale: `ws://localhost:7880`,
`devkey`/`secret`; KV locale `http://localhost:8079` (token `local_kv_token`); tutto
avviato da `.devcontainer/start-services.sh`. Per riavviare il server di sviluppo nel
Codespace: `pkill -f "[n]ext-server"` (il processo non si chiama `next dev`).

Il passo successivo, in ordine:

1. Sean: specchio su iPhone da verificare; checklist Android;
   misura degli spike CPU e iOS Safari; registrazioni reali delle gesture; test della demo
   con 5 consulenti (`docs/spikes/`).
2. Redesign della UI della call, desktop e mobile, con «Riquadro» più visibile: da fare
   partendo da un brainstorming con i mockup e da una spec.
3. Richieste di Sean del 06/10 (`docs/BACKLOG.md`, «ADVICES»): correggere «Gira fotocamera»
   su PC (l'immagine non deve diventare verticale), poi la condivisione dello schermo
   dell'host, da brainstorming e spec. Il PiP con lo swipe su iPhone resta fermo (limite di
   Safari, deciso il 29/09).
4. Slice 4B (parola chiave, STT, immagini, companion): servono le decisioni di Sean
   (spec §12) e le chiavi dei vendor.
5. Dopo il test con i consulenti: slice 6-8 (sottotitoli, negoziazione, pacchetto).

Decisioni prese e non da riaprire senza un ADR nuovo: palco a slot magnetici, solo
l'host scrive sul palco e attiva l'agente, negoziazione aperta dall'host con tetto e
massimo due versioni, sottotitoli sì e voce tradotta dopo, desktop con gesture e
mobile in visione, host non da mobile, pacchetto cifrato lato client, gesture
nell'MVP, STT vendor chiamato dal client con VAD, niente disegno a mano libera.

Decisioni aperte: spec §12 (vendor STT, traduzione, parola chiave, durata link,
prezzi).

I mockup stanno in `.superpowers/brainstorm/` (ignorato da git, resta su disco).

## Lingua

Documentazione e commenti in italiano. Codice, nomi di variabile, messaggi di commit
e messaggi di errore tecnici in inglese.
