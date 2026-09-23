# ADR-0008 — Il lavoro esce in un pacchetto cifrato nel browser

**Data:** 23/09/2026 · **Stato:** accettato · **Sostituisce:** ADR-0001 (in parte)

## Contesto

ADR-0001 tracciava il confine fra metadati persistenti e contenuti effimeri, con un
solo artefatto in uscita: il PDF, su object storage per 7 giorni, leggibile da noi.

Con la v3 della spec l'uscita cambia: l'utente vuole portarsi via **tutto** ciò che
è stato prodotto — grafici, testi, immagini, documenti — più il PDF riassuntivo se il
piano lo prevede. Più file, quindi un pacchetto, e un link che scade.

Zoom, Meet e Teams conservano i contenuti sui propri server, leggibili dal
fornitore, con retention configurabile. Nessuno può dire «non possiamo leggerli».

## Decisione

Il pacchetto viene **composto e cifrato nel browser dell'host** con una chiave
casuale (Web Crypto, AES-GCM). Sul nostro storage arriva solo il blob cifrato, con
scadenza a 7 giorni. La chiave viaggia nel frammento del link (`#…`), che il browser
non invia mai al server.

Resta valido di ADR-0001 tutto il resto: metadati in Postgres, contenuti mai su
disco in chiaro, testo di sessione solo in memoria con TTL.

Il PDF riassuntivo è composto da `AIService`: il testo passa dal provider e torna al
browser dell'host, che lo aggiunge al pacchetto prima della cifratura. Nessuna copia
resta da noi.

## Conseguenze

Positive: la promessa diventa più forte della v2 — il contenuto sta sul nostro
storage ma non possiamo leggerlo. Costo quasi nullo: la cifratura è nel browser, lo
storage è pochi megabyte con lifecycle automatico. È un argomento di vendita che i
concorrenti grandi non possono copiare senza cambiare modello.

Negative: se il link si perde, il pacchetto è perso — non possiamo rigenerarlo né
recuperarlo. Se l'host chiude il browser prima di terminare, il pacchetto non viene
prodotto. La pagina di download non può contenere script di terze parti, per non
esporre il frammento.

## Alternative scartate

**Pacchetto in chiaro su storage con URL firmato.** Più semplice e recuperabile, ma
leggibile da noi: la promessa torna al livello dei concorrenti.

**Nessun salvataggio, download immediato a fine call.** Massima ephemerality, ma
l'ospite spesso è su mobile e il file va a chi non se lo aspetta. Il link si
condivide, il file no.
