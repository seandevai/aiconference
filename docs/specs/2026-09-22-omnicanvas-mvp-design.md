# OmniCanvas AI — Design MVP

**Data:** 22/09/2026 · **Versione:** 2 · **Stato:** approvata in brainstorming, da validare sul campo
**Fonti:** `docs/brief/build-brief.txt` (22/09, operativo) · `docs/brief/prd-omnicanvas.txt` (20/09, concept)
**Sostituisce:** la versione 1 dello stesso file, scritta prima della sessione di brainstorming del 22/09.

---

## 1. Perché esiste questa versione

La versione 1 riconciliava i due documenti sorgente ma sbagliava tre cose, emerse
discutendo il prodotto invece della sua architettura:

1. Metteva il verbale automatico al centro della vendita. Non è quello il prodotto:
   è una conseguenza.
2. Rinviava le gesture a dopo l'MVP. Sono un pilastro, non un accessorio.
3. Chiamava «trascrizione locale» la Web Speech API, che locale non è.

Questa versione corregge tutte e tre. Le decisioni contestate sono registrate in
`docs/adr/`.

---

## 2. Prodotto

**Cos'è.** Una videochiamata dove un canvas AI genera materiale visivo mentre si
parla, e lo si esplora con le mani. Non si condivide uno schermo: si costruisce
insieme, dentro la call.

**I tre pilastri, nell'ordine in cui contano:**

1. **Canvas AI generativo dentro la call.** Concept, schemi, varianti, prodotti
   dalla conversazione e non da un prompt in un'altra finestra.
2. **Controllo gestuale.** Swipe fra varianti, pinch per ingrandire, palmo per
   attivare. Nessun hardware oltre la webcam già accesa.
3. **Ephemerality.** Nulla resta sui nostri server. Il valore esce come PDF.

**Primo utente: consulenti e agenzie.** Call con cliente — kickoff, avanzamento,
raccolta brief. Sono raggiungibili uno a uno, pagano, e hanno già il dolore che il
prodotto risolve.

**Non è** una videochiamata con una chat AI a lato, e non è uno strumento per
scrivere verbali. Il verbale è il modo in cui il lavoro esce dalla stanza.

### 2.1 La scheda, unico modello mentale

Tutto ciò che il canvas produce è una **scheda**: un concept, un diagramma, un
elenco di decisioni, un'immagine. Le schede si aprono grandi, si rimpiccioliscono,
si scorrono.

Una scheda aperta occupa circa il 58% del canvas e lascia le altre visibili di
lato. Non copre mai tutto: perdere di vista il resto del lavoro non è un vantaggio.

Le gesture comandano schede. È questo che le rende sensate invece che decorative:
senza un oggetto da scorrere, uno swipe non significa niente.

### 2.2 Due velocità di generazione

| | Asset strutturati | Immagini |
|---|---|---|
| Esempi | diagrammi, timeline, elenchi decisioni, schede testo | concept visivi, mockup |
| Come nascono | **in bozza tratteggiata**, senza chiedere | **dietro conferma esplicita** |
| Se nessuno li tiene | svaniscono dopo un minuto, non entrano nel PDF | non vengono generati affatto |
| Perché | costano centesimi, arrivano in 1-2 secondi | costano e sono lente (5-15s) |

La soglia è il costo, non il tipo. Un asset sotto la soglia nasce da solo; sopra,
chiede. Questo risolve il rischio dei falsi positivi senza trasformare l'agente in
un generatore di popup.

### 2.3 Layout

Split asimmetrico **35/65**: colonna sinistra con le tessere video dei
partecipanti, canvas largo a destra.

Il 75/25 del PRD è stato scartato: in un quarto di larghezza un diagramma non si
legge, e un canvas illeggibile è un pannello di notifiche, non un posto di lavoro.

### 2.4 Cosa NON costruiamo

| Fuori | Perché |
|---|---|
| Whiteboard a mano libera | settimane di CRDT per un problema già risolto bene da altri (ADR-0002) |
| Sottotitoli live | nessuno legge la trascrizione della riunione a cui sta partecipando |
| Registrazione audio o video | contraddice la promessa, nemmeno dietro flag |
| Bundle come ZIP o pagina web | un solo artefatto: il PDF |
| Worker server per l'audio | non serve, e farebbe passare l'audio da una nostra macchina (ADR-0006) |

### 2.5 Accessibilità: regola non negoziabile

