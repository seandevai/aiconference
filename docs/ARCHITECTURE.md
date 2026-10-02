# Architettura — OmniCanvas AI

Documento vivo. Va aggiornato nello stesso commit che cambia la struttura, non dopo.

Riferimento di prodotto: `docs/specs/2026-09-23-omnicanvas-mvp-design.md` (v3).

## 1. Forma del repository

Monorepo con npm workspaces. Un'applicazione, package separati per i domini che
hanno confini veri.

```
apps/web                 Next.js App Router, l'unica superficie utente
packages/ui              design system, componenti senza logica di dominio
packages/realtime        astrazione LiveKit, unico punto che conosce il vendor
packages/stt             microfono, VAD, parola chiave locale, streaming al vendor STT
packages/ai              AIService, adapter provider, quota, accounting dei costi
packages/canvas          palco, finestre, vassoio, negoziazione: modello e riduttori
packages/gesture         MediaPipe, classificatore gesti, debouncing
packages/bundle          raccolta contenuti, ZIP, cifratura, upload del pacchetto
packages/db              schema, client tipizzato, tipi generati
supabase/migrations      migrazioni SQL e policy RLS
docs                     spec, piani, ADR, modello dati, contratto env
```

Regola di dipendenza: `apps/web` può importare da qualsiasi package. I package non
importano da `apps/web`. `packages/ui` non importa da `packages/db` né da
`packages/ai`: i componenti ricevono dati, non li vanno a prendere.

`packages/gesture` non conosce né finestre né stanze: riceve un elemento `<video>`
ed emette comandi. Si testa con landmark registrati, senza webcam. Per questo si
sviluppa in parallelo dal giorno 1 anche se si integra alla slice 5.

**Il cuore sta nei package, non nelle pagine.** Una futura app nativa (Tauri o
React Native) deve poter riusare `canvas`, `gesture`, `stt`, `bundle` e riscrivere
solo la UI. Logica di dominio dentro un componente di `apps/web` è un difetto.

## 2. I quattro piani di stato

Il bug più probabile di questo prodotto è mescolare questi piani. Tenerli separati è
la disciplina principale del progetto.

| Piano | Dove vive | Durata | Esempi |
|---|---|---|---|
| Persistente | Postgres | per sempre | utenti, workspace, record stanza, ledger, record pacchetto |
| Sessione | KV con TTL | durata della stanza | snapshot del palco, finestra di testo |
| Effimero | DataChannel | millisecondi | comandi del palco, presence, sottotitoli |
| Locale | memoria browser | frame | audio, video, landmark, byte delle immagini, chiave del pacchetto |

Presence, cursori e landmark **non generano mai una scrittura su Postgres**. Se una
feature sembra richiederlo, la feature è progettata male.

## 3. Il palco

Modello completo nella spec §4.4 e in ADR-0009. In breve:

```
Stage
 ├─ windows[]      fino a 4: slot 'main' + 'side-1..3', ognuna con contents[]
 ├─ focusedId      finestra in primo piano
 ├─ tray[]         prodotto dall'agente e non piazzato, o archiviato
 ├─ negotiation    null, oppure { contentId, snapshot, guestId, editsLeft, hostPays }
 └─ version        monotono
```

`packages/canvas` espone **riduttori puri** `(stage, command) → stage`. Non sa da
dove arrivi il comando: mouse, gesto o agente attraversano la stessa funzione. È
questo a rendere «ogni gesto ha il suo click» una proprietà del codice.

### 3.1 Sincronizzazione: un solo scrittore

```
host (unico scrittore)
  comando → applyCommand → version+1 → sendData('stage', { type: 'command', version, command })
         → dopo 1 s senza comandi: POST /room/<code>/stage (solo host) → KV room:{id}:stage
ospiti
  onData('stage') solo dall'identità con ruolo host → followMessage → stesso stato
  buco di versione → sendData('stage-sync') all'host → sendBytes('stage-snapshot') al richiedente
entrata tardiva o ripartenza
  GET /room/<code>/stage → snapshot in KV; l'host riparte da lì e lo ritrasmette a tutti
```

Niente CRDT, niente merge. Chi non è scrittore non invia comandi di palco; chi riceve
scarta i messaggi che non vengono dall'host del roster (ruolo firmato nel token).
Tutto ciò che arriva dalla rete passa dagli schemi Zod di `packages/canvas`. Finché
non ha ricevuto nulla dall'host, l'ospite ripete `stage-sync` ogni 2 secondi: la prima
richiesta può perdersi mentre il suo canale dati si apre.

### 3.2 Contenuti pesanti

Grafici, testi e tabelle sono dati piccoli e viaggiano nel comando. Le immagini no:
viaggiano come byte stream LiveKit dal browser dell'host agli ospiti e restano in
memoria. Lo snapshot in KV contiene solo il riferimento; chi entra tardi chiede i
byte al browser dell'host. **Le immagini non passano mai dal nostro storage** fino
al pacchetto cifrato.

