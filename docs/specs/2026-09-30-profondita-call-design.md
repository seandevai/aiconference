# Profondità della call e del palco (Nod) — design

Data: 30/09/2026. Segue il redesign del 29/09 (`2026-09-29-redesign-call-design.md`, in
`main` con la PR #9): la veste Nod c'è, ma la call resta «una web app scura». Sean chiede
più presenza, con animazioni ed effetti 3D, qualcosa di più orientato al futuro. Scelte fatte
con il visual companion (mockup in `.superpowers/brainstorm/475-1790763669/`,
`futuro-livelli.html` e `profondita-momenti.html`).

## Obiettivo

Il cliente in call pensa «questo è diverso» senza che la call scatti. Il layout resta quello
del 29/09; cambiano luce, materia e movimento.

Successo:

- palco, finestre e volti hanno profondità visibile anche da fermi;
- i quattro momenti scelti (sotto) si vedono da host e ospite;
- con `prefers-reduced-motion: reduce` niente si muove e l'interfaccia resta completa;
- nessuna nuova dipendenza di runtime; gli e2e esistenti passano senza modifiche.

## Decisioni prese con Sean (30/09)

| Tema | Scelta |
|---|---|
| Direzione | «A · Profondità»: solo CSS, layout invariato (scartati «Spazio», CSS 3D a scena, e «Olografico», WebGL) |
| Momenti animati | finestre vive, nascita di un contenuto, aggancio agli slot, alone della voce |
| Esclusi | scia dell'agente al lavoro (la vede solo l'host), accensione all'ingresso in call (rischiosa sulle riconnessioni) |
| Costruzione | CSS più API native (View Transitions), nessuna libreria di animazione |

«Olografico» resta un'ipotesi per dopo lo spike CPU, come strato opzionale sopra questo.

## 1. Materia

Sempre visibile, anche con movimento ridotto.

- **Palco**: luce morbida dall'alto (gradiente radiale da `stage` verso un grigio più scuro)
  e grana leggera (rumore SVG in overlay, opacità circa 8%, `pointer-events: none`).
- **Finestre**: filo di luce sul bordo alto (ombra interna di 1px), ombra calda e morbida
  sotto; l'attiva ha l'alone lime oltre al bordo.
- **Laboratorio, barre, tessere**: filo di luce interno; nient'altro.
- **Token nuovi** in `packages/ui/src/theme.css`: `glow` (alone lime), `shadow-window`
  (ombra delle finestre), classe `grain`. Nessun colore nuovo: il lime resta solo su ciò che
  è vivo (spec del 29/09, §1).

## 2. I quattro momenti

| Momento | Cosa si vede | Chi lo vede | Durata |
|---|---|---|---|
| Finestre vive | le finestre del palco si inclinano al massimo di ±5° e riflesso e ombra seguono il puntatore di chi guarda; durante un pizzico seguono la mano | chiunque abbia un mouse (desktop) | continuo, segue il puntatore; torna a zero quando esce dal palco |
| Nascita | la finestra che riceve un contenuto nuovo sale dal fondo, da sfocata a nitida, con un lampo lime che si spegne | host e ospiti, desktop e telefono | circa 600 ms |
| Aggancio | durante il trascinamento lo slot sotto il puntatore si illumina; al rilascio la finestra raggiunge lo slot nuovo con un piccolo rimbalzo | slot illuminato: host; spostamento: host e ospiti su desktop | circa 400 ms |
| Voce | l'alone lime attorno al volto di chi parla cresce e cala col volume | tutti | segue il livello, circa 8 aggiornamenti al secondo |

Regole comuni:

- durate fra 150 e 600 ms; nessuna animazione in loop quando nessuno fa niente;
- solo `transform`, `opacity`, `filter` e `box-shadow`;
- con movimento ridotto: nessuna inclinazione, nascita e aggancio istantanei, alone fisso su
  chi parla (come oggi);
- telefono dell'ospite: niente inclinazione (non c'è puntatore) e niente aggancio (si vede
  una finestra alla volta); nascita e voce sì.

## 3. Architettura e confini

### Cosa è cambiato sul palco