Ogni gesto ha il suo click equivalente. Le gesture sono un modo più veloce, mai
l'unico modo. Con webcam spenta o CPU satura il prodotto funziona lo stesso.

Questa non è disciplina, è la forma del codice: `packages/canvas` riceve comandi e
non sa se arrivano da un mouse, da una mano o dall'agente.

---

## 3. La promessa sui dati, scritta con precisione

> L'audio non raggiunge mai i nostri server. Viene trascritto dal browser di chi
> parla tramite un fornitore vincolato per contratto a non conservarlo. I landmark
> delle mani non escono nemmeno dal browser. Noi riceviamo solo testo, lo teniamo
> in memoria per pochi minuti e non lo scriviamo mai su disco. A riunione chiusa
> resta il PDF e nient'altro.

Verificabile, difendibile davanti a un DPO, senza asterischi. Il confine fra
metadati persistenti e contenuti effimeri è definito in ADR-0001.

**Persiste in Postgres:** utenti, profili, workspace, membership, record di stanza
(id, titolo, owner, creata_il, terminata_il), contatori AI, ledger crediti,
abbonamenti, email raccolte dal bundle gate.

**Non persiste mai:** audio, video, testo trascritto, prompt e output in chiaro,
hand landmark.

**Effimero con TTL:** schede del canvas e finestra di testo in KV per la durata
della sessione; PDF in object storage con TTL 7 giorni e link firmato.

Le righe di `ai_requests` registrano provider, modello, operazione, token, latenza,
costo ed esito. Mai il testo.

---

## 4. Architettura

### 4.1 Stack

- **App:** Next.js App Router, TypeScript strict, React, Tailwind con shadcn/ui.
- **Realtime:** LiveKit dietro `packages/realtime`. Nessuna chiamata al vendor fuori.
- **Dati:** Supabase Postgres con Auth e RLS deny by default.
- **Stato sessione:** KV con TTL (Upstash Redis o equivalente).
- **Storage:** Cloudflare R2, TTL 7 giorni, URL firmati.
- **STT:** vendor in streaming (Deepgram o AssemblyAI) con DPA zero-retention,
  chiamato **dal browser** con token a vita breve (ADR-0006).
- **AI:** un solo ingresso `AIService` in `packages/ai`, adapter per provider.
- **Computer vision:** MediaPipe `@mediapipe/tasks-vision`, interamente client-side.
- **Deploy:** Vercel. Nessun processo long-running da ospitare altrove.
- **Pagamenti:** Stripe Billing, post-MVP.

### 4.2 Package e confini

```
apps/web              Next.js App Router, unica superficie utente
packages/ui           design system, non legge dati
packages/realtime     astrazione LiveKit, unico file che nomina il vendor
packages/stt          cattura mic, VAD, streaming al vendor, emette righe di testo
packages/ai           AIService: quota, provider, ledger. Unico punto con chiavi LLM
packages/canvas       modello schede, riduttori, sincronizzazione
packages/gesture      MediaPipe, classificatore, debounce, comandi canvas
packages/db           schema, client tipizzato, tipi generati
supabase/migrations   SQL e policy RLS
```

`apps/web` può importare da qualsiasi package; i package non importano da
`apps/web`. `packages/ui` non importa da `packages/db` né da `packages/ai`.

`packages/gesture` riceve un elemento `<video>` ed emette comandi. Non sa cosa sia
una scheda né una stanza. Si testa con landmark registrati, senza webcam.

### 4.3 I quattro piani di stato

| Piano | Dove | Durata | Esempi |
|---|---|---|---|
| Persistente | Postgres | sempre | utenti, workspace, record stanza, ledger |
| Sessione | KV con TTL | durata stanza | schede, finestra di testo |
| Effimero | DataChannel | millisecondi | presence, mute, scheda aperta |
| Locale | RAM browser | frame | video grezzo, audio, hand landmark |

Presence, cursori e landmark **non generano mai una scrittura su Postgres**. Se una
feature sembra richiederlo, la feature è progettata male.

### 4.4 Il modello della scheda

```ts
type Card = {
  id: string                  // monotono, ordinabile
  kind: 'concept' | 'diagram' | 'document' | 'image'
  status: 'draft' | 'kept'
  variants: Variant[]         // lo swipe scorre queste
  activeVariant: number
  size: 'large' | 'small'
  order: number
  authorId: string
  expiresAt?: number          // solo le bozze
}
```

