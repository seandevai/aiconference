# Backlog

Una riga per lavoro. Quando una voce entra in una slice, si sposta nel piano della
slice e qui resta solo il riferimento.

Riferimento: `docs/specs/2026-09-22-omnicanvas-mvp-design.md` (v2).

## Slice 0 — Fondamenta

- [x] Repository, struttura cartelle, documentazione di base
- [x] Spec riconciliata dai due documenti sorgente
- [x] ADR per i conflitti fra Brief e PRD
- [x] Contratto delle variabili d'ambiente
- [x] Workflow CI con typecheck, lint, test
- [x] Spec v2 dopo il brainstorming del 22/09
- [ ] `npm install` e workspace funzionante
- [ ] Scaffolding Next.js in `apps/web` con TypeScript strict
- [ ] Progetto Supabase creato, credenziali in `.env.local`
- [ ] Migrazione 0001: profiles, workspaces, workspace_members, con RLS
- [ ] Test che prova l'accesso RLS da utente non autorizzato
- [ ] Deploy preview su Vercel funzionante

## Slice 1 — Auth e stanza

- [ ] Registrazione ed email di conferma
- [ ] Login e logout
- [ ] Workspace personale creato automaticamente alla registrazione
- [ ] Migrazione 0002: rooms, room_participants, con RLS
- [ ] Dashboard con elenco stanze del workspace
- [ ] Creazione stanza e generazione join code
- [ ] Ingresso in stanza da link, con controllo permessi server-side
- [ ] Shell UI della stanza: split 35/65, colonne ancora vuote
- [ ] Gestione errori: stanza inesistente, chiusa, senza permesso

## Slice 2 — Audio realtime

- [ ] Astrazione `packages/realtime` sopra LiveKit, audio e video separabili
- [ ] Emissione token di stanza lato server dopo verifica permessi
- [ ] Join e leave con solo audio, tracce per partecipante
- [ ] Mute microfono
- [ ] Presence via DataChannel, mai su Postgres
- [ ] Stato di rete visibile e riconnessione con backoff
- [ ] Test del ciclo di vita con due client
- [ ] **Spike CPU (mezza giornata):** MediaPipe 30fps + encode WebRTC + STT insieme

## Slice 3 — Agente e contabilità

- [ ] Migrazione 0003: ai_requests, credit_ledger, con RLS in sola lettura
- [ ] `packages/stt`: cattura microfono e VAD lato client
- [ ] Route che emette il token STT a vita breve dopo verifica permessi
- [ ] Streaming al vendor STT, righe `{ speakerId, ts, text }` verso il server
- [ ] Finestra scorrevole in KV con TTL 5 minuti, mai su disco
- [ ] `AIService` con controllo quota **prima** della chiamata al provider
- [ ] Scrittura ledger a ogni chiamata, anche fallita
- [ ] Rate limit per utente e per workspace
- [ ] Canale lento: riassunto e decisioni ogni ~90 secondi
- [ ] Schede `kind: 'document'` renderizzate nel canvas
- [ ] Contatore crediti visibile nella UI
- [ ] Test di accounting: N chiamate, saldo corretto
- [ ] Verifica del costo reale per ora con VAD attivo

## Slice 4 — Final Bundle

- [ ] Composizione PDF dalle schede tenute, con logo del workspace
- [ ] Upload su R2 con URL firmato a 7 giorni
- [ ] Email gate con consenso marketing non preselezionato
- [ ] Watermark sul piano gratuito
- [ ] Job di purga delle stanze abbandonate senza click dell'host
- [ ] Test che verifica che dopo la purga i dati di sessione non esistano
- [ ] **Gate di prodotto:** far provare a 5 consulenti veri e raccogliere reazioni

## Slice 5 — Video

- [ ] Pubblicazione traccia video sopra la sessione esistente
- [ ] Tessere partecipanti nella colonna sinistra
- [ ] Camera on e off
- [ ] Comportamento con 2, 3 e 4 partecipanti

## Slice 6 — Canvas generativo

- [ ] `packages/canvas`: modello Card e riduttori puri
- [ ] Sincronizzazione schede via DataChannel e KV
- [ ] Canale veloce: classificatore di intento sulle ultime frasi
- [ ] Bozze tratteggiate con `expiresAt` e scadenza automatica
- [ ] Varianti per scheda, navigabili col mouse
- [ ] Ridimensionamento scheda large/small, apertura al 58%
- [ ] Adapter immagini in `AIService`, dietro conferma esplicita
- [ ] Stato di caricamento credibile per le immagini (5-15 secondi)
- [ ] Taratura della soglia di costo che separa bozza da conferma

## Slice 7 — Gesture

- [ ] `packages/gesture`: MediaPipe, landmark, classificatore (in parallelo dalla settimana 1)
- [ ] Dizionario: SWIPE_LEFT, SWIPE_RIGHT, PINCH, OPEN_PALM
- [ ] OPEN_PALM come interruttore di attivazione
- [ ] Debounce e cooldown
- [ ] Frequenza adattiva: il video vince sempre
- [ ] Impostazioni: configurabili e disattivabili
- [ ] Verifica che ogni gesto abbia il suo click equivalente
- [ ] Test del classificatore su landmark registrati, senza webcam

## Post-MVP

- [ ] Stripe, piani, crediti, entitlement
- [ ] Modalità massima privacy: Whisper WASM on-device (ADR-0006)
- [ ] Whiteboard a mano libera (rinviata da ADR-0002)
- [ ] Bundle come ZIP con asset sciolti
- [ ] Recording opzionale con policy di consenso dedicata
- [ ] Integrazioni calendario e storage
- [ ] SSO, audit log, API pubblica

## Debito e rischi da sciogliere

- [ ] Scegliere il vendor STT sul rapporto costo, latenza e qualità sull'italiano
- [ ] Firmare i DPA con vendor STT e LLM, zero retention per iscritto
- [ ] Decidere il provider di generazione immagini su costo e latenza
- [ ] Misurare il costo orario reale e rivedere i prezzi di conseguenza
- [ ] Informativa privacy che distingue cosa resta nel browser e cosa va al vendor
- [ ] Telemetria strutturale che permetta il debug senza contenuti
- [ ] Composizione PDF: rendere leggibile come verbale un insieme di schede
