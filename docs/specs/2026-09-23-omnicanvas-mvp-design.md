# OmniCanvas AI — Design MVP

**Data:** 23/09/2026 · **Versione:** 3 · **Stato:** approvata in brainstorming, da validare sul campo
**Fonti:** `docs/brief/build-brief.txt` (22/09, operativo) · `docs/brief/prd-omnicanvas.txt` (20/09, concept)
**Sostituisce:** la versione 2 (22/09), nello stesso percorso fino al rename del 23/09.

---

## 1. Perché esiste questa versione

La v2 era corretta nell'architettura ma stretta nel prodotto. Rileggendola, Sean ha
rispiegato l'idea da capo e sono cambiate sei cose:

1. **Il canvas diventa un palco con finestre**, non una lista di schede (ADR-0009).
2. **L'agente si attiva a comando**, non ascolta sempre. La modalità continua esiste
   ma è esplicita.
3. **La traduzione entra nell'MVP** come sottotitoli tradotti. La voce tradotta
   viene dopo.
4. **Il cliente può negoziare** un contenuto, quando l'host lo concede.
5. **L'uscita è un pacchetto cifrato** con link che scade, non un PDF unico. Il PDF
   riassuntivo diventa un'opzione a quota (ADR-0008).
6. **L'economia si decide dopo.** Resta il principio: tutto a crediti, niente costo
   illimitato.

Restano dalla v2: STT vendor chiamato dal client (ADR-0006), gesture nell'MVP
(ADR-0005), ogni gesto con il suo click, confini dei package, `AIService` unico
ingresso per ciò che costa.

---

## 2. Prodotto

**Cos'è.** Una videochiamata fra business e clienti dove un agente AI produce
materiale mentre si parla — grafici, testi, immagini, traduzioni — e chi presenta lo
dispone nello spazio con le mani. Non si condivide uno schermo: si costruisce
insieme, dentro la call.

**Perché qualcuno dovrebbe lasciare Zoom o Meet.** Non per la videochiamata. Per tre
cose che lì non ci sono:

1. **Un palco generativo** comandato a voce e a gesti, stile Jarvis.
2. **Nessun vincolo di lingua**: ognuno legge l'altro nella propria lingua.
3. **Nessuno conserva la riunione**, nemmeno noi: il lavoro esce cifrato con una
   chiave che non abbiamo.

**Primo utente: chi vende o presenta a clienti** — consulenti, agenzie, studi. Call
con il cliente: kickoff, proposta, avanzamento. Chi conduce è sul desktop; il
cliente spesso entra dal telefono.

**Vincolo di progetto: investimento iniziale minimo.** Si preferiscono componenti
open source e free tier; ciò che non esiste o costa troppo lo costruiamo noi. Ogni
scelta di vendor passa da questa domanda.

### 2.1 Ruoli

| | Host | Ospite |
|---|---|---|
| Account | obbligatorio | no, entra da link |
| Dispositivo | desktop, gesture complete | desktop o mobile |
| Palco | manipola | guarda, segue l'host |
| Agente | lo attiva | solo dentro una negoziazione (§2.6) |
| Crediti | i suoi | i suoi se registrato, o quelli offerti dall'host |

L'host non conduce da mobile nell'MVP.

### 2.2 Il palco

Il canvas è un **palco a slot magnetici**: una finestra grande in primo piano e fino
a tre piccole a lato. Le finestre si spostano liberamente e si agganciano allo slot
più vicino al rilascio. Swipe o click cambiano quella in primo piano.

Una **finestra** è una superficie con un titolo che contiene **contenuti**: grafici,
testi, tabelle, immagini, documenti caricati. Una finestra vuota è una whiteboard.

In basso c'è il **vassoio**: ogni cosa che l'agente produce arriva lì. Chi presenta
la prende con un pinch (o col mouse) e la lascia in una finestra. Una finestra
mandata via con un flick torna nel vassoio come archiviata, non viene cancellata.

**Tutti vedono lo stesso palco. Solo l'host lo manipola**, salvo la negoziazione.

Disegno a mano libera escluso: una finestra contiene oggetti, non tratti (ADR-0002
resta valido su questo punto).