Il canvas è una lista ordinata di schede, sincronizzata via DataChannel e tenuta in
KV per la durata della sessione. Nessun CRDT: conflitto risolto con last-write-wins
sull'ordinamento più id monotono. A questa granularità basta.

Le bozze hanno `expiresAt`. Se nessuno le tiene, il riduttore le rimuove e non
entrano nel PDF.

### 4.5 Flusso audio → testo → agente

```
browser (ogni partecipante)
  ├─ mic locale → VAD → packages/stt → vendor STT
  │                     (token a vita breve emesso dal nostro server)
  └─ righe { speakerId, ts, text } → route server
       ↓
  finestra scorrevole in KV, TTL 5 minuti, mai su disco
       ↓
  ├─ canale VELOCE   ogni 2-3 frasi, modello piccolo, una domanda sola:
  │                  «è stato chiesto un asset?» → bozza o proposta
  └─ canale LENTO    ogni ~90 secondi: aggiorna documento e decisioni
```

Ogni partecipante trascrive **solo la propria traccia**. L'attribuzione per voce
esce gratis: ognuno etichetta sé stesso. Il token STT è emesso dal server dopo aver
verificato che l'utente sia in quella stanza, e dura quanto la sessione.

Il **VAD lato client è un requisito architetturale, non un'ottimizzazione**: senza,
i minuti fatturati triplicano (§6).

### 4.6 Flusso di una richiesta AI

```
client
  → route server (auth verificata, mai chiamata diretta al provider dal browser)
  → AIService.execute({ workspaceId, roomId, operation, input })
      1. controllo quota: crediti residui del workspace
      2. rate limit per utente e per workspace
      3. adapter del provider
      4. misura latenza ed esito
      5. riga su ai_requests (metadati, mai contenuto)
      6. scalo su credit_ledger
  → risposta al client
```

Se il passo 1 fallisce, il provider non viene chiamato. La quota è un cancello, non
un avviso. Nessun codice fuori da `packages/ai` conosce chiavi o nomi di modello.

### 4.7 Gesture: percorso interamente locale

```
webcam → MediaPipe (browser) → landmark → classificatore → debounce/cooldown → comando canvas
```

Nessun frame e nessun landmark lascia il dispositivo.

Il **palmo aperto** è l'interruttore di attivazione. Senza, ogni gesto involontario
mentre si parla sposta le schede.

**Frequenza adattiva:** se il frame rate cala sotto soglia, MediaPipe riduce il
passo prima che degradi il video. Il video vince sempre sulle gesture.

Dizionario MVP: `SWIPE_LEFT` / `SWIPE_RIGHT` (variante precedente/successiva),
`PINCH` aperto/chiuso (ingrandisce/rimpicciolisce la scheda), `OPEN_PALM`
(attiva/disattiva). Configurabili e disattivabili.

### 4.8 Ciclo di vita della stanza

```
CREATA        riga in rooms, nessuno stato in KV
ATTIVA        primo join: stato in KV con TTL, token LiveKit e STT emessi
IN CHIUSURA   host termina: schede tenute → composizione PDF
CHIUSA        rooms.ended_at valorizzato, KV cancellato
PURGATA       entro 10 minuti: asset temporanei rimossi, resta il PDF
SCADUTA       dopo 7 giorni: PDF rimosso, resta la riga in rooms
```

Il passaggio da CHIUSA a PURGATA deve avvenire **anche se l'host chiude il browser
senza premere nulla**: job programmato che purga le stanze senza presence da più di
N minuti. Una cancellazione che dipende da un click non è una promessa.

### 4.9 Autorizzazione

Tre livelli, tutti server-side:

1. **RLS su Postgres**, deny by default, ogni policy parte dall'utente autenticato.
2. **Controlli nelle route server** prima di ogni effetto.
3. **Token a vita breve** — LiveKit e STT — emessi solo dopo i due controlli sopra.

Il frontend nasconde i bottoni che non servono. Non è quello a proteggere nulla.

### 4.10 Errori

Ogni errore dice cosa è successo e cosa si può fare. Nessun «Something went wrong».

- **Rete e realtime:** riconnessione con backoff, stato visibile in UI.
- **Quota e permessi:** messaggio esplicito con l'azione possibile, non un 500.
- **Guasti AI:** degrado, non blocco. La stanza continua a funzionare.
- **Gesture non disponibili:** il prodotto resta pienamente usabile col mouse.

