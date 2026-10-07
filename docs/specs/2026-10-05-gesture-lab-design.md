# Laboratorio gesture — design

Data: 05/10/2026. Nato dalle prove di Sean del 04/10: le gesture nella call risultano
«meccaniche e poco naturali» rispetto agli hand tracker visti online. Il motore è lo stesso
(MediaPipe Hand Landmarker); la differenza sta in cosa si fa dei landmark e in come lo si
mostra. Strumento di sviluppo, solo per Sean: nessun impatto sulla call finché non si decide
cosa accendere.

## Obiettivo

1. **Dizionario sotto gli occhi:** vedere e cambiare l'abbinamento gesto → comando.
2. **Capire come funzionano:** vedere la mano, la posa, i numeri che la decidono, l'attesa
   che si riempie, gli eventi che scattano.
3. **Provare le correzioni** della «meccanicità», una per una, sul palco vero.

Successo: Sean sa dire quali correzioni e quali tarature rendono i gesti naturali, e le
passa con «Copia come codice» per portarle nella call con un test. Con le impostazioni
predefinite il comportamento della call resta identico a oggi.

## Decisioni prese con Sean (05/10)

| Tema | Scelta |
|---|---|
| Destinatario | solo Sean, pagina `/dev/gesture-lab`, mai in produzione |
| Valori regolati | in `localStorage`, più «Copia come codice» |
| Su cosa agiscono i gesti | palco vero (`StageBoard`) con finestre d'esempio, senza stanza |
| Correzioni da provare | filtro anti-tremolio, cursore a 60fps, riscontro durante il gesto, pose stabili |
| Rigioco | sì: le registrazioni di `/dev/gesture-recorder` si rigiocano con le impostazioni correnti |
| Dove vivono le correzioni | in `packages/gesture`, spente di default; il laboratorio le compone |

## Perché oggi sembra meccanico (diagnosi)

| Causa | Oggi | Correzione |
|---|---|---|
| Tremolio dei landmark | usati grezzi | filtro One Euro |
| Disegno al ritmo dell'inferenza | cursore a 30→10fps (`FPS_LADDER`) | inseguimento a 60fps |
| Gesti «tutto o niente» | hold 1s, cooldown 800ms, swipe = ¼ immagine in 400ms | tarature; gesti continui fuori scope |
| Nessun riscontro | niente finché il comando non scatta | scheletro, posa, anello dell'attesa |
| Soglie da mani sintetiche, sfarfallio | isteresi solo sul pinch | pose stabili per N fotogrammi; soglie regolabili |

## 1. `packages/gesture`

### 1.1 Taratura

Nuovo tipo `Tuning` e `DEFAULT_TUNING`, in `packages/gesture/src/tuning.ts`:

```ts
type Tuning = {
  timings: {
    holdMs: number; cooldownMs: number; stillness: number;
    swipe: { distance: number; withinMs: number };
    flick: { distance: number; withinMs: number };
    spread: { distance: number; withinMs: number };
  };
  pose: { pinchOn: number; pinchOff: number; extended: number; folded: number; thumbMargin: number };
  smoothing: { enabled: boolean; minCutoff: number; beta: number };
  stability: { frames: number };
};
```

| Gruppo | Predefinito |
|---|---|
| `timings` | gli attuali `TIMINGS` (1000, 800, 0.08, 0.25/400, 0.25/300, 0.2/600) |
| `pose` | `0.25 / 0.35 / 1.6 / 1.2 / 0.3` (le costanti attuali di `pose.ts`) |
| `smoothing` | `enabled: false`, `minCutoff: 1.0`, `beta: 0.007` |
| `stability` | `frames: 1` (comportamento attuale) |

`TIMINGS`, `PINCH_ON`, `PINCH_OFF` restano esportati (compatibilità) e coincidono con
`DEFAULT_TUNING`. `clampTuning(t: unknown): Tuning` riporta ogni valore in un intervallo
sensato e garantisce `pinchOn < pinchOff`, `folded < extended`, `frames ≥ 1`; i campi
mancanti o non validi prendono il predefinito.

