# Redesign della call e del palco (Nod) — design

Data: 29/09/2026. Nasce dopo la prima demo completa lato codice (slice 0-5, call da
telefono, pacchetto pre-demo): prima del test con i 5 consulenti l'interfaccia deve
sembrare un prodotto, non un prototipo. Nome proposto da Sean: «Nod» (bozza del logo in
`design/`, fuori da git; marchio da verificare). Scelte fatte con il visual companion
(mockup in `.superpowers/brainstorm/1199-1790675411/`).

## Obiettivo

Il consulente usa Nod davanti a un cliente vero senza imbarazzo, il cliente se lo ricorda,
e l'host non si perde mai. Tre obiettivi in equilibrio, nessuno prevale: fiducia, effetto
«wow» del palco, chiarezza d'uso.

Successo: nel test con i consulenti nessuno chiede «dove clicco per…» sui comandi della
call e del palco; gli e2e esistenti passano senza cambiare comportamento; host desktop,
ospite desktop, telefono verticale e orizzontale hanno tutti la nuova veste.

## Scomposizione

Il redesign è diviso in tre sotto-progetti; questa spec copre i primi due.

1. **Identità e design system**: token, carattere, componenti base in `packages/ui`, logo.
2. **Call e palco**: host e ospite su desktop, ospite su telefono.
3. **Dashboard, login, registrazione**: dopo il test con i consulenti (fuori da qui).

## Decisioni prese con Sean (29/09)

| Tema | Scelta |
|---|---|
| Direzione visiva | «Palco»: antracite del logo, bianco caldo, un solo accento |
| Accento | lime `#c8f25a`, solo per ciò che è vivo |
| Host desktop | laboratorio a sinistra (agente e vassoio), palco al centro, volti in alto |
| Telefono | palco al centro, una finestra alla volta, volti piccoli |
| Carattere | Manrope |
| Tema | solo scuro |
| Costruzione | token e pochi componenti nostri in `packages/ui`; shadcn solo caso per caso |

## 1. Identità e token

### Colori

| Token | Valore | Uso |
|---|---|---|
| `bg` | `#282828` | fondo dell'app |
| `surface` | `#303030` | laboratorio, barre |
| `stage` | `#202020` | il palco: un gradino più scuro, «qui si guarda» |
| `raised` | `#3a3a3a` | pillole, tessere, finestre |
| `line` | `#3d3d3d` | bordi |
| `text` | `#ededed` | testo principale |
| `muted` | `#a6a6a6` | testo secondario (circa 4,7:1 anche su `raised`) |
| `accent` | `#c8f25a` | chi parla, agente al lavoro, finestra attiva, gesture armate |
| `on-accent` | `#202020` | testo sopra il lime |
| `danger` | `#ff6b6b` | solo errori |

Il testo su `bg`, `surface` e `raised` supera il contrasto AA (4.5:1), `muted` compreso.
Il lime non è mai colore di testo su superfici chiare e non decora: se non indica qualcosa
di vivo, non c'è.

### Forme, carattere, movimento

