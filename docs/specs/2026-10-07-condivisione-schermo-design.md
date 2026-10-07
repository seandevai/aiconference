# Condivisione dello schermo dell'host — design

Data: 07/10/2026. Richiesta di Sean del 06/10 (`docs/BACKLOG.md`, «ADVICES» punto 2), scelte
fatte con il visual companion (mockup in `.superpowers/brainstorm/8454-1791366460/`).
Decisione di prodotto in ADR-0015.

## Obiettivo

L'host può mostrare dentro la call materiale che l'agente non produce: slide, PDF, un sito,
un foglio di calcolo, o la demo dal vivo di un software. Lo schermo condiviso è una
finestra del palco come le altre, quindi si dispone accanto ai grafici dell'agente con le
mani o col mouse.

Successo: l'host avvia la condivisione con un click, tutti vedono lo schermo in una finestra
del palco entro pochi secondi, l'host la sposta fra gli slot come ogni altra finestra, e
quando smette, anche dal pulsante nativo del browser, la finestra sparisce senza lasciare
tracce nel pacchetto finale.

## Decisioni prese con Sean (07/10)

| Tema | Scelta |
|---|---|
| Scopo | materiale pronto e demo dal vivo |
| Posizione | una finestra del palco, negli slot magnetici (ADR-0009) |
| Chi condivide | solo l'host, imposto dal token LiveKit e non solo dalla UI |
| Fine condivisione | la finestra sparisce; lo schermo non entra mai nel pacchetto |
| Audio dello schermo | no: solo immagine, l'host parla al microfono |
| Approccio | tipo di contenuto `screen` nel modello del palco |

## 1. Modello del palco (`packages/canvas`)

Nuovo tipo di contenuto, accanto a `chart`, `text`, `table` e `image`:

```ts
{ id, kind: 'screen', data: { title: string; owner: string } }
```

`owner` è l'identità LiveKit di chi condivide. Il contenuto è un riferimento a una traccia
dal vivo, non un dato: nel palco salvato in KV finisce solo l'identità (regola 1).

Nessun comando nuovo. Il contenuto passa dagli stessi comandi di mouse, gesto e agente:

| Momento | Comandi |
|---|---|
| Avvio, palco con meno di 4 finestre | `TRAY_ADD` → `WINDOW_CREATE` («Schermo») → `CONTENT_PLACE` → `FOCUS` |
| Avvio, palco pieno | `TRAY_ADD` → `CONTENT_PLACE` nella finestra in primo piano |
| Fine, lo schermo è l'unico contenuto della finestra | `WINDOW_ARCHIVE` |
| Fine, la finestra ha anche altri contenuti | `CONTENT_REMOVE` |

Regole:

- al massimo un contenuto `screen` sul palco; un secondo avvio non ne crea un altro
- lo schermo non va mai nel vassoio: `CONTENT_REMOVE` e `WINDOW_ARCHIVE` lo tolgono del
  tutto invece di archiviarlo, perché un riferimento a una traccia finita non serve a nulla
- un contenuto `screen` non si negozia
- **invariante dell'host:** lo schermo è sul palco se e solo se l'host sta condividendo.
  Schermo sul palco senza condivisione (pagina ricaricata, sessione ricreata dopo una
  caduta, stop dal browser) → si toglie con i comandi della fine. Condivisione senza schermo
  sul palco (l'host ha chiuso la finestra a mano) → la condivisione si ferma
- lo schema zod del palco accetta `screen` con `owner` non vuoto e `title` breve

## 2. Realtime (`packages/realtime`)

`RealtimeSession` cresce di cinque membri; LiveKit resta in `livekit-session.ts`:

| Membro | Comportamento |
|---|---|
| `canShareScreen(): boolean` | falso dove `navigator.mediaDevices.getDisplayMedia` manca (telefoni) |
| `startScreenShare(): Promise<void>` | apre il selettore del browser, pubblica solo il video |
| `stopScreenShare(): Promise<void>` | smette di pubblicare |
| `onScreenShareEnded(handler)` | scatta per lo stop dalla UI e per «Interrompi condivisione» del browser |
| `attachScreen(identity, video)` | come `attachVideo`, con la sorgente schermo |

Annullare il selettore del browser rifiuta `startScreenShare` con un errore riconoscibile
(`ScreenShareCancelled`), distinto dagli altri.

Server (`server.ts`): il grant elenca le sorgenti pubblicabili. Ospite: camera e microfono.
Host: camera, microfono e schermo. Un ospite che prova a pubblicare lo schermo a mano viene
rifiutato da LiveKit (regola 2).

## 3. Interfaccia (`apps/web`)

- **Dock dell'host:** «Condividi schermo», che durante la condivisione diventa «Interrompi
  condivisione» (`aria-pressed`). Non compare agli ospiti né dove `canShareScreen()` è falso.
- **Finestra:** il contenuto `screen` mostra un `<video>` agganciato con
  `attachScreen(owner)`, `object-contain` su fondo scuro. Segue slot, spostamento, primo piano,
  tutto schermo e gesture come ogni finestra. Nessun gesto nuovo: ADR-0010 resta invariato e
  l'azione ha il suo click (regola 6).
- **Ospite che entra durante la condivisione:** riceve il palco con la finestra e si aggancia
  alla traccia quando arriva, come già succede per i volti.
- **Telefono (ospite in visione):** vede la finestra come le altre.
- **L'agente non vede lo schermo:** nessun fotogramma va ad `AIService`.

## 4. Pacchetto (`packages/bundle`)

`collect.ts` salta i contenuti `screen`. In pratica a fine riunione non ce ne sono, perché la
condivisione finisce prima; la regola esiste comunque, perché il pacchetto non deve mai
contenere lo schermo.

## 5. Stati ed errori

| Caso | Comportamento |
|---|---|
| L'host annulla il selettore | nulla: nessun banner, nessuna finestra |
| Permesso negato dal sistema operativo o errore del browser | banner «Non riesco a condividere lo schermo» |
| Stop dal pulsante nativo del browser | come «Interrompi condivisione» |
| L'host perde la connessione | se alla riconnessione la traccia dello schermo non è più pubblicata, si tolgono i contenuti `screen`; se c'è ancora, nulla cambia |
| L'host ricarica la pagina | pulizia al caricamento del palco (§1) |
| Ospite senza traccia ancora arrivata | finestra con «Schermo in arrivo…» |

## 6. Test

| Livello | Cosa |
|---|---|
| Unitari, canvas | schema `screen`; avvio con palco libero e pieno; un solo schermo; fine con archiviazione della finestra vuota; pulizia al caricamento |
| Unitari, bundle | `collect` salta `screen` |
| Unitari, realtime | grant per ruolo in `createRoomToken`; `canShareScreen` senza `getDisplayMedia` |
| Hook della call | avvio, fine dal pulsante, fine nativa via `onScreenShareEnded`, annullamento senza banner |
| e2e | l'host condivide e l'ospite vede la finestra «Schermo»; poi l'host interrompe e la finestra sparisce. Chromium con `--use-fake-ui-for-media-stream` e `--auto-select-desktop-capture-source` |

## Fuori da questa spec

In `docs/BACKLOG.md`:

- «Scatta»: catturare il fotogramma corrente come finestra immagine, che allora entra nel
  pacchetto (gesto e click)
- audio dello schermo (scheda o sistema)
- condivisione dagli ospiti
- far vedere lo schermo all'agente