Il formato del pacchetto è `packAsset`: 4 byte di lunghezza, header JSON
`{ assetId, mime }`, byte. L'ospite richiede le immagini mancanti ogni 3 secondi.
Se l'host ricarica la pagina perde i byte delle immagini: li chiede a tutti gli ospiti
ogni 3 secondi e accetta solo quelli la cui impronta SHA-256 coincide con quella scritta
nel riferimento (`ImageRef.sha256`). Finché nessuno li ha, il palco mostra «Immagine in
arrivo…».

## 4. Flusso dell'agente

```
browser host
  parola chiave (modello ONNX locale) | gesto AGENT_ACTIVATE | bottone ✨
    → token STT a vita breve (route server, solo host)
    → packages/stt apre lo stream verso il vendor
    → testo della richiesta, fine segnata dal VAD
    → route server → AIService.execute({ operation: 'agent_generate', ... })
    → contenuto → comando TRAY_ADD → DataChannel a tutti
```

Finché la parola chiave non scatta, **nessun audio lascia il browser**. Il modello
della parola chiave gira in locale.

**Modalità companion.** Lo stream STT resta aperto; le righe vanno nella finestra di
testo in KV (TTL 5 minuti). Ogni ~90 secondi `AIService` valuta la finestra e può
proporre contenuti al vassoio. L'interfaccia mostra che il contatore corre.

## 5. Flusso dei sottotitoli

```
browser di chi parla
  mic → VAD → vendor STT → { speakerId, ts, text, lang }
    → route server → AIService.execute({ operation: 'translate', targets })
    → risposta a chi parla → sendData('subtitles') → ognuno mostra la sua lingua
```

- `targets` = lingue presenti nella stanza meno quella di chi parla. Vuoto → nessuna
  chiamata.
- Una traduzione per lingua, non per ascoltatore.
- In modalità sottotitoli la riga va anche nella finestra di testo in KV, così il
  PDF riassuntivo può usarla.

Ogni partecipante trascrive **solo la propria traccia**. L'audio non raggiunge mai
una nostra macchina (ADR-0006). Il VAD non è un'ottimizzazione: senza, i minuti
fatturati triplicano.

## 6. Flusso di una richiesta AI

Ogni chiamata a un modello passa per la stessa catena, senza scorciatoie.

```
client
  → route server (auth verificata, mai chiamata diretta al provider dal browser)
  → AIService.execute({ roomId, participantId, operation, input })
      1. risoluzione del pagante: host, ospite registrato, o host per conto
         dell'ospite con «offro io» entro il tetto
      2. controllo quota sul workspace pagante
      3. rate limit per partecipante e per workspace
      4. adapter del provider scelto
      5. misura latenza ed esito
      6. riga su ai_requests (metadati, mai contenuto)
      7. scalo crediti su credit_ledger
  → risposta al client
```

Implementazione: `packages/ai/src/service.ts` (`executeAgent`) con le porte `AiLedger` e
`GenerateAdapter`. La quota è una riserva atomica (`ai_reserve_credits`) prima della
chiamata; dopo, `ai_record_request` registra la richiesta, scala il costo reale e
restituisce il resto della riserva. 1 credito = 0,01 USD stimati. Adapter: `anthropic`
(`claude-opus-5`, structured output, `fallbacks: 'default'`) e `fake` per sviluppo, CI
ed e2e (`AI_PROVIDER`).

Se i passi 1-2 falliscono, il provider non viene chiamato. La quota è un cancello,
non un avviso. Nessun codice fuori da `packages/ai` conosce chiavi API o nomi di
modello.

Il **tetto di modifiche** della negoziazione e il **tetto di «offro io»** sono
applicati qui, lato server. Il client li mostra, non li fa rispettare.

**Soglia di costo.** Grafici, testi, tabelle, traduzioni partono subito. Immagini e
PDF chiedono conferma esplicita prima della chiamata.

## 7. Confine del realtime

`packages/realtime` espone un'interfaccia che non nomina LiveKit:

- `connectToRoom(url, token)` restituisce una `RealtimeSession`
- `setMicrophoneEnabled`, `setCameraEnabled`, `attachVideo(identity, <video>)`
- `onRosterChange`, `onStatusChange`, `onDisconnected(cause)`, `onAudioBlockedChange`, `startAudio()`
- `sendData(channel, payload, to?)` e `onData(channel, handler)` — JSON fino a 15 KB
- `sendBytes(topic, bytes, to?)` e `onBytes(topic, handler)` — immagini
- lato server, da `@omnicanvas/realtime/server`: `createRoomToken()`

L'identità LiveKit è l'id di `room_participants`; ruolo e lingua sono attributi
firmati dal server e non modificabili dal client. Il token si emette da
`POST /room/<code>/token` solo a chi ha una riga aperta. Presence e stato dei media
arrivano dagli eventi LiveKit e non toccano Postgres. LiveKit si ricollega da solo ai
cali brevi; se rinuncia, `createReconnector` chiede un token nuovo con backoff
1-16 s e dopo cinque tentativi mostra «Riprova».

