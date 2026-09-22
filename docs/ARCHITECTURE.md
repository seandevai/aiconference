# Architettura — OmniCanvas AI

Documento vivo. Va aggiornato nello stesso commit che cambia la struttura, non dopo.

## 1. Forma del repository

Monorepo con npm workspaces. Un'applicazione, package separati per i domini che
hanno confini veri.

```
apps/web                 Next.js App Router, l'unica superficie utente
packages/ui              design system, componenti senza logica di dominio
packages/realtime        astrazione LiveKit, unico punto che conosce il vendor
packages/ai              AIService, adapter provider, accounting dei costi
packages/canvas          modello e riduttori dello stato AI Canvas
packages/gesture         MediaPipe, classificatore gesti, debouncing (slice 6)
packages/db              schema, client tipizzato, tipi generati
supabase/migrations      migrazioni SQL e policy RLS
docs                     spec, piani, ADR, modello dati, contratto env
```

Regola di dipendenza: `apps/web` può importare da qualsiasi package. I package non
importano da `apps/web`. `packages/ui` non importa da `packages/db` né da
`packages/ai`: i componenti ricevono dati, non li vanno a prendere.

## 2. I quattro piani di stato

Il bug più probabile di questo prodotto è mescolare questi piani. Tenerli separati è
la disciplina principale del progetto.

| Piano | Dove vive | Durata | Esempi |
|---|---|---|---|
| Persistente | Postgres | per sempre | utenti, workspace, record stanza, ledger |
| Sessione | KV con TTL | durata della stanza | stato canvas, lista asset, finestra trascrizione |
| Effimero | DataChannel | millisecondi | presence, cursori, stato mute |
| Locale | memoria browser | frame | hand landmark, video grezzo |

Presence, cursori e hand landmark **non generano mai una scrittura su Postgres**.
Se una feature sembra richiederlo, la feature è progettata male.

## 3. Flusso di una richiesta AI

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

## 4. Confine del realtime

`packages/realtime` espone un'interfaccia che non nomina LiveKit:

- `connectToRoom(token)` restituisce una sessione
- `publishLocalTracks(options)`
- `onParticipantJoined`, `onParticipantLeft`, `onConnectionStateChange`
- `sendData(channel, payload)` e `onData(channel, handler)`

Il codice dell'applicazione parla solo a questa interfaccia. Il giorno in cui
LiveKit diventa caro o inadatto, si riscrive un file invece di trenta.

I token di accesso alla stanza sono generati **solo lato server**, dopo aver
verificato che l'utente abbia diritto a entrare in quella stanza. Il token ha la
durata della sessione, non di più.

## 5. Ciclo di vita della stanza

```
CREATA        riga in rooms, nessuno stato in KV
ATTIVA        primo join: stato in KV con TTL, token emessi
IN CHIUSURA   host termina: snapshot degli asset, generazione Final Bundle
CHIUSA        rooms.ended_at valorizzato, KV cancellato
PURGATA       entro 10 minuti: asset temporanei rimossi, resta solo il bundle in R2
SCADUTA       dopo 7 giorni: bundle rimosso da R2, resta solo la riga in rooms
```

Il passaggio da CHIUSA a PURGATA deve avvenire anche se l'host chiude il browser
senza premere nulla. Serve un job programmato che purga le stanze senza presence da
più di N minuti. Una promessa di cancellazione che dipende da un click dell'utente
non è una promessa.

## 6. Autorizzazione

Tre livelli, tutti server-side:

1. **RLS su Postgres**, deny by default. Ogni policy parte dall'utente autenticato.
2. **Controlli nelle route server** prima di ogni effetto: chi chiede è membro del
   workspace, la stanza è sua, la quota è disponibile.
3. **Token realtime a durata breve**, emessi solo dopo i due controlli sopra.

Il frontend nasconde i bottoni che non servono. Non è quello a proteggere nulla.

## 7. Errori

Ogni errore mostrato all'utente dice cosa è successo e cosa può fare. Nessun
"Something went wrong". Tre categorie con trattamento diverso:

- **Rete e realtime:** riconnessione automatica con backoff, stato visibile in UI.
- **Quota e permessi:** messaggio esplicito con l'azione possibile, non un 500.
- **Guasti del provider AI:** degrado, non blocco. La stanza continua a funzionare
  se l'immagine non arriva.

## 8. Telemetria senza contenuto

Poiché non si possono loggare i contenuti (ADR-0001), i log devono essere ricchi di
struttura: id di correlazione per sessione, passo della catena, esito, durata,
codice di errore del provider. Mai prompt, mai trascrizione, mai output.
