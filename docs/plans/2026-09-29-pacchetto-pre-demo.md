# Pacchetto pre-demo — piano

Obiettivo: togliere gli inciampi che nel test con i 5 consulenti non c'entrano con l'idea.
Branch `chore/pre-demo`. Niente funzioni nuove: solo correzioni prese dal BACKLOG.

Tocca una policy di sicurezza (limite di richieste sulla route del token) e lo schema del
database (migrazione 0005, solo la funzione del trigger). Nessun segreto, nessun billing.

## Task

### 1. Contenuti di prova nascosti con l'agente vero

Il vassoio mostra quattro pulsanti «di prova». Con `AI_PROVIDER=anthropic` (staging) il
consulente vedrebbe dati finti accanto a quelli dell'agente.

- La pagina della stanza (server) passa `showSamples = AI_PROVIDER === 'fake'` fino al
  vassoio. Con il provider finto (CI, e2e) i pulsanti restano: i test del palco li usano.
- Test: funzione pura `showSampleContent(provider)`.

### 2. Codice stanza tollerante

Chi digita `/room/abcd-2345` o con spazi riceve un 404. Il codice si normalizza:
maiuscolo, senza spazi né trattini. Se la forma normalizzata è valida e diversa da quella
dell'indirizzo, redirect alla forma canonica.

- `normalizeJoinCode(value)` in `lib/rooms/join-code.ts`, con test.
- La route del token e quella del palco ricevono sempre il codice canonico dalla pagina.

### 3. Nome del profilo mai vuoto

Il form chiede il nome, ma un nome fatto di soli spazi arriva come `''`.

- `signUp` rifiuta un nome vuoto dopo il trim, con messaggio in italiano.
- Migrazione `0005_profile_name_fallback.sql`: il trigger usa
  `coalesce(nullif(trim(...), ''), split_part(email, '@', 1))` e sistema le righe vuote.
- Test: integrazione in `tests/db/` (gira nel job `db` della CI).
- Staging: la migrazione va applicata a `aiconference` dopo la CI verde, dichiarandolo.

### 4. Limite di richieste sulla route del token

`POST /room/[code]/token` è gratuita ma senza limite: chiunque può martellarla.

- Finestra fissa su KV: 30 richieste al minuto per chiave. Chiave = utente autenticato,
  altrimenti cookie ospite, altrimenti hash SHA-256 dell'IP (niente IP in chiaro in KV).
- Oltre il limite: 429 con `Retry-After`. Il client già ritenta con attesa crescente.
- `KvLike` guadagna `incr` ed `expire`. Test con KV finto in memoria.

### 5. Pulizia del BACKLOG

- Segnare fatto il task 0.5 (staging del 27/09).
- Segnare fatte le voci chiuse da questo piano.

## Fuori dal piano

- `/dev/spike-cpu`: si toglie dopo la misura di Sean.
- Verifica dell'agente vero su staging: la fa Sean in una call di prova (costa pochi
  centesimi), perché la route richiede l'host autenticato.
- Redesign della UI: piano a parte dopo il brainstorming.
