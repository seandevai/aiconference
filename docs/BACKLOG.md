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
- [x] Migrazione 0001: profiles, workspaces, workspace_members, con RLS
- [x] Test che prova l'accesso RLS da utente non autorizzato
- [ ] Progetto Supabase creato, credenziali in `.env.local`
- [ ] Deploy preview su Vercel funzionante

## Slice 1 — Auth e stanza

- [x] Registrazione, login e logout dell'host
- [x] Workspace personale creato alla registrazione
- [x] Migrazione 0002: rooms, room_participants (ruolo, lingua), con RLS
- [x] Creazione stanza e generazione join code
- [x] Ingresso ospite da link senza account: nome, lingua, riga in room_participants
- [x] Controlli permessi server-side all'ingresso
- [x] Shell UI: colonna video stretta e palco vuoto
- [x] Errori: stanza inesistente, chiusa, senza permesso

## Slice 2 — Call

- [ ] `packages/realtime` sopra LiveKit: audio, video, `sendData`, `sendBytes`
- [ ] Token di stanza emessi lato server, per host e ospite
- [ ] Audio e video, 2+ partecipanti, mute e camera on/off
- [ ] Presence via DataChannel, mai su Postgres
- [ ] Riconnessione con backoff e stato visibile
- [ ] Vista mobile base da browser
- [ ] Test del ciclo di vita con due client
- [ ] **Spike CPU (mezza giornata):** MediaPipe + encode WebRTC + parola chiave + STT
- [ ] **Spike iOS Safari:** audio, video e DataChannel su iPhone reale

## Slice 3 — Palco

- [ ] `packages/canvas`: Stage, Window, Content, riduttori puri
- [ ] Slot magnetici: 1 grande più 3 piccole, aggancio al rilascio
- [ ] Vassoio e archiviazione
- [ ] Sincronizzazione a scrittore unico: `version`, comandi via DataChannel
- [ ] Snapshot in KV e ripartenza di chi entra tardi o si riconnette
- [ ] Trasferimento immagini via byte stream, mai su storage
- [ ] Ogni comando raggiungibile col mouse
- [ ] Vista mobile A: finestra in primo piano, segue l'host, swipe per sbirciare
- [ ] Contenuti finti per provare il palco senza agente

## Slice 4 — Agente

- [ ] Migrazione 0003: ai_requests, credit_ledger, con RLS in sola lettura
- [ ] `AIService` con risoluzione del pagante e quota **prima** del provider
- [ ] Scrittura ledger a ogni chiamata, anche fallita; rate limit
- [ ] Crediti caricati a mano (`manual_grant`)
- [ ] Parola chiave locale in ONNX, nome scelto
- [ ] Token STT a vita breve, solo all'host
- [ ] `packages/stt`: VAD, stream a comando, fine richiesta al silenzio
- [ ] `agent_generate`: grafici, testi, tabelle nel vassoio
- [ ] Immagini dietro conferma esplicita
- [ ] Contatore agente visibile all'host
- [ ] Modalità companion, se il flusso a comando è stabile
- [ ] Test di accounting: N chiamate, saldo corretto

## Slice 5 — Gesture (prima demo)

- [ ] `packages/gesture`: MediaPipe, classificatore (in parallelo dal giorno 1)
- [ ] Dizionario ADR-0010 caricato come configurazione
- [ ] Palmo aperto come interruttore; debounce e cooldown
- [ ] Pinch-trascina-rilascia dal vassoio alle finestre
- [ ] Frequenza adattiva e degrado ordinato
- [ ] Test del classificatore su landmark registrati, senza webcam
- [ ] **Gate di prodotto:** far provare la demo a 5 consulenti veri

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

- [ ] Migrazione 0004: bundles, con RLS
- [ ] `packages/bundle`: raccolta, ZIP, cifratura AES-GCM nel browser
- [ ] Upload firmato su R2 con lifecycle 7 giorni
- [ ] Pagina `/p/<id>` che decifra nel browser, senza script di terze parti
- [ ] PDF riassuntivo a quota
- [ ] Avviso prima della chiusura: senza «termina» il pacchetto non esiste
- [ ] Job di purga delle stanze abbandonate
- [ ] Test: dopo la purga i dati di sessione non esistono

## Da verificare appena c'è Docker

- [ ] `npx supabase start`, `.env.local`, `npx supabase db reset`
- [ ] `npm run db:types` e confronto con i tipi scritti a mano in `packages/db`
- [ ] `npm run test:db` (rls-workspaces, rls-rooms, create-room, join-room)
- [ ] `npm run test:e2e` completo (host e ospite, desktop e mobile)
- [ ] prove manuali dei task 1.1, 1.4, 1.7 del piano
- [ ] task 0.5: Supabase Cloud + Vercel preview

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
- [ ] Indice unico host senza filtro `left_at`: l'host non rientra dopo l'uscita
      (slice 2)
- [ ] Ospite anonimo che reinvia il form crea righe aperte orfane; action pubblica
      senza rate limit
- [ ] Cookie ospite con path `/room/<code>`: le route di token della slice 2 vanno
      sotto quel path
- [ ] Codice stanza case-sensitive: normalizzare maiuscolo/trim quando si digita a
      mano
- [ ] Tipi `packages/db` scritti a mano: rigenerare