### 2.3 L'agente

Si attiva in tre modi equivalenti:

- **Parola chiave** («Ehi Omnia», nome provvisorio, ADR-0012), riconosciuta **nel browser**
- **Gesto**: indice alzato tenuto un secondo
- **Bottone ✨**

Attivato, ascolta la richiesta dell'host, la esegue e si spegne da solo dopo qualche
secondo di silenzio. Il risultato arriva nel vassoio.

**Modalità companion**, opzionale e dichiarata: l'agente ascolta in continuo e
propone contenuti di sua iniziativa, sempre nel vassoio. Consuma crediti per tutto
il tempo in cui è accesa, e l'interfaccia lo mostra.

Solo l'host attiva l'agente.

**Due velocità di costo**, come in v2: grafici, testi e tabelle si generano subito;
le immagini chiedono conferma (pollice su o ✓) perché costano e sono lente.

### 2.4 Sottotitoli tradotti

Ogni partecipante sceglie la propria lingua. Chi parla viene trascritto nel suo
browser, il testo viene tradotto e ognuno legge gli altri nella propria lingua.

È un **interruttore separato** dall'agente, perché accenderlo significa trascrivere
tutti per tutta la durata: consuma crediti in continuo.

La voce tradotta (doppiaggio live) è post-MVP, come funzione premium a crediti.

### 2.5 Mobile

Desktop con gesture è l'esperienza piena. Da mobile, via browser, si partecipa in
**visione**:

- la finestra in primo piano occupa quasi tutto lo schermo, i volti stanno piccoli a
  lato
- **segue l'host**: quando l'host cambia finestra, cambia anche sul telefono; uno
  swipe permette di sbirciare le altre
- sottotitoli tradotti in basso
- barra con microfono, camera, altro; il bottone ✨ compare solo in negoziazione

App native desktop e mobile sono post-MVP. Per non chiuderle, la logica vive nei
package e non nelle pagine Next.js: una futura app Tauri o React Native riscrive
solo la UI.

### 2.6 Negoziazione

Il modo in cui il cliente dice «io la vedo così». La decide sempre l'host.

1. L'host **apre la negoziazione** su un contenuto e fissa un **tetto di modifiche**.
2. All'apertura si fa uno **snapshot dell'originale**, in memoria come tutto il resto.
3. Il contenuto diventa **condiviso dal vivo**: l'ospite lo modifica a mano o con
   l'agente, entro il tetto. Entrambi vedono l'agente lavorare.
4. L'host **chiude** con uno di tre esiti: **tieni** la modifica, **torna**
   all'originale, **affianca** originale e proposta.

Mai più di **due versioni** dello stesso contenuto sul palco.

Chi paga l'agente dell'ospite: di default l'ospite, con un account e i suoi crediti
(anche quelli del piano gratuito — è un canale di acquisizione). L'host può attivare
**«offro io»** con un tetto per ospite. Le modifiche manuali sono sempre gratis.

### 2.7 Gesture

Dizionario **provvisorio e configurabile**, sufficiente per i test. L'abbinamento
definitivo si decide sui dati veri (ADR-0010).

| Gesto | Effetto | Click equivalente |
|---|---|---|
| Palmo aperto, 1s | arma/disarma le gesture | icona ✋ |
| Indice alzato, 1s | chiama l'agente | bottone ✨ |
| Pinch → trascina → rilascia | vassoio → finestra, o sposta finestra | drag & drop |
| Swipe sinistra/destra | cambia finestra in primo piano | frecce, click sulla piccola |
| Due mani che si allontanano | nuova finestra | «+ finestra» |
| Pollice su / giù | conferma / rifiuta | ✓ / ✗ |
| Flick verso l'alto | archivia la finestra nel vassoio | icona ⤴ |

Ogni gesto ha il suo click. Con webcam spenta o CPU satura il prodotto funziona lo
stesso.

### 2.8 A fine riunione: il pacchetto

Quando l'host chiude:

1. Il browser dell'host raccoglie **tutti i contenuti** — generati, caricati,
   archiviati — e, se attivo e nel piano, il **PDF riassuntivo**.