Il codice dell'applicazione parla solo a questa interfaccia. Il giorno in cui
LiveKit diventa caro o inadatto, si riscrive un file invece di trenta. Si parte dal
free tier di LiveKit Cloud; il self-hosting è l'uscita.

## 8. Gesture: percorso interamente locale

```
webcam → MediaPipe (browser) → landmark → classificatore → debounce/cooldown → comando palco
```

Nessun frame e nessun landmark lascia il dispositivo. Dizionario in ADR-0010,
caricato come configurazione.

- **Palmo aperto è l'interruttore.** Senza attivazione esplicita, ogni movimento
  involontario mentre si parla muove il palco.
- **Frequenza adattiva.** Se il frame rate cala sotto soglia, MediaPipe riduce il
  passo prima che degradi il video. Il video vince sempre.
- **Degrado ordinato.** Primo a cadere: il gesto a due mani (tracking doppio). Poi
  la frequenza. Mai una funzione: ogni comando resta a click.

Solo l'host usa le gesture nell'MVP.

Implementazione: `packages/gesture` ha un nucleo puro (`classifyPose`, `createRecognizer`,
`createAdaptiveController`) e un runner MediaPipe in `@omnicanvas/gesture/runner`, caricato
solo quando l'host preme ✋. Le gesture arrivano al palco da `resolveDrop` e
`gestureAction`, le stesse funzioni del mouse. I test girano su mani sintetiche e sulle
registrazioni in `tests/fixtures/gestures/`.

## 9. Il pacchetto

```
host termina
  → packages/bundle raccoglie contenuti dal palco e dal vassoio (byte dalla RAM)
  → se PDF attivo e in quota: AIService.execute({ operation: 'summarize_pdf' })
      input: finestra di testo in KV (se c'è) + elenco richieste e contenuti
  → ZIP se più di un file
  → chiave AES-GCM casuale (Web Crypto), cifratura nel browser
  → route server: crea riga in bundles, restituisce URL di upload firmato
  → upload del blob cifrato su R2 (lifecycle 7 giorni)
  → link …/p/<id>#<chiave> → sendData('bundle') a tutti
```

Il server vede: dimensione, stanza, scadenza. Non vede mai la chiave né il
contenuto. La pagina `/p/<id>` scarica il blob e decifra nel browser; non carica
script di terze parti, per non esporre il frammento (ADR-0008).

## 10. Ciclo di vita della stanza

```
CREATA        riga in rooms, nessuno stato in KV
ATTIVA        primo join: stato in KV con TTL, token emessi
IN CHIUSURA   host termina: il suo browser compone, cifra e carica il pacchetto
CHIUSA        rooms.ended_at valorizzato, KV cancellato, token revocati
PURGATA       entro 10 minuti: nessuno stato di sessione sui server
SCADUTA       dopo 7 giorni: blob rimosso dal lifecycle di R2, resta la riga in bundles
```

Il passaggio a PURGATA avviene **anche se l'host chiude il browser senza premere
nulla**: un job purga le stanze senza presence da più di N minuti. In quel caso il
pacchetto non esiste, perché i contenuti vivevano solo nei browser. L'interfaccia lo
dice prima, non dopo.

## 11. Autorizzazione

Tre livelli, tutti server-side:

1. **RLS su Postgres**, deny by default. Ogni policy parte dall'utente autenticato.
2. **Controlli nelle route server** prima di ogni effetto: chi chiede è nella
   stanza, ha il ruolo giusto, il pagante ha quota.
3. **Token a vita breve** — LiveKit e STT — emessi solo dopo i due controlli sopra.

Riservati all'host, verificati server-side: token STT per l'agente, apertura e
chiusura della negoziazione, «offro io», creazione del pacchetto. L'ospite ottiene
un token STT solo per i sottotitoli, se accesi.

L'ospite senza account entra con un token di stanza legato al `join_code` e a un
`room_participants.id`. Non ha sessione Supabase e non legge Postgres.

Il frontend nasconde i bottoni che non servono. Non è quello a proteggere nulla. Un
token STT rubato è audio di terzi trascritto a nostre spese: vita breve e revoca
alla chiusura non sono opzionali.

## 12. Errori

Ogni errore mostrato all'utente dice cosa è successo e cosa può fare. Nessun
"Something went wrong".

- **Rete e realtime:** riconnessione automatica con backoff, stato visibile. Al
  rientro l'ospite riparte dallo snapshot.
- **Quota e permessi:** messaggio esplicito con l'azione possibile, non un 500.
- **Guasti del provider AI:** degrado, non blocco. La call continua se l'immagine o
  la traduzione non arrivano.
- **Gesture non disponibili:** webcam negata o CPU satura non tolgono nessuna
  funzione.
- **Upload del pacchetto fallito:** retry dal browser dell'host finché è aperto;
  poi offerta di scaricare il file in locale.

## 13. Telemetria senza contenuto

Poiché non si possono loggare i contenuti (ADR-0001), i log devono essere ricchi di
struttura: id di correlazione per sessione, passo della catena, esito, durata,
codice di errore del provider. Mai prompt, mai testo trascritto o tradotto, mai
output, mai URL con frammento.
