# OmniCanvas AI — Design MVP

**Data:** 22/09/2026 · **Stato:** bozza da confermare (sintesi di due documenti sorgente)
**Fonti:** `docs/brief/build-brief.txt` (22/09, operativo) · `docs/brief/prd-omnicanvas.txt` (20/09, concept)

---

## 1. Contesto

Due documenti sorgente descrivono lo stesso prodotto da due angoli diversi e in
alcuni punti si contraddicono. Questa spec è la fonte unica di verità: dove i due
divergono, la scelta è motivata qui e registrata come ADR in `docs/adr/`.

| Tema | Build Brief (22/09) | PRD OmniCanvas (20/09) | Scelta |
|---|---|---|---|
| Persistenza | Supabase, snapshot whiteboard, "salvataggio stato room" | Zero-data retention, stanza autodistrutta | **Split**: metadati persistenti, contenuti effimeri (ADR-0001) |
| Superficie collaborativa | Whiteboard condivisa con operazioni/undo/redo | AI Canvas 25%, generativo, non editabile a mano | **AI Canvas prima**, whiteboard dopo l'MVP (ADR-0002) |
| Layout | Non specificato | Split asimmetrico 75/25 | Asimmetrico 75/25 |
| Ordine build | Auth→Room→Video→Whiteboard→AI→Gesture | Non specificato | Auth→Room→Video→**AI Canvas**→Bundle→Gesture |
| Trascrizione | Non specificata | Web Speech API locale + LLM | Web Speech API locale con fallback (ADR-0004) |
| Chiusura sessione | Non specificata | Final Bundle PDF/ZIP + email gate | Dentro l'MVP, è l'hook di acquisizione |
| Gesture | Dopo il core loop | Dentro l'MVP (SWIPE, PINCH) | **Dopo il core loop**, vince il Brief (ADR-0003) |

## 2. Prodotto

**Cos'è:** una stanza di lavoro video-first dove un agente AI ascolta la
conversazione e genera asset nel pannello laterale in tempo reale, e dove a fine
riunione tutto viene impacchettato in un unico file scaricabile mentre i dati
della sessione vengono distrutti.

**Non è:** una video-call con una chat AI a lato. La differenza sta in tre cose,
nell'ordine in cui contano:

1. **Generazione contestuale senza prompt esplicito.** L'agente intercetta frasi
   chiave dalla trascrizione ("generiamo un'immagine di…", "facci uno schema di…")
   e produce l'asset senza che nessuno cambi finestra.
2. **Ephemerality come promessa vendibile.** Nessun contenuto della riunione resta
   sui server. È un argomento di vendita verso studi professionali, sanità, legale, HR.
3. **Final Bundle.** Il valore della riunione esce dalla stanza come un singolo PDF
   con riassunto e asset, non come una registrazione da riguardare.

Le gesture sono un differenziatore da demo, non il cuore del valore. Per questo
arrivano dopo che il loop di collaborazione è stabile.

## 3. Principio architetturale: il confine dei dati

Questo è il vincolo che governa ogni decisione tecnica del progetto.

**Persiste in Postgres:** utenti, profili, workspace, membership, record di stanza
(id, titolo, owner, creata_il, terminata_il), contatori di utilizzo AI, ledger
crediti, abbonamenti, email raccolte dal bundle gate.

**Non persiste mai:** flussi audio e video, trascrizioni, prompt e output
dell'agente in chiaro, asset generati oltre la finestra di sessione, hand landmark.

**Effimero con TTL:** stato della stanza viva in KV con TTL pari alla durata della
sessione, asset generati e Final Bundle in object storage con TTL 7 giorni e link
firmato.

**Le tabelle di usage registrano quanto è costata una richiesta, non cosa
conteneva.** Provider, modello, tipo operazione, token, latenza, costo, esito.
Mai il testo.

## 4. Architettura

- **Frontend e app:** Next.js App Router, TypeScript strict, React, Tailwind con shadcn/ui.
- **Realtime audio e video:** LiveKit dietro l'astrazione `packages/realtime`. Nessuna
  chiamata a LiveKit fuori da quel package, per non restare incastrati sul vendor.
- **Realtime effimero:** DataChannel LiveKit per stato canvas e presence. Nessuna
  scrittura su database per presence, cursori o hand landmark.
- **Dati:** Supabase Postgres con Auth e RLS. Autorizzazione sempre server-side,
  il frontend non è mai l'unico controllo.
- **Stato stanza viva:** store KV con TTL, Upstash Redis o equivalente.
- **Storage asset:** Cloudflare R2, oggetti con TTL 7 giorni e URL firmati.
- **AI:** un solo ingresso interno `AIService` in `packages/ai`, un adapter per
  provider, ogni chiamata passa da controllo quota, esecuzione, scrittura ledger.
- **Computer vision:** MediaPipe `@mediapipe/tasks-vision` interamente client-side.
- **Deploy:** Vercel.
- **Pagamenti:** Stripe Billing, abbonamento più crediti.