2. Li impacchetta (ZIP se più di un file) e **li cifra nel browser** con una chiave
   casuale.
3. Carica il blob cifrato su object storage con scadenza (default 7 giorni).
4. Genera il link `…/p/<id>#<chiave>` e lo mostra a tutti i partecipanti.

La parte dopo `#` non viene mai inviata al server. Sul nostro storage c'è solo un
blob che non possiamo leggere, e alla scadenza sparisce (ADR-0008).

**Il PDF riassuntivo** è a quota (es. 2 al mese nel piano gratuito). Riassume ciò che
l'agente ha potuto sentire: se sottotitoli o modalità companion erano attivi, la
conversazione; altrimenti le richieste e i contenuti prodotti. Il testo passa dal
provider AI per la composizione e torna al browser dell'host, che lo mette nel
pacchetto prima di cifrarlo.

### 2.9 Cosa NON costruiamo nell'MVP

| Fuori | Perché |
|---|---|
| Disegno a mano libera | settimane di CRDT per un problema già risolto da altri |
| Voce tradotta | costo alto, arriva dopo i sottotitoli |
| Registrazione audio o video | contraddice la promessa, nemmeno dietro flag |
| App native | investimento; la struttura a package le lascia possibili |
| Host da mobile | le gesture e il palco si conducono dal desktop |
| Stripe e piani | l'economia si decide dopo; nell'MVP crediti assegnati a mano |
| Worker server per l'audio | l'audio non passa dalle nostre macchine (ADR-0006) |

---

## 3. La promessa sui dati

> L'audio non raggiunge mai i nostri server: viene trascritto dal browser di chi
> parla, tramite un fornitore vincolato per contratto a non conservarlo, e solo
> quando l'agente o i sottotitoli sono accesi. I movimenti delle mani non escono dal
> browser. Il testo che riceviamo resta in memoria per pochi minuti e non viene mai
> scritto su disco. A fine riunione il lavoro esce in un pacchetto cifrato con una
> chiave che noi non abbiamo, e che sparisce dopo sette giorni.

**Persiste in Postgres:** utenti, profili, workspace, membership, record di stanza
(id, titolo, owner, creata_il, terminata_il), `ai_requests` (metadati), ledger
crediti, record dei pacchetti (id, stanza, dimensione, scadenza — mai la chiave).

**Non persiste mai:** audio, video, testo trascritto o tradotto, prompt e output in
chiaro, hand landmark, chiavi dei pacchetti.

**Effimero con TTL:** stato del palco e finestra di testo in KV per la durata della
sessione; blob cifrato del pacchetto su object storage per 7 giorni.

---

## 4. Architettura

### 4.1 Stack

- **App:** Next.js App Router, TypeScript strict, React, Tailwind con shadcn/ui.
- **Realtime:** LiveKit dietro `packages/realtime`. Si parte dal free tier di
  LiveKit Cloud; il self-hosting (è open source) resta l'uscita se i costi crescono.
- **Dati:** Supabase Postgres con Auth e RLS deny by default.
- **Stato sessione:** KV con TTL (Upstash Redis o equivalente).
- **Storage:** Cloudflare R2 con lifecycle a 7 giorni. Riceve solo blob cifrati.
- **STT:** vendor in streaming con DPA zero-retention, chiamato **dal browser** con
  token a vita breve (ADR-0006). Deepgram Nova-3 (ADR-0011).
- **Parola chiave:** modello piccolo in ONNX nel browser (openWakeWord,
  ADR-0012). Nessuna API, nessun costo per minuto.
- **Traduzione:** passa da `AIService`, provider da scegliere (§12).
- **AI:** un solo ingresso `AIService` in `packages/ai`, adapter per provider. Immagini:
  fal.ai FLUX schnell (ADR-0013).
- **Computer vision:** MediaPipe `@mediapipe/tasks-vision`, interamente client-side.
- **Cifratura del pacchetto:** Web Crypto API (AES-GCM), nel browser.
- **Deploy:** Vercel. Nessun processo long-running da ospitare altrove.

### 4.2 Package e confini

