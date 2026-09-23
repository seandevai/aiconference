# ADR-0010 — Dizionario gesture provvisorio per il palco

**Data:** 23/09/2026 · **Stato:** accettato, provvisorio · **Sostituisce:** il dizionario di ADR-0005

## Contesto

ADR-0005 resta valido: le gesture sono un pilastro, ogni gesto ha il suo click, il
video vince sulla CPU, il palmo arma il riconoscimento.

Il suo dizionario però era pensato per la lista di schede (ADR-0007): swipe fra
varianti, pinch per ingrandire. Con il palco a finestre (ADR-0009) il pinch serve ad
afferrare, e servono gesti per chiamare l'agente, creare finestre e confermare.

## Decisione

| Gesto | Comando | Click equivalente |
|---|---|---|
| Palmo aperto, 1s | `GESTURES_TOGGLE` | icona ✋ |
| Indice alzato, 1s | `AGENT_ACTIVATE` | bottone ✨ |
| Pinch → trascina → rilascia | `GRAB` / `MOVE` / `DROP` | drag & drop |
| Swipe sinistra/destra | `FOCUS_PREV` / `FOCUS_NEXT` | frecce, click sulla piccola |
| Due mani che si allontanano | `WINDOW_CREATE` | «+ finestra» |
| Pollice su / giù | `CONFIRM` / `REJECT` | ✓ / ✗ |
| Flick verso l'alto | `WINDOW_ARCHIVE` | icona ⤴ |

Il dizionario è **provvisorio**: basta per i test e la prima demo. L'abbinamento
definitivo si decide dopo averlo provato con utenti veri. Il codice lo tratta come
configurazione, non come costante.

## Conseguenze

Positive: ogni azione del palco ha un gesto; i nomi dei comandi sono gli stessi che
usano mouse e agente.

Negative: sette gesti sono tanti da imparare. Il gesto a due mani raddoppia il
tracking: se la CPU non regge, è il primo a tornare solo bottone. Lo zoom perde il
suo gesto e resta su rotella e bottoni.

## Alternative scartate

**Pinch per zoom e per afferrare.** Due significati sullo stesso gesto portano a
errori.

**Gesti a telecomando** (muta, alza la mano): già scartati in ADR-0005.