### 1.2 Pose e metriche

- `classifyPose(hand, wasPinching = false, thresholds = DEFAULT_TUNING.pose)`.
- `poseMetrics(hand): { fingers: Record<Finger, number>; pinch: number; thumbExtended: boolean }`
  (`Finger` = indice, medio, anulare, mignolo; il pollice è il booleano)
  — i numeri che il laboratorio mostra accanto alle soglie.

### 1.3 Filtro

`packages/gesture/src/filter.ts`: `createHandSmoother({ minCutoff, beta, dCutoff = 1 })` con
`smooth(frame: Frame): Frame`.

- Filtro One Euro per coordinata (x, y, z) di ognuno dei 21 punti, con tempo da `frame.t`.
- Le mani si abbinano al fotogramma precedente per vicinanza del polso (punto 0): MediaPipe
  può scambiarne l'ordine. Una mano nuova parte senza storia; una mano sparita perde la sua.
- Fotogramma senza mani → stato azzerato.

### 1.4 Riconoscitore

`createRecognizer({ dictionary, tuning, armed, twoHands })`: usa `tuning.timings`,
`tuning.pose` e `tuning.stability.frames` al posto delle costanti. Stabilità: la posa
«stabile» cambia solo dopo `frames` fotogrammi consecutivi con la stessa posa grezza; con
`frames = 1` è la posa grezza. Il pinch continua a usare l'isteresi on/off.

Nuovo `view(): RecognizerView`:

```ts
type RecognizerView = {
  rawPose: Pose; pose: Pose;            // grezza e stabile
  hold: { pose: Pose; progress: number } | null;  // progress 0..1
  armed: boolean;
  cooldownLeftMs: number;
  dragging: boolean;
};
```

### 1.5 Catena unica

`createPipeline({ tuning, dictionary, armed, twoHands })` →
`push(frame) → { frame: Frame /* filtrato o grezzo */; events: GestureEvent[]; view: RecognizerView }`,
più `setArmed`, `setTwoHands`. Filtro solo se `tuning.smoothing.enabled`.

`startGestures(video, options)` usa la catena; nuove opzioni `tuning?: Tuning` e
`onFrame?(raw: Frame, processed: Frame, view: RecognizerView)`. Il registratore continua a
salvare i fotogrammi grezzi. Il rigioco del laboratorio usa la stessa catena.

Confine invariato: il pacchetto non conosce finestre né stanze.

## 2. Pagina `/dev/gesture-lab`

`apps/web/src/app/dev/gesture-lab/`: `page.tsx` (in produzione `notFound()`, come il
registratore) e i componenti client. Nessuna stanza, LiveKit, Supabase.

### 2.1 Impaginazione

- **Sinistra — palco di prova:** `StageBoard` con `useReducer` locale su `applyCommand`. Lo
  stato iniziale si costruisce con comandi veri: 3 `WINDOW_CREATE`, 3 `TRAY_ADD` di
  `sampleContent('chart' | 'text' | 'table', id)` e 3 `CONTENT_PLACE`. Cursore delle mani
  sopra il palco.
- **Destra — pannello:**
  - **Mano:** video specchiato, scheletro su canvas (grezzo e filtrato con colori diversi),
    posa corrente in grande, anello dell'attesa (`view.hold.progress`), stato armato.
  - **Numeri:** `poseMetrics` di dita e pinch, ognuno con la soglia accanto.
  - **Correzioni:** 4 interruttori (filtro, cursore 60fps, riscontro, pose stabili); sotto
    filtro e stabilità i loro parametri.
  - **Taratura:** cursori per `timings` e `pose`, con il predefinito indicato.
  - **Dizionario:** per ognuno dei 9 gesti un menu con i comandi o «spento».
  - **Rigioco:** carica file, «Rigioca», «Pausa»; mostra evento atteso e eventi scattati.
  - **Eventi:** ultimi 20 con l'ora; GRAB/MOVE/DROP raggruppati in una riga di trascinamento.