```
apps/web              Next.js App Router, unica superficie utente
packages/ui           design system, non legge dati
packages/realtime     astrazione LiveKit, unico file che nomina il vendor
packages/stt          cattura mic, VAD, parola chiave, streaming al vendor
packages/ai           AIService: quota, provider, ledger. Unico punto con chiavi
packages/canvas       palco, finestre, vassoio, negoziazione: modello e riduttori
packages/gesture      MediaPipe, classificatore, debounce, comandi
packages/bundle       raccolta contenuti, ZIP, cifratura, upload
packages/db           schema, client tipizzato, tipi generati
supabase/migrations   SQL e policy RLS
```

Regole invariate: `apps/web` importa da tutti, i package non importano da
`apps/web`, `packages/ui` non legge dati, `packages/gesture` riceve un `<video>` ed
emette comandi senza sapere cos'è una finestra.

`packages/canvas` riceve comandi e non sa se arrivano da mouse, mano o agente.

### 4.3 I quattro piani di stato

| Piano | Dove | Durata | Esempi |
|---|---|---|---|
| Persistente | Postgres | sempre | utenti, record stanza, ledger, record pacchetto |
| Sessione | KV con TTL | durata stanza | snapshot del palco, finestra di testo |
| Effimero | DataChannel | millisecondi | comandi del palco, presence, sottotitoli |
| Locale | RAM browser | frame | video, audio, landmark, chiave del pacchetto |

### 4.4 Modello del palco

```ts
type Stage = {
  windows: Window[]
  focusedId: string | null
  tray: Content[]               // prodotto dall'agente, non ancora piazzato, o archiviato
  negotiation: Negotiation | null
  version: number               // monotono, lo incrementa solo chi scrive
}

type Window = {
  id: string
  title: string
  slot: 'main' | 'side-1' | 'side-2' | 'side-3'
  contents: Content[]
}

type Content = {
  id: string
  kind: 'chart' | 'text' | 'table' | 'image' | 'file'
  data: unknown                 // specifico del kind
  forkOf?: string               // la proposta dell'ospite punta all'originale
  archived?: boolean
}

type Negotiation = {
  contentId: string
  snapshot: Content
  guestId: string
  editsLeft: number
  hostPays: boolean
}
```

**Un solo scrittore alla volta.** Di norma è l'host; durante una negoziazione il
contenuto negoziato ha come scrittore chi detiene il turno, e le richieste
all'agente vanno in coda. Lo scrittore applica il comando al riduttore, incrementa
`version` e lo trasmette via DataChannel. Gli altri applicano lo stesso comando. Uno
snapshot periodico in KV serve a chi entra tardi o si riconnette. Nessun CRDT.

### 4.5 Flusso dell'agente

```
browser host
  parola chiave | gesto | bottone
    → packages/stt apre lo stream verso il vendor STT (token a vita breve)
    → testo della richiesta, fine segnata dal VAD
    → route server → AIService.execute(...)
    → contenuto → comando TRAY_ADD → DataChannel a tutti
```

In modalità companion lo stream resta aperto; ogni ~90 secondi la finestra di testo
in KV viene valutata e l'agente può proporre contenuti al vassoio.

### 4.6 Flusso dei sottotitoli

```
browser di chi parla
  mic → VAD → vendor STT → riga { speakerId, ts, text, lang }
    → route server → AIService: traduce nelle lingue presenti nella stanza
    → risposta al browser di chi parla → DataChannel → ognuno mostra la sua lingua
```

Una traduzione per lingua presente, non per ascoltatore. Se tutti parlano la stessa
lingua, la traduzione non viene chiamata.

### 4.7 Flusso di una richiesta AI

Invariato dalla v2: route server con auth → `AIService.execute` → controllo quota →
rate limit → provider → `ai_requests` (metadati) → scalo sul ledger. Se la quota
fallisce, il provider non viene chiamato.

Il ledger addebita al **pagante** della richiesta: l'host, l'ospite registrato, o
l'host per conto dell'ospite con «offro io».

### 4.8 Gesture

```
webcam → MediaPipe → landmark → classificatore → debounce/cooldown → comando palco
```

