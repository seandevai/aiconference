# ADR-0006 — Trascrizione con vendor esterno, chiamato dal client

**Data:** 22/09/2026 · **Stato:** accettato · **Sostituisce:** ADR-0004

## Contesto

ADR-0004 sceglieva la Web Speech API come percorso principale, chiamandola
«trascrizione locale», con Whisper server-side come fallback.

La premessa era falsa. La Web Speech API **non è locale**: su Chrome l'audio viene
inviato ai server di Google, su Safari a quelli di Apple, e Firefox non la supporta.
Il percorso principale quindi non era gratuito in termini di privacy: mandava
l'audio a un terzo, senza contratto che tutelasse l'utente, e senza funzionare
ovunque.

Restavano tre strade reali: un vendor STT sotto contratto, Whisper eseguito nel
browser via WASM, o un worker server che entra nella stanza e trascrive tutte le
tracce.

Va inoltre deciso **dove** vive la pipeline, perché la scelta cambia
l'infrastruttura: un worker server è un processo sempre acceso, che Vercel non
ospita.

## Decisione

**Vendor STT in streaming** (Deepgram o AssemblyAI) con DPA zero-retention
sottoscritto, **chiamato dal browser di ciascun partecipante**, con token a vita
breve emesso dal nostro server dopo aver verificato che l'utente sia in quella
stanza.

Ogni partecipante trascrive solo la propria traccia e invia al server **solo testo**,
in righe `{ speakerId, ts, text }`. Il server le ordina per timestamp e le tiene in
una finestra scorrevole in KV con TTL di 5 minuti.

**Il VAD lato client è parte della decisione, non un'ottimizzazione successiva.**
Ogni browser rileva localmente la presenza di voce e trasmette solo allora. Senza,
quattro partecipanti per un'ora producono 240 minuti fatturabili invece di 60-80: il
costo triplica.

La promessa vendibile diventa, alla lettera:

> L'audio non raggiunge mai i nostri server. Viene trascritto dal browser di chi
> parla tramite un fornitore vincolato per contratto a non conservarlo.

## Conseguenze

Positive: funziona su ogni browser, con latenza bassa e buona resa sull'italiano.
L'attribuzione per voce esce gratis — ognuno etichetta sé stesso — che è il motivo
per cui LiveKit arriva presto nell'ordine delle slice. Nessuna infrastruttura oltre
Vercel: niente worker, niente secondo deploy, niente secondo conto. L'audio non
tocca mai una nostra macchina, quindi ADR-0001 regge letteralmente invece che per
approssimazione.

Negative: la promessa è contrattuale, non architetturale — l'audio esce comunque dal
dispositivo, e va detto con precisione invece che nascosto. Chi chiude il portatile
smette di essere trascritto. I token STT a vita breve vanno emessi e revocati con
cura: un token rubato è audio di qualcun altro trascritto a nostre spese. Il costo
orario sale rispetto alla stima del PRD (vedi §6 della spec).

## Alternative scartate

**Whisper WASM nel browser.** Unica opzione con privacy architetturale: l'audio non
esce davvero. Scartata per l'MVP perché richiede 40-200 MB di modello scaricato e
CPU che compete con l'encode WebRTC — e con MediaPipe, ora che le gesture sono nello
scope (ADR-0005). Resta come candidato a «modalità massima privacy» a pagamento, per
i clienti che la esigono.

**Worker server che entra nella stanza.** Centralizzato e pulito, ma è un processo
long-running che Vercel non ospita: servirebbe un secondo hosting. E farebbe passare
tutto l'audio della riunione da una nostra macchina, indebolendo l'argomento di
vendita principale.

**Web Speech API.** Costo zero ma il peggio dei due mondi: l'audio esce comunque,
senza contratto, e non funziona su tutti i browser.