- Raggi: 10px finestre e tessere, 14px pannelli, pillole piene per i pulsanti.
- Niente ombre marcate: la profondità viene dai tre grigi `stage` < `bg` < `surface`.
- Manrope via `next/font` al posto di Geist; `font-variant-numeric: tabular-nums` nei dati.
- Transizioni di 150-200 ms (bordo di chi parla, barra dell'agente); nessuna con
  `prefers-reduced-motion: reduce`.

### Logo

Componente `Logo` in `packages/ui`. Finché Sean non fornisce l'SVG definitivo: la finestra
con le quattro maniglie disegnata in SVG più la scritta «nod» in Manrope Extra Bold.
Sostituire il segnaposto è un cambio di un solo file. Il nome compare solo nell'interfaccia
(titolo pagina, barra alta): il codice resta `@omnicanvas/*` fino a un ADR sulla rinomina.

## 2. Host su desktop

```
┌──────────────────────────────────────────────────────────────┐
│ ▢ nod   Kickoff Acme · 🔒 niente viene conservato  [S][A][M]│  barra alta
├───────────────┬──────────────────────────────────────────────┤
│ ✦ AGENTE      │  ‹ ›  Finestra 2 di 3        ＋ Nuova finestra│  barra del palco
│ [chiedi…   ]  │ ┌──────────────────┐ ┌───────────────┐       │
│ 1.240 crediti │ │ Ricavi (attiva)  │ │ Proposta      │       │
│ VASSOIO       │ └──────────────────┘ └───────────────┘       │
│ 📊 Margini    │                 palco                        │
│ ✋ gesture     │                                              │
├───────────────┴──────────────────────────────────────────────┤
│      🎤 Microfono   📷 Camera   Riquadro   Gira    [Esci]    │  controlli della call
└──────────────────────────────────────────────────────────────┘
```

- **Barra alta**: logo, titolo della riunione, etichetta «niente viene conservato» con
  lucchetto (la promessa di ephemerality si vede), volti piccoli a destra con bordo lime
  su chi parla; clic su un volto → spotlight.
- **Laboratorio** (colonna di circa 280px, `surface`), dall'alto:
  1. Agente: campo «Chiedi all'agente…» sempre visibile, contatore crediti; mentre lavora,
     barra lime animata e «sta lavorando».
  2. Vassoio: contenuti prodotti, trascinabili sul palco, ciascuno con il menu «Metti in…»
     come click equivalente (ADR-0005).
  3. Gesture: interruttore e anteprima piccola della camera; bordo lime quando il palmo
     arma il gesto.
- **Palco** (`stage`): barra sottile con finestra precedente/successiva, «Finestra N di M»
  e «＋ Nuova finestra»; finestre negli slot magnetici come oggi, bordo lime sull'attiva.
- **Controlli della call**: Microfono, Camera, Riquadro, Gira fotocamera (solo con due
  fotocamere), Esci in chiaro a destra.
- **Avvisi** (audio da attivare, errore di camera o microfono, riconnessione): banner sopra
  il palco invece del testo sparso di oggi.

## 3. Ospite

- **Desktop**: lo schermo dell'host senza laboratorio; il palco prende tutta la larghezza.
  La barra del palco mostra solo «Finestra N di M», senza comandi.
- **Telefono verticale**: barra con logo e volti piccoli, palco con una finestra alla volta,
  puntini che dicono quante finestre ci sono, controlli sotto.
- **Telefono orizzontale**: palco a sinistra, colonna volti a destra con «Esci», nessuna
  barra alta.
- Comportamenti invariati: il palco segue l'host, swipe per sbirciare e tornare, tocco sul
  volto per lo spotlight, PiP con iniziale a camera spenta, proprio riquadro specchiato con
  la fotocamera anteriore. Pulsanti alti almeno 44px su telefono.
- **Spotlight**: fondo `stage`, nome in una pillola, «✕» come oggi.
- **Pagine di passaggio** (ingresso ospite, riunione terminata, stati di connessione):
  prendono i token, senza redesign.

## 4. Componenti e confini

`packages/ui` contiene solo presentazione: nessun dato, nessuna chiamata, nessun import da
`apps/web` o da altri pacchetti con stato.

| Componente | Cosa fa |
|---|---|
| `Logo` | segnaposto SVG finché non arriva quello definitivo |
| `Button` | varianti `pill`, `accent`, `exit`, `icon`; nome accessibile obbligatorio |
| `Panel` | superficie del laboratorio e delle barre |
| `FaceTile` | iniziale o video (via `children`), bordo lime se parla, stato microfono |
| `StatusBanner` | avvisi sopra il palco, con `role="status"` o `role="alert"` |

I token stanno in `packages/ui/src/theme.css`, importato da `apps/web/src/app/globals.css`
dentro `@theme` di Tailwind: una sola fonte, nessun colore esadecimale nelle schermate.

Vassoio, finestra, pannello agente, controllo gesture restano in `apps/web` perché leggono
stato e comandi. Si spostano in `packages/ui` solo al secondo uso che li rende generici.

## 5. Test

- **Unit** (`tests/unit/ui-*.test.tsx`): componenti di `packages/ui` con DOM di test; nomi
  accessibili, varianti, bordo di chi parla, `aria-pressed` dei pulsanti a interruttore.
  Servono `happy-dom` e `@testing-library/react` come dipendenze di sviluppo, con l'ambiente
  DOM attivato solo per quei file (gli altri test restano in `node`).
- **E2E**: si appoggiano a ruoli e nomi accessibili. Si tengono **identici** («Riquadro»,
  «Nuova finestra», «Gira fotocamera», «Esci», i nomi di agente e vassoio…): se gli e2e
  passano, il redesign non ha cambiato comportamento. Un nome che cambia per forza si
  aggiorna insieme al test, nello stesso commit, dichiarandolo.
- **Controllo visivo**: screenshot Playwright di host desktop, ospite desktop, telefono
  verticale e orizzontale, allegati alla PR per la revisione di Sean. Non sono confronti
  automatici di pixel.

## Regole del progetto toccate

- Ogni gesto ha il suo click (ADR-0005): nessun comando del palco perde il suo pulsante.
- Nessun contenuto su disco: il redesign è solo presentazione.
- Confini: `packages/ui` non legge dati; LiveKit resta in `packages/realtime`.

## Fuori da questa spec

Dashboard, login e registrazione (sotto-progetto 3); tema chiaro; rinomina del codice in
Nod (ADR); logo definitivo (serve l'SVG di Sean); nuove funzioni.

## Rischi

- **Laboratorio stretto su portatili da 13"**: con 280px il palco perde spazio. Sotto i
  1280px di larghezza il laboratorio si riduce e il vassoio diventa una lista compatta.
- **Manrope e le cifre**: da controllare nei grafici veri; se le cifre tabulari non
  bastano, i numeri dei grafici usano il carattere di sistema.
- **E2E fragili sul layout**: se un e2e dipende dalla posizione e non dal nome, va
  corretto per usare il nome, non il redesign piegato al test.