## 5. Modello dati v1

Persistenti: `profiles`, `workspaces`, `workspace_members`, `rooms`,
`room_participants`, `ai_requests`, `credit_ledger`, `subscriptions`,
`bundle_leads`. Colonne e policy in `docs/DATA-MODEL.md`.

Effimeri, in KV e mai in Postgres: `room:{id}:state`, `room:{id}:presence`,
`room:{id}:transcript_window`, `room:{id}:assets`.

Ogni tabella persistente ha `id`, `created_at`, `updated_at` e un owner
raggiungibile da una policy RLS.

## 6. Economia

Costo vivo stimato dal PRD: **circa 0,92 $ per ora** per una stanza da quattro
persone. Si scompone in 0,12 di WebRTC, 0,45 di trascrizione e agente, 0,30 di
generazione immagini, 0,05 di compilazione bundle. I piani a pagamento devono
coprirlo con margine.

Vincolo di prodotto: nessuna funzione a costo variabile senza quota. L'utente non
deve poter generare costo illimitato per errore. Il piano gratuito non include
generazione di immagini illimitata.

La metrica che guida il pricing è il **costo per sessione e per workspace attivo**,
non il costo mensile totale. Per questo il ledger arriva nella slice 4, prima delle
gesture e del billing.

Fascia prezzi di partenza: Free con limiti severi, Creator 12-19, Pro 29-49, Team
79-149 o per posto, Enterprise a preventivo.

## 7. Sicurezza e GDPR

- Segreti solo lato server, mai nel codice client, mai sotto `NEXT_PUBLIC_`.
- RLS attiva su ogni tabella, deny by default.
- Audio e video mai registrati. Nessun recording nell'MVP, nemmeno dietro flag.
- Log di sessione distrutti entro 10 minuti dalla chiusura della stanza.
- Link del Final Bundle scaduto dopo 7 giorni.
- Hand landmark calcolati e consumati nel browser, mai inviati.
- Rate limiting su ogni endpoint che costa soldi.
- Cancellazione account e dati self-service.
- DPA con i vendor LLM, zero retention lato provider richiesta per iscritto.

Struttura fiscale prevista dal PRD, fuori scope tecnico ma vincola il pricing:
partita IVA in regime forfettario al 5%, ATECO 62.01.00, pressione effettiva
attorno al 13,4%, passaggio a S.r.l. innovativa oltre 85.000 € l'anno.

## 8. Slice verticali

Ogni slice è software funzionante e dimostrabile da sola.

| # | Slice | Definition of Done |
|---|---|---|
| 0 | Fondamenta | repo, CI verde, typecheck strict, contratto env, schema e RLS applicati |
| 1 | Auth e stanza | registrazione, login, crea stanza, entra da link, shell UI 75/25 |
| 2 | Video | audio e video con due o più partecipanti, mute, camera off, reconnect, uscita |
| 3 | AI Canvas | trascrizione locale, trigger contestuale, immagine generata nel canvas |
| 4 | Usage | ogni chiamata AI a ledger, quota che blocca davvero, contatore in UI |
| 5 | Final Bundle | PDF con riassunto e asset, email gate, distruzione dati a 10 minuti |
| 6 | Gesture | MediaPipe locale, SWIPE e PINCH, disattivabili |
| 7 | Billing | Stripe, piani, crediti, entitlement |

**MVP uguale slice 0-5.** Le slice 6 e 7 sono post-MVP.

## 9. Definition of Done dell'MVP

Un utente si registra, crea una stanza, invita un secondo utente con un link,
parlano in audio e video, l'agente genera almeno un asset nel canvas a partire
dalla conversazione, il consumo viene registrato e scalato dalla quota, l'host
chiude la riunione, entrambi ricevono il Final Bundle via link, e dopo 10 minuti i
dati della sessione non esistono più sui server. Errori e permessi gestiti con
messaggi comprensibili. Test su auth, permessi, ciclo di vita della stanza,
accounting, più uno smoke end-to-end del percorso principale.

## 10. Rischi aperti

1. **Web Speech API** non è uniforme fra browser e non è affidabile su Safari. Il
   fallback è Whisper server-side, che alza il costo e obbliga a rispiegare
   l'ephemerality. Da verificare nella slice 3 prima di impegnarsi.
2. **Latenza di generazione immagini** fra 5 e 15 secondi contro l'aspettativa di
   istantaneità del PRD. Serve uno stato di caricamento credibile nel canvas.
3. **Falsi positivi del trigger contestuale.** Un agente che genera roba non
   richiesta brucia crediti e fiducia. Serve conferma esplicita almeno nella v1.
4. **Il costo di 0,92 $ l'ora** regge solo con sessioni corte. Un piano con ore
   illimitate a 19 € va in perdita sopra le venti ore al mese per utente.
5. **Ephemerality contro debug.** Senza log di contenuto, diagnosticare un problema
   in produzione è difficile. Serve telemetria strutturale che non contenga testo.