Nessun frame né landmark lascia il dispositivo. Palmo aperto come interruttore.
Frequenza adattiva: il video vince sempre sulle gesture. Il gesto a due mani è il
primo a cadere se la CPU non regge.

### 4.9 Ciclo di vita della stanza

```
CREATA        riga in rooms
ATTIVA        primo join: stato in KV, token emessi
IN CHIUSURA   host termina: il suo browser compone e cifra il pacchetto
CHIUSA        rooms.ended_at valorizzato, KV cancellato
PURGATA       entro 10 minuti: nessuno stato di sessione sui server
SCADUTA       dopo 7 giorni: blob rimosso dal lifecycle di R2
```

Se l'host chiude il browser senza terminare, un job purga la stanza dopo N minuti
senza presence. In quel caso il pacchetto non viene prodotto: il contenuto viveva
solo nei browser. È il prezzo della promessa, e l'interfaccia lo dice prima.

### 4.10 Autorizzazione, errori, telemetria

Invariati dalla v2: RLS più controlli nelle route più token a vita breve; errori che
dicono cosa fare; log con struttura e senza contenuto.

In più: solo l'host (verificato server-side) può ottenere token per l'agente, aprire
una negoziazione, caricare un pacchetto. Il tetto di modifiche e «offro io» sono
applicati da `AIService`, non dal client.

---

## 5. Modello dati

Persistenti: `profiles`, `workspaces`, `workspace_members`, `rooms`,
`room_participants`, `ai_requests`, `credit_ledger`, `bundles`. Colonne e policy in
`docs/DATA-MODEL.md`.

Effimeri in KV: `room:{id}:stage`, `room:{id}:presence`,
`room:{id}:transcript_window`.

---

## 6. Economia

**Si decide dopo l'MVP, sui costi misurati.** Principi fissati ora:

- Tutto ciò che costa passa da `AIService` e scala crediti.
- Nessuna funzione a costo variabile senza tetto.
- Tre contatori distinti visibili all'host: **agente**, **sottotitoli**, **PDF**.
- L'agente a comando è la leva principale: lo STT gira solo quando serve.
- Nell'MVP i crediti si assegnano a mano; Stripe arriva con i piani.

Da misurare durante le slice 4 e 6: costo per richiesta all'agente, costo per ora di
sottotitoli con 2 e 4 persone, costo di un PDF.

---

## 7. Sicurezza e GDPR

Tutto quanto in v2, più:

- La chiave del pacchetto nasce nel browser e vive solo nel frammento del link.
  Nessun log, analytics o referrer deve poterla catturare: niente script di terze
  parti sulla pagina di download.
- Il server riceve dal pacchetto solo il blob cifrato e la sua dimensione.
- Il modello della parola chiave gira in locale: nessun audio lascia il browser
  finché l'agente non è attivato.
- L'informativa distingue: cosa resta nel browser, cosa va al vendor STT, cosa va al
  provider AI, cosa resta cifrato sul nostro storage.

---

## 8. Slice verticali

| # | Slice | Definition of Done |
|---|---|---|
| 0 | Fondamenta | repo, CI verde, typecheck strict, contratto env, schema e RLS |
| 1 | Auth e stanza | login host, crea stanza, ospite entra da link senza account |
| 2 | Call | LiveKit audio e video, 2+ partecipanti, mute, reconnect, vista mobile base |
| 3 | Palco | finestre, slot, vassoio, sync host → ospiti, snapshot KV, tutto a click, vista mobile A |
| 4 | Agente | parola chiave locale, STT a comando, `AIService` con quota e ledger, grafici e testi nel vassoio, immagini con conferma |
| 5 | Gesture | i 7 gesti integrati sul palco, frequenza adattiva |
| 6 | Sottotitoli | STT per traccia, traduzione per lingua presente, interruttore e contatore |
| 7 | Negoziazione | snapshot, turno di scrittura, tetto, «offro io», tre esiti |
| 8 | Pacchetto | ZIP cifrato nel browser, upload R2, link con chiave nel frammento, PDF a quota, purga |

**Prima demo = slice 0-5.** Due persone in call, l'host dice «Ehi Omnia, fammi un
grafico delle vendite», il grafico arriva nel vassoio, con un pinch va sul palco, il
cliente lo vede anche dal telefono.

