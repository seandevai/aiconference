# Backlog

Una riga per lavoro. Quando una voce entra in una slice, si sposta nel piano della
slice e qui resta solo il riferimento.

Riferimento: `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (v3).

## Slice 0 — Fondamenta

- [x] Repository, struttura cartelle, documentazione di base
- [x] Spec riconciliata dai due documenti sorgente
- [x] ADR per i conflitti fra Brief e PRD
- [x] Contratto delle variabili d'ambiente
- [x] Workflow CI con typecheck, lint, test
- [x] Spec v2 dopo il brainstorming del 22/09
- [x] Spec v3 dopo il brainstorming del 23/09, architettura e modello dati allineati
- [x] `npm install` e workspace funzionante
- [x] Scaffolding Next.js in `apps/web` con TypeScript strict
- [x] Supabase inizializzato in locale (`supabase init`, migrazioni)
- [x] Migrazione 0001: profiles, workspaces, workspace_members, con RLS (verificato su Supabase in CI)
- [x] Test che prova l'accesso RLS da utente non autorizzato (verificato su Supabase in CI)
- [ ] Progetto Supabase creato, credenziali in `.env.local`
- [ ] Deploy preview su Vercel funzionante

## Slice 1 — Auth e stanza

- [x] Registrazione, login e logout dell'host
- [x] Workspace personale creato alla registrazione
- [x] Migrazione 0002: rooms, room_participants (ruolo, lingua), con RLS (verificato su Supabase in CI)
- [x] Creazione stanza e generazione join code (verificato su Supabase in CI)
- [x] Ingresso ospite da link senza account: nome, lingua, riga in room_participants (verificato su Supabase in CI)
- [x] Controlli permessi server-side all'ingresso (verificato su Supabase in CI)
- [x] Shell UI: colonna video stretta e palco vuoto
- [x] Errori: stanza inesistente, chiusa, senza permesso

## Slice 2 — Call

- [x] `packages/realtime` sopra LiveKit: audio, video, `sendData`, `sendBytes`
- [x] Token di stanza emessi lato server, per host e ospite
- [x] Audio e video, 2+ partecipanti, mute e camera on/off
- [x] Presence dagli eventi LiveKit, mai su Postgres
- [x] Riconnessione con backoff e stato visibile
- [x] Vista mobile base da browser
- [x] Test del ciclo di vita con due client (`e2e/call.spec.ts`)
- [ ] **Spike CPU (mezza giornata):** MediaPipe + encode WebRTC + parola chiave + STT
      (protocollo e pagina `/dev/spike-cpu` pronti, misura di Sean)
- [ ] **Spike iOS Safari:** audio, video e DataChannel su iPhone reale (protocollo
      pronto, serve la preview con LiveKit Cloud, misura di Sean)

## Slice 3 — Palco

- [x] `packages/canvas`: Stage, Window, Content, riduttori puri
- [x] Slot magnetici: 1 grande più 3 piccole, aggancio al rilascio
- [x] Vassoio e archiviazione
- [x] Sincronizzazione a scrittore unico: `version`, comandi via DataChannel
- [x] Snapshot in KV e ripartenza di chi entra tardi o si riconnette
- [x] Trasferimento immagini via byte stream, mai su storage
- [x] Ogni comando raggiungibile col mouse
- [x] Vista mobile A: finestra in primo piano, segue l'host, swipe per sbirciare
- [x] Contenuti finti per provare il palco senza agente

## Slice 4 — Agente

- [x] Migrazione 0004: ai_requests, credit_ledger, con RLS in sola lettura (slice 4A)
- [x] `AIService` con risoluzione del pagante e quota **prima** del provider (pagante: host)
- [x] Scrittura ledger a ogni chiamata, anche fallita; rate limit
- [x] Crediti caricati a mano (`manual_grant`, `npm run credits:grant`)
- [ ] Parola chiave locale in ONNX, nome scelto (slice 4B, serve la decisione di Sean)
- [ ] Token STT a vita breve, solo all'host (slice 4B, serve il vendor STT)
- [ ] `packages/stt`: VAD, stream a comando, fine richiesta al silenzio (slice 4B)
- [x] `agent_generate`: grafici, testi, tabelle nel vassoio (richiesta scritta finché manca lo STT)
- [ ] Immagini dietro conferma esplicita (slice 4B, serve il provider di immagini)
- [x] Contatore agente visibile all'host
- [ ] Modalità companion, se il flusso a comando è stabile (slice 4B)
- [x] Test di accounting: N chiamate, saldo corretto

## Slice 5 — Gesture (prima demo)

- [x] `packages/gesture`: MediaPipe, classificatore (in parallelo dal giorno 1)
- [x] Dizionario ADR-0010 caricato come configurazione
- [x] Palmo aperto come interruttore; debounce e cooldown
- [x] Pinch-trascina-rilascia dal vassoio alle finestre
- [x] Frequenza adattiva e degrado ordinato
- [x] Test del classificatore su landmark sintetici, senza webcam (registrazioni reali:
      `/dev/gesture-recorder`, le aggiunge Sean)
- [ ] **Gate di prodotto:** far provare la demo a 5 consulenti veri (protocollo in
      `docs/spikes/2026-09-26-test-demo-consulenti.md`, lo conduce Sean)

## Slice 6 — Sottotitoli

- [ ] Token STT per ogni partecipante quando i sottotitoli sono accesi
- [ ] Traduzione per lingua presente in `AIService`
- [ ] Sottotitoli via DataChannel, ognuno nella sua lingua
- [ ] Interruttore e contatore separati
- [ ] Misura latenza end-to-end (obiettivo sotto 2 secondi)

## Slice 7 — Negoziazione

- [ ] Apertura dall'host con tetto modifiche e snapshot dell'originale
- [ ] Turno di scrittura all'ospite, agente in coda
- [ ] «Offro io» con `guest_credit_cap`, applicato lato server
- [ ] Tre esiti: tieni, torna, affianca; massimo due versioni
- [ ] Bottone ✨ ospite su mobile solo in negoziazione

## Slice 8 — Pacchetto

- [ ] Migrazione 0005: bundles, con RLS
- [ ] `packages/bundle`: raccolta, ZIP, cifratura AES-GCM nel browser
- [ ] Upload firmato su R2 con lifecycle 7 giorni
- [ ] Pagina `/p/<id>` che decifra nel browser, senza script di terze parti
- [ ] PDF riassuntivo a quota
- [ ] Avviso prima della chiusura: senza «termina» il pacchetto non esiste
- [ ] Job di purga delle stanze abbandonate
- [ ] Test: dopo la purga i dati di sessione non esistono

## Da verificare su Supabase reale

Docker locale non disponibile (virtualizzazione spenta nel BIOS). Si verifica nella CI
di GitHub e nel Codespace (`.devcontainer/`), che avvia Supabase e scrive `.env.local`.

- [x] `npm run test:db` (rls-workspaces, rls-rooms, create-room, join-room): 22 test
      verdi nel job `db` della CI, PR #1 e #2 del 25/09
- [x] `npx supabase db reset` nel Codespace
- [x] `npm run db:types` e confronto con i tipi scritti a mano in `packages/db`: colonne
      e nullabilità identiche, file sostituito col generato
- [x] `npm run test:e2e` completo (host e ospite, desktop e mobile): 4/4 nel Codespace
- [x] prove manuali dei task 1.1, 1.4, 1.7 del piano: 14 controlli automatizzati con
      Playwright e query SQL nel Codespace, screenshot a 390px verificato
- [ ] task 0.5: Supabase Cloud + Vercel preview
- [x] CI: `actions/checkout@v7`, `setup-node@v7`, `supabase/setup-cli@v3`
- [ ] CI: verificare il job `db` quando `ubuntu-latest` passa a Ubuntu 26 (19/10)
- [x] CI: job `e2e` su Supabase locale nel runner

## Post-MVP

- [ ] Piani, prezzi, Stripe
- [ ] Voce tradotta (doppiaggio live) a crediti
- [ ] App native: Tauri desktop, React Native mobile
- [ ] Host da mobile
- [ ] Modalità massima privacy: Whisper WASM on-device (ADR-0006)
- [ ] Disegno a mano libera nelle finestre (ADR-0002)
- [ ] Recording opzionale con policy di consenso dedicata
- [ ] Integrazioni calendario e storage
- [ ] SSO, audit log, API pubblica

## Debito e rischi da sciogliere

- [ ] Scegliere il vendor STT: qualità italiano, prezzo, zero retention
- [ ] Scegliere il provider di traduzione: latenza e costo per carattere
- [ ] Scegliere nome e modello della parola chiave; addestrarlo se serve
- [ ] Scegliere il provider di immagini su costo e latenza
- [ ] Firmare i DPA con vendor STT e LLM, zero retention per iscritto
- [ ] Misurare i costi reali e decidere l'economia
- [x] Indice unico host senza filtro `left_at`: l'host non rientra dopo l'uscita
      (slice 2)
- [ ] Ospite anonimo che reinvia il form crea righe aperte orfane; action pubblica
      senza rate limit
- [x] Cookie ospite con path `/room/<code>`: le route di token della slice 2 vanno
      sotto quel path
- [ ] Codice stanza case-sensitive: normalizzare maiuscolo/trim quando si digita a
      mano
- [x] Tipi `packages/db` scritti a mano: rigenerare
- [ ] `profiles.display_name` vuoto alla registrazione resta `''`: usare
      `nullif(trim(...),'')` e un check di lunghezza
- [ ] `rooms.created_by` senza `on delete`: blocca la cancellazione account quando
      arriveranno workspace multi-membro (GDPR)
- [ ] la pagina stanza scrive `room_participants` su GET: rivedere con la presence
      della slice 2
- [ ] Token route senza rate limit: gratuita, ma va limitata prima del lancio
- [ ] Chi chiude la scheda senza «Esci» lascia la riga aperta: la chiude la purga (slice 8)
- [ ] Rimuovere `/dev/spike-cpu` e le sue dipendenze dopo la misura
- [ ] L'host che ricarica perde i byte delle immagini: recuperarli da un ospite che li ha
- [ ] Contenuto `file` (documenti caricati) non ancora supportato dal palco
- [ ] `room:{id}:presence` in KV non serve finché LiveKit dà la presence: rivedere
- [ ] Contenuti di prova nel vassoio: nasconderli quando arriva l'agente (slice 4)
- [ ] Nessun heartbeat di versione: un ospite che perde l'ultimo comando resta indietro
      fino al comando successivo
- [ ] Richiesta scritta all'agente: tenerla anche dopo lo STT come via senza microfono?
- [ ] Contenuti di prova nel vassoio: toglierli quando `AI_PROVIDER=anthropic` è attivo
- [ ] Prezzi in `packages/ai/src/pricing.ts` scritti a mano: aggiornarli se cambia il listino
- [ ] Preview Vercel: `AI_PROVIDER=anthropic` e `ANTHROPIC_API_KEY` (con il task 0.5)
- [ ] Registrare gesture reali con `/dev/gesture-recorder` e aggiungerle ai test
- [ ] CONFIRM/REJECT a gesto non fanno ancora nulla: servono le immagini con conferma (4B)
- [ ] MediaPipe si scarica da jsdelivr e googleapis: valutare l'hosting dei file
- [ ] Soglie delle gesture tarate su mani sintetiche: ritararle con le registrazioni reali
- [ ] Preview Vercel: aggiungere `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`,
      `LIVEKIT_API_SECRET` del progetto LiveKit Cloud (con il task 0.5)
