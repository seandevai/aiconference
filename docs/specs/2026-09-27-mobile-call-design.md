# Call da telefono: orizzontale, tutto schermo, fotocamera, PiP — design

Data: 27/09/2026. Nasce dal primo test su staging (preview `omnicanvas-staging`): la call
funziona, da telefono mancano quattro cose che l'utente si aspetta da WhatsApp e FaceTime.
Integra la spec MVP §2.5 (mobile in visione) senza cambiarne le decisioni: l'ospite da
telefono resta in visione sul palco, l'host non conduce da mobile.

## Obiettivo

Chi entra dal telefono vive la call come in un'app di videochiamata:

1. **Orizzontale.** Ruotando il telefono il layout si adatta: palco a sinistra, colonna
   volti più larga a destra, header nascosto, controlli compatti.
2. **Tutto schermo.** Toccando il volto di un altro partecipante, quella persona riempie la
   vista, dentro l'app, con il proprio riquadro piccolo in alto e i controlli sempre
   visibili. «✕» chiude.
3. **Fotocamera.** Pulsante «Gira fotocamera» per passare da anteriore a posteriore e
   viceversa, visibile solo dove ci sono almeno due fotocamere.
4. **PiP.** Mandando l'app in background, il video di chi parla resta in una finestrella
   sopra le altre app. Pulsante «Riquadro» per aprirlo a mano.

Successo: su un iPhone e un Android reali i quattro punti funzionano; dove il browser non
permette il PiP automatico, il pulsante funziona.

## Decisioni prese con Sean (27/09)

| Tema | Scelta |
|---|---|
| Orizzontale | palco + striscia volti, stessa logica del verticale |
| Tutto schermo | sovrapposizione nell'app, non il fullscreen del sistema |
| Video nel PiP | chi parla (l'ultimo remoto che ha parlato); lo spotlight ha la precedenza |
| Ordine | prima della 4B, su `slice/mobile-call` da `slice/5-gesture` |

## Design

### Orizzontale

Solo CSS. Una variante Tailwind `phone-landscape` = `orientation: landscape` e altezza
≤ 500 px, così non tocca tablet e desktop. In quella variante: header nascosto, colonna
volti larga 96 px a destra, barra dei controlli con padding ridotto. Nessuna logica nuova.

### Spotlight (tutto schermo)

Stato `spotlight: string | null` (identity) in `RoomCall`. Le tessere dei partecipanti
remoti diventano pulsanti («Mostra <nome> a tutto schermo»); la propria no. La
sovrapposizione è un `role="dialog"` con il video grande, il proprio riquadro, «✕» e
Esc per chiudere. Si chiude da sola se la persona esce. Funziona uguale su desktop. La
logica pura sta in `apps/web/src/lib/call/spotlight.ts`:

- `resolveSpotlight(selected, roster)`: `selected` se è ancora presente e non è locale,
  altrimenti `null`.
- `nextLastSpeaker(previous, roster)`: il primo remoto che parla, altrimenti `previous`
  se è ancora presente, altrimenti `null`.
- `pipTarget(roster, spotlight, lastSpeaker)`: spotlight valido → quello; poi l'ultimo
  che ha parlato; poi il primo remoto con la camera accesa (l'ordine del roster mette
  l'host per primo); altrimenti `null`.

### Fotocamera

Confine: solo `packages/realtime` conosce LiveKit. `RealtimeSession` guadagna:

- `canSwitchCamera(): Promise<boolean>`: vero se `enumerateDevices` elenca almeno due
  `videoinput`.
- `switchCamera(): Promise<void>`: alterna `facingMode` fra `user` ed `environment` con
  `restartTrack` sulla traccia camera locale. Se la camera è spenta cambia solo la
  preferenza, che `setCameraEnabled(true)` userà alla riaccensione.

Logica pura in `packages/realtime/src/camera.ts` (`nextFacingMode`,
`countVideoInputs`), testata senza dispositivi.

### PiP

Componente `PipVideo`: un `<video>` dedicato, visivamente nascosto ma renderizzato
(1 px, `opacity: 0`, non `display: none`), a cui si attacca il video di
`pipTarget(...)`. Se il target cambia, si stacca e si riattacca: la finestra PiP resta
aperta e mostra la nuova persona.

- **Automatico, Chrome Android:** `navigator.mediaSession.setActionHandler('enterpictureinpicture', …)`
  (in `try/catch`: dove l'azione non esiste lancia `TypeError`).
- **Automatico, iOS Safari:** attributo `autopictureinpicture` sul `<video>`.
- **Manuale, ovunque sia supportato:** pulsante «Riquadro» nella barra.
  `requestPictureInPicture()` se `document.pictureInPictureEnabled`, altrimenti
  `webkitSetPresentationMode('picture-in-picture')`. Nascosto se nessuno dei due c'è.
- **LiveKit:** `adaptiveStream: { pauseVideoInBackground: false }`, altrimenti la
  traccia remota si ferma appena la pagina va in background e il PiP resta nero.

Limite dichiarato: in background iOS ferma la fotocamera locale; gli altri vedono il
riquadro fermo o l'iniziale. Il microfono continua.

## Regole rispettate

- LiveKit solo in `packages/realtime` (camera, `pauseVideoInBackground`).
- Nessun contenuto su disco: PiP e spotlight sono solo visualizzazione.
- Ogni gesto ha il suo click (ADR-0005): tocco su volto ↔ pulsante accessibile; PiP
  automatico ↔ pulsante «Riquadro».
- Nessun segreto nuovo, nessuna tabella, nessuna policy toccata.

## Test

- Unit (TDD): `spotlight.ts`, `camera.ts`.
- E2E Playwright, progetto `mobile` (Pixel 7) e un contesto in orizzontale: tocco sul
  volto → dialog → «✕»; in orizzontale header nascosto e colonna volti visibile;
  «Gira fotocamera» assente su desktop.
- A mano su telefono reale: checklist in `docs/spikes/2026-09-27-spike-mobile-call.md`
  (rotazione, fotocamera posteriore, PiP automatico e manuale su iOS e Android).

## Fuori da questo lavoro

Host da mobile, doppio tocco per zoom, PiP con più persone (Document PiP non esiste su
mobile), mantenere la fotocamera attiva in background su iOS (non possibile dal browser).