### 4.11 Telemetria senza contenuto

Log ricchi di struttura e vuoti di contenuto: id di correlazione per sessione,
passo della catena, esito, durata, codice di errore del provider. Mai testo, mai
prompt, mai output.

---

## 5. Modello dati v1

Persistenti: `profiles`, `workspaces`, `workspace_members`, `rooms`,
`room_participants`, `ai_requests`, `credit_ledger`, `subscriptions`,
`bundle_leads`. Colonne e policy in `docs/DATA-MODEL.md`.

Effimeri, in KV e mai in Postgres: `room:{id}:cards`, `room:{id}:presence`,
`room:{id}:transcript_window`.

Ogni tabella persistente ha `id`, `created_at`, `updated_at` e un owner
raggiungibile da una policy RLS. Nuova tabella e policy nella stessa migrazione.

---

## 6. Economia

Il PRD stimava 0,92 $ l'ora. Con le decisioni di questa versione il conto è più
alto, e il motivo è lo STT multi-traccia: quattro persone per un'ora fanno **240
minuti di audio**, non 60.

Con il VAD attivo, in una riunione normale parla una persona per volta: i minuti
fatturati scendono a 60-80.

| Voce | Costo/ora (4 partecipanti) |
|---|---|
| LiveKit audio e video | 0,12 $ |
| STT con VAD attivo | 0,25-0,32 $ |
| Canale lento (~40 chiamate) | 0,30-0,60 $ |
| Canale veloce (classificazione) | 0,05-0,15 $ |
| Immagini, solo su conferma | 0,30 $ ogni 5 |
| Composizione PDF | 0,05 $ |
| **Totale senza immagini** | **~0,80-1,25 $/ora** |

**Senza VAD il costo triplica.** È il singolo numero che può far saltare il modello.

Due leve da misurare, non da stimare: il modello del canale lento (uno piccolo lo
dimezza) e la frequenza (90 secondi invece di 60 taglia un terzo).

Vincolo di prodotto: nessuna funzione a costo variabile senza quota. L'utente non
deve poter generare costo illimitato per errore.

### 6.1 Prezzi di partenza

A ore incluse, mai illimitate.

| Piano | Prezzo | Ore/mese | Cosa |
|---|---|---|---|
| Free | 0 | 2 | watermark sul PDF, niente immagini |
| Solo | 29 € | 10 | logo proprio sul PDF |
| Studio | 79 € | 30 | 3 postazioni |
| Extra | 2,50 €/ora | — | oltre il piano |

Margine: ~11 € di costo su 29 € (Solo), ~33 € su 79 € (Studio). Regge, non è grasso.
Da rivedere appena ci sono dati reali.

Struttura fiscale prevista dal PRD, fuori scope tecnico ma vincola il pricing:
partita IVA forfettaria al 5%, ATECO 62.01.00, pressione effettiva ~13,4%,
passaggio a S.r.l. innovativa oltre 85.000 € l'anno.

---

## 7. Sicurezza e GDPR

- Segreti solo lato server, mai sotto `NEXT_PUBLIC_`.
- RLS attiva su ogni tabella, deny by default.
- Token LiveKit e STT emessi server-side dopo verifica dei permessi, vita breve.
- Audio e video mai registrati. Nessun recording nell'MVP, nemmeno dietro flag.
- Testo di sessione distrutto entro 10 minuti dalla chiusura.
- Link del PDF scaduto dopo 7 giorni.
- Hand landmark calcolati e consumati nel browser, mai inviati.
- Rate limiting su ogni endpoint che costa soldi.
- Cancellazione account e dati self-service.
- DPA con vendor STT e LLM, zero retention richiesta per iscritto.
- L'informativa distingue esplicitamente cosa resta nel browser e cosa raggiunge
  il fornitore STT.

---

## 8. Slice verticali

Ogni slice è software funzionante e dimostrabile da sola.