`apps/web/src/lib/stage/motion.ts`, funzione pura:

```ts
stageChanges(prev: Stage, next: Stage): { born: string[]; moved: string[] }
```

- `born`: id delle finestre che in `next` contengono un contenuto assente da quella finestra
  in `prev`;
- `moved`: id delle finestre presenti in entrambi con slot diverso.

Non sa da dove arriva il comando (mouse, mano, agente, host remoto): confronta due stati.
Per questo vale uguale per host e ospite, e per snapshot e comandi.

### Nascita e aggancio

- `useStage` fa passare ogni aggiornamento da `commit(next)`: lì si calcola
  `stageChanges(stageRef.current, next)`.
- Se `moved` non è vuoto e le animazioni sono consentite, l'aggiornamento avviene dentro
  `document.startViewTransition(() => flushSync(() => setStage(next)))`. Ogni finestra ha
  `view-transition-name: win-<id>` e la curva dell'animazione ha un piccolo rimbalzo.
- Animazioni «consentite» = l'API esiste, `prefers-reduced-motion` non è `reduce`,
  `document.visibilityState` è `visible`. Altrimenti lo stato si aggiorna subito, come oggi.
- `born` passa a `WindowView` come `data-born` per circa 600 ms; l'animazione è CSS sotto
  `motion-safe:`.
- Lo slot illuminato: durante il trascinamento (drag nativo o pizzico) lo slot restituito da
  `nearestSlot` prende `data-hot`. Si toglie al rilascio o all'uscita dal palco.

### Inclinazione

- `apps/web/src/lib/stage/tilt.ts`: `tiltFromPoint(rect, point)` restituisce `{ x, y }` in
  [-1, 1], limitato ai bordi.
- Un hook scrive `--tilt-x` e `--tilt-y` sull'elemento del palco con al massimo un
  aggiornamento per frame (`requestAnimationFrame`), senza render di React; azzera
  all'uscita del puntatore.
- Attivo solo con `(hover: hover) and (pointer: fine)` e senza movimento ridotto.
- Gli eventi `MOVE` del pizzico (già in `use-gestures.ts`) chiamano lo stesso setter.

### Voce

- In `packages/realtime` (l'unico posto dove vive LiveKit), nuova sottoscrizione sulla
  sessione: `onAudioLevels(cb: (levels: Record<string, number>) => void): () => void`.
- Ogni 125 ms legge `audioLevel` dei partecipanti che parlano, arrotonda a passi di 0,1
  in [0, 1] ed emette solo se qualcosa è cambiato. Chi smette di parlare esce a 0.
- Separata dal roster: la call non si ri-renderizza a ogni campione.
- `FaceTile` riceve `level?: number` e lo applica come variabile CSS `--level`
  all'alone.
- Regola 1: è un numero in memoria, non audio, non persiste da nessuna parte.

### `packages/ui`

Solo presentazione. Nuovi token e classe `grain` in `theme.css`; `FaceTile` con `level`;
`Panel` e tessere con il filo di luce. Nessun dato, nessuna chiamata.

## 4. Test

- **Unit**:
  - `stageChanges`: contenuto nuovo, contenuto già presente, finestra spostata, finestra
    creata (non è `moved`), finestra archiviata, stati identici.
  - `tiltFromPoint`: centro, angoli, fuori dal rettangolo, rettangolo a larghezza zero.
  - quantizzazione del livello audio: arrotondamento, limiti, emissione solo sul
    cambiamento (sessione finta).
  - aggiornamento del palco senza `startViewTransition` e con movimento ridotto: applicato
    subito.
  - `FaceTile` con `level`: variabile CSS presente; senza `level` nessun alone variabile.
  - classi di movimento solo sotto `motion-safe:`.
- **e2e**: quelli esistenti senza modifiche; uno screenshot del palco con finestre in
  `screenshots.spec.ts`.

## 5. Fuori da qui

- «Spazio» (scena 3D con camera) e «Olografico» (WebGL): dopo lo spike CPU, eventualmente.
- Scia dell'agente al lavoro e accensione all'ingresso in call.
- Pagine di passaggio, dashboard e accesso: restano come sono.