- **In fondo:** «Copia come codice» e «Ripristina predefiniti».

L'interruttore «riscontro» accende scheletro, anello e posa sul video; spento, il video
resta nudo come nella call. «Pose stabili» spento = `frames: 1`.

### 2.2 Cursore a 60fps

`followPoint(current, target, dtMs, halfLifeMs): Point` (inseguimento esponenziale), in
`apps/web/src/lib/stage/cursor-motion.ts`, guidato da `requestAnimationFrame`. Spento: il
cursore salta al punto dell'ultimo evento, come oggi.

### 2.3 Codice condiviso con la call

La traduzione eventi → comandi del palco (coordinate sull'area, GRAB/DROP via `dragItemAt` e
`resolveDrop`, comandi discreti via `gestureAction`) esce da `use-gestures.ts` in
`createStageGestureHandler({ toScreen, getStage, dispatch, onAgent, onCursor })`, usata da
call e laboratorio. Nel laboratorio `onAgent` scrive solo «agente richiesto» negli eventi.
La call si comporta come prima.

### 2.4 Salvataggio

`localStorage` chiave `gesture-lab:v1`: `{ tuning, dictionary, toggles }`. Lettura e scrittura
in try/catch; lettura via `clampTuning` e validazione del dizionario (comandi ammessi o
`null`). Storage assente o corrotto → predefiniti.

### 2.5 Copia come codice

`tuningToCode(tuning, dictionary): string` produce due blocchi TypeScript pronti da incollare
(`DEFAULT_TUNING` e `DEFAULT_DICTIONARY`). Copia negli appunti; se negati, mostra il testo
selezionabile.

### 2.6 Rigioco

Formato del registratore: `{ expect: GestureEvent['type']; armed: boolean; frames: Frame[] }`.
Validazione prima dell'uso; file non valido → messaggio, pagina intatta. I fotogrammi si
riproducono con i loro tempi relativi attraverso la catena con le impostazioni correnti.

## 3. Casi limite

| Caso | Comportamento |
|---|---|
| webcam negata o assente | messaggio con il rimedio; rigioco disponibile |
| MediaPipe non si carica | GPU → CPU come oggi; poi errore, rigioco disponibile |
| file di rigioco malformato | rifiutato con messaggio |
| storage corrotto o vecchio | campi validi letti, resto predefinito |
| cursori incoerenti (pinchOn ≥ pinchOff) | `clampTuning` corregge |
| mani che si scambiano | abbinamento per polso nel filtro |
| contenuti | nessuna immagine salvata (regola 1): solo landmark in memoria |

## 4. Test (prima del codice)

- **Non-regressione:** i test esistenti di `gesture-recognizer`, `gesture-pose`,
  `gesture-fixtures`, `gesture-actions` passano invariati; in più, gli stessi scenari di
  `gesture-recognizer` passati da `createPipeline` con `DEFAULT_TUNING` danno gli stessi
  eventi.
- **Unit:** filtro (meno tremolio a mano ferma; salto veloce seguito; reset; mani scambiate);
  stabilità (`frames: 3`, posa di 2 fotogrammi ignorata); `classifyPose` con soglie diverse;
  `poseMetrics`; `view` (progress 0→1, `cooldownLeftMs`); `clampTuning`; `followPoint`;
  salvataggio; `tuningToCode` (testo con i valori correnti); validazione del rigioco;
  `createStageGestureHandler` (i casi oggi in `use-gestures`).
- **Componenti:** interruttori e cursori; dizionario con «spento»; rigioco che mostra gli
  eventi scattati.
- **Niente e2e:** pagina solo di sviluppo, con webcam.

## 5. Documenti

- `BACKLOG.md`: «decidere quali correzioni accendere nella call dopo le prove»; «gesti
  continui (zoom con le dita) → ADR nuovo».
- Nessun ADR: i predefiniti non cambiano, ADR-0010 resta valido.

## Fuori scope

Gesti nuovi definiti per esempio; gesti continui; correzioni accese nella call; salvataggio
su database.

Branch: `slice/gesture-lab`, da `main`.