| # | Slice | Definition of Done |
|---|---|---|
| 0 | Fondamenta | repo, CI verde, typecheck strict, contratto env, schema e RLS applicati |
| 1 | Auth e stanza | registrazione, login, crea stanza, entra da link, shell 35/65 |
| 2 | Audio realtime | LiveKit audio, 2+ partecipanti, tracce separate, mute, reconnect, uscita |
| 3 | Agente e contabilità | STT per traccia con VAD, finestra in KV, canale lento, schede documento, `AIService` con ledger e quota |
| 4 | Final Bundle | PDF col logo, distruzione a 10 minuti, job di purga |
| 5 | Video | tessere partecipanti, camera on/off, griglia |
| 6 | Canvas generativo | canale veloce, bozze tratteggiate, varianti, immagini dietro conferma |
| 7 | Gesture | swipe, pinch, palmo, frequenza adattiva, click equivalente per ogni gesto |

**MVP = slice 0-7.** Stripe, whiteboard, ZIP e integrazioni restano fuori.

Tre note sull'ordine:

- **Il ledger nasce nella slice 3, non dopo.** La prima chiamata a pagamento avviene
  lì, e la regola 4 del `CLAUDE.md` vuole il cancello prima del provider.
- **`packages/gesture` si sviluppa in parallelo dalla settimana 1.** È isolato e si
  testa con landmark registrati. L'integrazione arriva alla slice 7 solo perché
  prima non esistono schede da comandare.
- **Alla slice 4 c'è qualcosa da far provare a un consulente vero.** Non è il
  prodotto finito, ma basta per scoprire se qualcuno lo vuole.

### 8.1 Tempi

| | Giorni lavorativi |
|---|---|
| Slice 0-2 | 11-15 |
| Slice 3-4 | 11-15 |
| Slice 5-7 | 17-24 |
| **Totale** | **39-54 → 8-11 settimane a tempo pieno** |

Il Build Brief indicava 3-4 settimane. Non è realistico con gesture e canvas
generativo dentro lo scope.

---

## 9. Definition of Done dell'MVP

Un utente si registra, crea una stanza, invita un secondo utente con un link.
Parlano in audio e video. L'agente costruisce schede dalla conversazione: quelle
strutturate appaiono in bozza, le immagini chiedono conferma. Le schede si aprono,
si rimpiccioliscono e si scorrono, con la mano e con il mouse. Il consumo viene
registrato e scalato dalla quota. L'host chiude la riunione, entrambi ricevono il
PDF, e dopo 10 minuti i dati della sessione non esistono più sui server.

Errori e permessi gestiti con messaggi comprensibili. Test su auth, permessi, ciclo
di vita della stanza, riduttori del canvas, classificatore gesti e accounting, più
uno smoke end-to-end del percorso principale.

---

## 10. Test

Scritti prima dell'implementazione, come da `CLAUDE.md`.

- **Unità:** riduttori canvas, classificatore gesti su landmark registrati, calcolo
  quota, VAD su campioni audio.
- **Integrazione:** RLS da utente non autorizzato, emissione dei token, accounting
  (N chiamate → saldo corretto).
- **Ciclo di vita:** due client, join/leave/reconnect; purga che avviene senza click
  dell'host.
- **Smoke E2E:** registrazione → stanza → audio → scheda → PDF.

---

## 11. Rischi aperti

1. **CPU satura.** MediaPipe a 30fps, encode video WebRTC e trascrizione nello
   stesso browser. Va misurato con uno spike di mezza giornata nella slice 2. Se non
   regge: frequenza gesture ridotta o attivazione su richiesta. Non spariscono, si
   degradano.
2. **Qualità del riassunto.** Se il PDF non è abbastanza buono da mandarlo a un
   cliente senza riscriverlo, il bundle non vale niente. Si scopre alla slice 4, non
   prima — ed è il vero gate del progetto.
3. **Falsi positivi del canale veloce.** Mitigati dalla bozza tratteggiata che
   svanisce e dalla conferma obbligatoria sopra soglia di costo. Da tarare con dati
   veri.
4. **Costo senza VAD.** Triplica. Il VAD è nella definizione di fatto della slice 3.
5. **Latenza delle immagini**, 5-15 secondi contro l'aspettativa di istantaneità.
   Mitigata dal fatto che le immagini sono sempre esplicite: chi ha cliccato sa di
   aver chiesto qualcosa.
6. **Ephemerality contro debug.** Senza log di contenuto, diagnosticare in produzione
   è difficile. Serve la telemetria strutturale di §4.11.
7. **Mercato presidiato.** Zoom, Meet e Teams hanno già l'AI companion e sono gratis
   o già pagati. Il differenziatore è il canvas generativo più le gesture, non la
   videochiamata. Da verificare con consulenti veri alla slice 4.
