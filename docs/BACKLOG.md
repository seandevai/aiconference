# Backlog

Una riga per lavoro. Quando una voce entra in una slice, si sposta nel piano della
slice e qui resta solo il riferimento.

## Slice 0 — Fondamenta

- [x] Repository, struttura cartelle, documentazione di base
- [x] Spec riconciliata dai due documenti sorgente
- [x] ADR per i quattro conflitti fra Brief e PRD
- [x] Contratto delle variabili d'ambiente
- [x] Workflow CI con typecheck, lint, test
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
- [ ] Shell UI della stanza: split asimmetrico 75/25
- [ ] Gestione dei casi di errore: stanza inesistente, chiusa, senza permesso

## Slice 2 — Video

- [ ] Astrazione `packages/realtime` sopra LiveKit
- [ ] Emissione token di stanza lato server dopo verifica permessi
- [ ] Join e leave con audio e video
- [ ] Mute microfono, camera on e off
- [ ] Griglia partecipanti e presence via DataChannel
- [ ] Stato di rete visibile e riconnessione con backoff
- [ ] Test del ciclo di vita con due client

## Slice 3 — AI Canvas

- [ ] Verifica di copertura reale di Web Speech API sui browser target (ADR-0004)
- [ ] Trascrizione locale con finestra scorrevole
- [ ] Classificatore di intento sulle frasi trigger
- [ ] Conferma esplicita prima di generare, per evitare falsi positivi
- [ ] `AIService` con adapter per generazione immagini
- [ ] Rendering asset nel canvas con stato di caricamento credibile
- [ ] Sincronizzazione stato canvas via DataChannel e KV

## Slice 4 — Usage e quota

- [ ] Migrazione 0003: ai_requests, credit_ledger, con RLS in sola lettura
- [ ] Scrittura ledger a ogni chiamata, anche fallita
- [ ] Controllo quota che blocca prima della chiamata al provider
- [ ] Rate limit per utente e per workspace
- [ ] Contatore crediti visibile nella UI
- [ ] Test di accounting: N chiamate, saldo corretto

## Slice 5 — Final Bundle

- [ ] Riassunto esecutivo della sessione via LLM
- [ ] Composizione PDF con riassunto e asset
- [ ] Upload su R2 con URL firmato a 7 giorni
- [ ] Email gate con consenso marketing non preselezionato
- [ ] Job di purga delle stanze abbandonate senza click dell'host
- [ ] Test che verifica che dopo la purga i dati di sessione non esistano

## Post-MVP

- [ ] Slice 6: gesture MediaPipe, SWIPE e PINCH, disattivabili
- [ ] Slice 7: Stripe, piani, crediti, entitlement
- [ ] Whiteboard a mano libera (rinviata da ADR-0002)
- [ ] Recording opzionale con policy di consenso dedicata
- [ ] Integrazioni calendario e storage
- [ ] SSO, audit log, API pubblica

## Debito e rischi da sciogliere

- [ ] Decidere il provider di generazione immagini sul rapporto costo e latenza
- [ ] Verificare che 0,92 $ l'ora regga sui piani proposti
- [ ] Informativa privacy che distingue trascrizione locale e fallback server
- [ ] Telemetria strutturale che permetta il debug senza contenuti
