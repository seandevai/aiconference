# ADR-0005 — Le gesture sono un pilastro, non un accessorio

**Data:** 22/09/2026 · **Stato:** accettato · **Sostituisce:** ADR-0003

## Contesto

ADR-0003 rinviava le gesture alla slice 6, dopo il core loop, dando ragione al
Build Brief contro il PRD. Il ragionamento era che le gesture sono un
differenziatore da demo e non il cuore del valore.

Discutendo il prodotto invece della sua architettura è emerso che quel giudizio era
sbagliato rispetto all'intenzione del progetto. Senza gesture, ciò che resta è una
videochiamata con un pannello AI: un prodotto che compete frontalmente con Zoom,
Meet e Teams, che hanno già l'assistente AI e sono gratis o già pagati.

Il differenziatore vero è la combinazione: canvas generativo **più** controllo
gestuale. Togliere il secondo lascia il primo senza difesa.

## Decisione

Le gesture entrano nell'MVP come slice 7. L'MVP è considerato incompleto senza.

`packages/gesture` è isolato — riceve un elemento `<video>`, emette comandi — e non
dipende da LiveKit, dallo STT né dal server. Si sviluppa **in parallelo dalla
settimana 1** e si testa con landmark registrati, senza webcam. L'integrazione
arriva alla slice 7 solo perché prima non esistono schede da comandare.

Tre vincoli che rendono la decisione sostenibile:

1. **Ogni gesto ha il suo click equivalente.** Le gesture sono più veloci, mai
   obbligatorie. Con webcam spenta o CPU satura il prodotto funziona lo stesso.
   Non è disciplina: `packages/canvas` riceve comandi e non sa da dove arrivino.
2. **Il video vince sempre.** Se il frame rate cala sotto soglia, MediaPipe riduce
   il passo prima che degradi la videochiamata.
3. **Il palmo aperto è l'interruttore.** Senza un gesto di attivazione esplicito,
   ogni movimento involontario mentre si parla sposta le schede.

Dizionario MVP: `SWIPE_LEFT` / `SWIPE_RIGHT` per le varianti, `PINCH` per
ingrandire e rimpicciolire, `OPEN_PALM` per attivare. Configurabili e disattivabili.

## Conseguenze

Positive: il prodotto ha un differenziatore che i concorrenti grandi non hanno e non
possono aggiungere in fretta. La demo ha l'effetto che il PRD considerava centrale.
Lo sviluppo parallelo non allunga il percorso critico.

Negative: l'MVP passa da 5-7 a 8-11 settimane. Si aggiunge un rischio tecnico reale
— MediaPipe a 30fps, encode WebRTC e trascrizione nello stesso browser — che va
misurato con uno spike nella slice 2, non stimato. Se la CPU non regge, le gesture
vanno a frequenza ridotta: si degradano, non spariscono.

## Alternative scartate

**Gesture come telecomando della stanza** (muta, alza la mano, passa la parola).
Più utili nel quotidiano e meno spettacolari, ma non differenzianti: sono scorciatoie
per funzioni che ogni concorrente ha già.

**Gesture post-MVP, come in ADR-0003.** Coerente con il Build Brief, ma lascia l'MVP
senza il suo argomento di vendita più difendibile.