**MVP = slice 0-8.** Piani, Stripe e voce tradotta dopo.

Note sull'ordine:

- `packages/gesture` si sviluppa **in parallelo dal giorno 1**, con landmark
  registrati. La slice 5 è integrazione, non sviluppo da zero.
- La modalità companion arriva nella slice 4 solo se il flusso a comando è stabile;
  altrimenti scivola dopo la 6, che condivide lo STT continuo.
- Il ledger nasce nella slice 4, con la prima chiamata a pagamento.

### 8.1 Tempi

| | Giorni lavorativi |
|---|---|
| Slice 0-2 | 10-14 |
| Slice 3 | 5-7 |
| Slice 4 | 7-10 |
| Slice 5 | 4-6 |
| **Prima demo** | **26-37 → 6-8 settimane** |
| Slice 6-8 | 14-20 |
| **MVP** | **40-57 → 8-12 settimane a tempo pieno** |

---

## 9. Definition of Done della prima demo

L'host si registra, crea una stanza e invita un ospite con un link; l'ospite entra
da desktop o da telefono senza account. Si vedono e si sentono. L'host chiama
l'agente con la voce, con un gesto o con un click; l'agente produce un grafico e un
testo nel vassoio; l'host li porta sul palco con un pinch e li dispone negli slot.
L'ospite vede tutto in tempo reale e da mobile segue l'host. Ogni richiesta scala
crediti e si ferma a quota esaurita. Tutto quello che si fa con le mani si fa anche
col mouse.

## 10. Test

Scritti prima dell'implementazione.

- **Unità:** riduttori del palco (incluso negoziazione), classificatore gesti su
  landmark registrati, calcolo quota e pagante, cifratura e decifratura del
  pacchetto.
- **Integrazione:** RLS da utente non autorizzato, emissione token solo all'host,
  accounting (N chiamate → saldo corretto), tetto negoziazione applicato lato server.
- **Ciclo di vita:** host e ospite, join/leave/reconnect con snapshot; purga senza
  click dell'host.
- **Smoke E2E:** login → stanza → ospite entra → agente → contenuto sul palco.

## 11. Rischi aperti

1. **La demo non convince.** È il nuovo gate del progetto: la prima demo va fatta
   provare a consulenti veri. Le gesture sono comode o solo scenografiche?
2. **CPU satura.** MediaPipe, encode WebRTC, parola chiave e STT nello stesso
   browser. Spike di mezza giornata nella slice 2.
3. **Parola chiave in italiano.** I modelli open sono addestrati soprattutto in
   inglese. Probabile addestramento di un modello nostro sul nome scelto.
4. **Latenza dei sottotitoli.** STT più traduzione devono stare sotto i 2 secondi
   per essere leggibili in una conversazione.
5. **Mobile Safari.** WebRTC, audio e DataChannel hanno limiti propri su iOS. Da
   provare presto, nella slice 2.
6. **Pacchetto perso.** Se l'host chiude il browser prima della fine, il lavoro non
   esce. Mitigazione: avviso esplicito e pacchetto intermedio su richiesta.
7. **Mercato presidiato.** Zoom, Meet e Teams hanno l'AI companion. Il
   differenziatore è palco più gesture più lingua più ephemerality, non la call.

## 12. Decisioni aperte

| Decisione | Quando serve | Criterio |
|---|---|---|
| ~~Vendor STT~~ deciso: Deepgram Nova-3 (ADR-0011) | slice 4 | qualità italiano, prezzo reale, zero-retention |
| Provider di traduzione | slice 6 | latenza, costo per carattere, lingue |
| Nome della parola chiave (modello deciso: openWakeWord, ADR-0012; «Ehi Omnia» provvisorio) | prima del test con utenti | riconoscibilità, tono amichevole, falsi positivi |
| Dizionario gesture definitivo | dopo la prima demo | test con utenti veri |
| Durata del link del pacchetto | slice 8 | default 7 giorni, forse per piano |
| Piani, prezzi, crediti | dopo l'MVP | costi misurati |
