# Architettura — OmniCanvas AI

Documento vivo. Va aggiornato nello stesso commit che cambia la struttura, non dopo.

Riferimento di prodotto: `docs/specs/2026-09-22-omnicanvas-mvp-design.md` (v2).

## 1. Forma del repository

Monorepo con npm workspaces. Un'applicazione, package separati per i domini che
hanno confini veri.

```
apps/web                 Next.js App Router, l'unica superficie utente
packages/ui              design system, componenti senza logica di dominio
packages/realtime        astrazione LiveKit, unico punto che conosce il vendor
packages/stt             cattura microfono, VAD, streaming al vendor STT
packages/ai              AIService, adapter provider, accounting dei costi
packages/canvas          modello e riduttori delle schede
packages/gesture         MediaPipe, classificatore gesti, debouncing
packages/db              schema, client tipizzato, tipi generati
supabase/migrations      migrazioni SQL e policy RLS
docs                     spec, piani, ADR, modello dati, contratto env
```

Regola di dipendenza: `apps/web` può importare da qualsiasi package. I package non
importano da `apps/web`. `packages/ui` non importa da `packages/db` né da
`packages/ai`: i componenti ricevono dati, non li vanno a prendere.

`packages/gesture` non conosce né schede né stanze: riceve un elemento `<video>` ed
emette comandi. Si testa con landmark registrati, senza webcam. Per questo si
sviluppa in parallelo dalla prima settimana anche se si integra per ultimo.

## 2. I quattro piani di stato

Il bug più probabile di questo prodotto è mescolare questi piani. Tenerli separati è
la disciplina principale del progetto.

| Piano | Dove vive | Durata | Esempi |
|---|---|---|---|
| Persistente | Postgres | per sempre | utenti, workspace, record stanza, ledger |
| Sessione | KV con TTL | durata della stanza | schede del canvas, finestra di testo |
| Effimero | DataChannel | millisecondi | presence, scheda aperta, stato mute |
| Locale | memoria browser | frame | audio, video grezzo, hand landmark |

Presence, cursori e hand landmark **non generano mai una scrittura su Postgres**.
Se una feature sembra richiederlo, la feature è progettata male.

## 3. Il canvas: una lista ordinata di schede

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

Niente CRDT: last-write-wins sull'ordinamento più id monotono (ADR-0007). Le bozze
scadono da sole e non entrano nel PDF.

`packages/canvas` espone riduttori puri che ricevono comandi. **Non sa da dove
arrivino.** Mouse, gesto o agente attraversano la stessa funzione: è questo a rendere
«ogni gesto ha il suo click» una proprietà del codice invece che una promessa.

## 4. Flusso audio → testo → agente

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

Ogni partecipante trascrive **solo la propria traccia**: l'attribuzione per voce
esce gratis. L'audio non raggiunge mai una nostra macchina (ADR-0006).

Il VAD non è un'ottimizzazione: senza, i minuti fatturati triplicano.

## 5. Flusso di una richiesta AI

Ogni chiamata a un modello passa per la stessa catena, senza scorciatoie.

```
client
  → route server (auth verificata, mai chiamata diretta al provider dal browser)
  → AIService.execute({ workspaceId, roomId, operation, input })
      1. controllo quota: crediti residui del workspace
      2. rate limit per utente e per workspace
      3. adapter del provider scelto
      4. misura latenza ed esito
      5. scrittura riga su ai_requests (metadati, mai contenuto)
      6. scalo crediti su credit_ledger
  → risposta al client
```

Se il passo 1 fallisce, non si chiama il provider. La quota è un cancello, non un
avviso. Nessun codice fuori da `packages/ai` conosce chiavi API o nomi di modello.

**Soglia di costo.** Sotto soglia l'asset nasce da solo, in bozza. Sopra, richiede
conferma esplicita dell'utente prima della chiamata.

## 6. Confine del realtime

`packages/realtime` espone un'interfaccia che non nomina LiveKit:

- `connectToRoom(token)` restituisce una sessione
- `publishLocalTracks(options)` — audio e video separabili
- `onParticipantJoined`, `onParticipantLeft`, `onConnectionStateChange`
- `sendData(channel, payload)` e `onData(channel, handler)`

Il codice dell'applicazione parla solo a questa interfaccia. Il giorno in cui
LiveKit diventa caro o inadatto, si riscrive un file invece di trenta.

Audio e video si pubblicano separatamente: la slice 2 accende solo l'audio, la
slice 5 aggiunge il video sopra la stessa sessione.

## 7. Gesture: percorso interamente locale

```
webcam → MediaPipe (browser) → landmark → classificatore → debounce/cooldown → comando canvas
```

Nessun frame e nessun landmark lascia il dispositivo.

- **`OPEN_PALM` è l'interruttore.** Senza attivazione esplicita, ogni movimento
  involontario mentre si parla sposta le schede.
- **`SWIPE_LEFT` / `SWIPE_RIGHT`** scorrono le varianti della scheda aperta.
- **`PINCH`** aperto o chiuso cambia `size` fra `large` e `small`.
- **Frequenza adattiva.** Se il frame rate cala sotto soglia, MediaPipe riduce il
  passo prima che degradi il video. Il video vince sempre sulle gesture.

I token di accesso alla stanza — LiveKit e STT — sono generati **solo lato server**,
dopo aver verificato che l'utente abbia diritto a entrare. Durano quanto la
sessione, non di più.

## 8. Ciclo di vita della stanza

```
CREATA        riga in rooms, nessuno stato in KV
ATTIVA        primo join: stato in KV con TTL, token emessi
IN CHIUSURA   host termina: schede tenute → composizione PDF
CHIUSA        rooms.ended_at valorizzato, KV cancellato
PURGATA       entro 10 minuti: asset temporanei rimossi, resta il PDF in R2
SCADUTA       dopo 7 giorni: PDF rimosso da R2, resta solo la riga in rooms
```

Il passaggio da CHIUSA a PURGATA deve avvenire anche se l'host chiude il browser
senza premere nulla. Serve un job programmato che purga le stanze senza presence da
più di N minuti. Una promessa di cancellazione che dipende da un click dell'utente
non è una promessa.

## 9. Autorizzazione

Tre livelli, tutti server-side:

1. **RLS su Postgres**, deny by default. Ogni policy parte dall'utente autenticato.
2. **Controlli nelle route server** prima di ogni effetto: chi chiede è membro del
   workspace, la stanza è sua, la quota è disponibile.
3. **Token a vita breve** — LiveKit e STT — emessi solo dopo i due controlli sopra.

Il frontend nasconde i bottoni che non servono. Non è quello a proteggere nulla.

Un token STT rubato è audio di terzi trascritto a nostre spese: vita breve e
revoca alla chiusura della stanza non sono opzionali.

## 10. Errori

Ogni errore mostrato all'utente dice cosa è successo e cosa può fare. Nessun
"Something went wrong". Quattro categorie con trattamento diverso:

- **Rete e realtime:** riconnessione automatica con backoff, stato visibile in UI.
- **Quota e permessi:** messaggio esplicito con l'azione possibile, non un 500.
- **Guasti del provider AI:** degrado, non blocco. La stanza continua a funzionare
  se l'immagine non arriva.
- **Gesture non disponibili:** webcam negata o CPU satura non tolgono nessuna
  funzione. Ogni comando resta raggiungibile col mouse.

## 11. Telemetria senza contenuto

Poiché non si possono loggare i contenuti (ADR-0001), i log devono essere ricchi di
struttura: id di correlazione per sessione, passo della catena, esito, durata,
codice di errore del provider. Mai prompt, mai testo trascritto, mai output.
