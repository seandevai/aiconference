# Laboratorio gesture semplice e da telefono — design

Data: 06/10/2026. Segue `2026-10-06-gesture-lab-staging-design.md`. Sean ha trovato la pagina
confusa su uno schermo 1920x1080 e vuole usarla anche da telefono: Lorenzo registra con la
fotocamera frontale, Sean (senza webcam) rigioca e tara. Mockup approvati in
`.superpowers/brainstorm/41057-1791309277/content/` (fuori da git).

## Obiettivo

1. **Chiaro al primo sguardo:** una cosa alla volta, nomi dei gesti in italiano, niente codici
   tipo `FOCUS_NEXT` nella vista di base.
2. **Tutto da telefono:** provare, registrare, rigiocare e tarare, in verticale e in
   orizzontale.
3. **Il tecnico c'è ma non si vede:** taratura, correzioni, dizionario, preset, diagnostica e
   «Copia come codice» stanno in «Avanzate», chiuso di default.

Successo: Lorenzo registra un gesto dal telefono seguendo i passi senza istruzioni a voce;
Sean apre una registrazione dal telefono, la rigioca e legge l'esito senza cercarlo. La call
non cambia; server, tabelle e server action non cambiano.

## Decisioni prese con Sean (06/10)

| Tema | Scelta |
|---|---|
| Struttura di base | pagina iniziale con tre grandi scelte; ognuna apre una schermata intera |
| Registra | guidato in quattro passi: gesto → posizione → conto e registrazione → esito |
| Nome della registrazione | composto da solo (gesto; autore e data sono già salvati); nota facoltativa |
| Rigioca | elenco filtrabile per gesto → schermata di rigioco con mano, esito, palco |
| Avanzate | pannello sopra la schermata in cui si prova: dal basso su telefono verticale, colonna a destra su computer e telefono orizzontale |
| Codice | una sola pagina, schermata nell'URL (`?vista=`), un solo `useGestureLab` |

## 1. Schermate

### 1.1 Pagina iniziale (`?vista` assente)

Titolo «Laboratorio gesture», sotto «Cosa vuoi fare?» e tre bottoni grandi:

- **Prova le gesture** — fotocamera e palco.
- **Registra un gesto** — guidato a passi. Solo admin.
- **Rigioca dall'archivio** — anche senza webcam. Solo admin.

Senza archivio (sviluppo locale senza admin) si vede solo «Prova». Su telefono i bottoni sono
impilati, su schermo largo affiancati.

### 1.2 Prova (`?vista=prova`)

La fotocamera parte entrando. Vista della mano grande con il nome del gesto riconosciuto e
cosa fa sul palco («Palmo aperto → attiva/pausa gesture»); palco minimo con due finestre fisse;
«Ferma fotocamera». Messaggi esistenti per webcam negata o riconoscimento non disponibile.

### 1.3 Registra (`?vista=registra`)

Una schermata per passo, «‹ Indietro» torna al passo prima (al passo 1 torna alla pagina
iniziale).

1. **Quale gesto registri?** Elenco dei nove gesti (icona, nome italiano) più «Gesto nuovo»;
   scegliendo «Gesto nuovo» compare un campo «Come lo chiami?» obbligatorio (1-60 caratteri).
2. **Mettiti in posizione.** La fotocamera parte qui. Vista della mano con «✓ mano vista»
   quando c'è una mano; riga «Come si fa» del gesto scelto; bottone «Inizia».
3. **Conto alla rovescia** 3-2-1, poi 4 s di registrazione con barra del tempo; «Annulla».
4. **Esito.** «✓ Riconosciuto» se fra gli eventi scattati c'è quello atteso, altrimenti
   «✗ Non riconosciuto» con gli eventi scattati per nome; per «Gesto nuovo» solo
   «Registrato». Campo «Nota (facoltativa)», «Salva nell'archivio», «▶ Rivedi», «↺ Rifai».
   Dopo il salvataggio: «Salvato» e «Registra un altro».

Se la registrazione non ha fotogrammi si torna al passo 2 col messaggio esistente.

### 1.4 Rigioca (`?vista=rigioca`, `?vista=rigioca&id=<uuid>`)

**Elenco:** pillole per filtrare per gesto (Tutti + i gesti presenti); righe con icona e nome
del gesto, autore, data, nota. «Carica un file JSON…» come link piccolo in fondo.

**Rigioco** (con `id`): mano ridisegnata dai punti registrati, esito grande come al passo 4
(atteso e scattato), palco a due finestre che reagisce, barra di avanzamento, «Rigioca» /
«Pausa», menu «⋯» con «Scarica JSON» e «Elimina» (solo le proprie). «‹ Archivio» torna
all'elenco.

### 1.5 Avanzate

Si apre col ⚙ in «Prova», nel passo 2 di «Registra» e nel rigioco. Mano e palco restano
visibili, così l'effetto di una modifica si vede subito. Sezioni a fisarmonica, tutte chiuse:

- **Taratura** — gli slider di oggi.
- **Correzioni** — gli interruttori di oggi.
- **Dizionario** — gesto → comando, l'unico posto coi codici.
- **Preset** — solo admin, come oggi.
- **Diagnostica** — posa grezza e stabile, numeri delle dita, elenco degli eventi.
- In fondo «Copia come codice» e «Ripristina predefiniti».

Le impostazioni restano in `localStorage` come oggi.

## 2. Disposizione

| Schermo | Prova / rigioco | Avanzate |
|---|---|---|
| Telefono verticale (< 640 px) | mano in alto, palco sotto, comandi in fondo | pannello dal basso a metà altezza, trascinabile fino a schermo intero |
| Telefono orizzontale | mano a sinistra, palco a destra | colonna da destra sopra il palco |
| Computer (≥ 1024 px) | palco grande sopra, mano sotto | colonna a destra di 320 px; chiusa, il palco prende tutta la larghezza |

Bottoni alti almeno 44 px, niente scroll orizzontale, `100dvh` per le barre del browser mobile.
Il trascinamento del pannello ha il click equivalente (regola 6): toccare la maniglia
alterna metà e intero.

## 3. Codice

### 3.1 Struttura

`apps/web/src/app/dev/gesture-lab/`:

| File | Cosa fa |
|---|---|
| `lab.tsx` | legge `vista` (e `id`) dall'URL, tiene `useGestureLab` e le impostazioni, mostra la schermata |
| `home-screen.tsx` | la pagina iniziale |
| `try-screen.tsx` | Prova |
| `record-wizard.tsx` | i quattro passi; prende il posto di `record-panel.tsx` |
| `replay-screen.tsx` | elenco e rigioco; prende il posto di `archive-panel.tsx` e `replay-panel.tsx` |
| `advanced-panel.tsx` | il contenitore che sale dal basso o entra da destra, con le sezioni |
| `hand-view.tsx` | la vista della mano col nome del gesto; numeri e posa passano in Diagnostica |
| `lab-controls.tsx`, `preset-panel.tsx`, `event-list.tsx` | restano, dentro Avanzate |

Spariscono `lab-tabs.tsx` e `server-panels.tsx`: le azioni server (`actions.ts`) le chiamano
direttamente `record-wizard`, `replay-screen` e la sezione Preset, con lo stesso schema
«occupato / messaggio d'errore» di oggi.

### 3.2 Navigazione

Cambiare schermata fa `window.history.pushState` con `?vista=…` (un passo nella cronologia,
letto con `useSearchParams`, senza rifare la pagina server né perdere webcam e palco), così il
tasto indietro di Android e del browser equivale a «‹ Indietro». I passi interni di «Registra» non
vanno nell'URL. `vista` sconosciuta → pagina iniziale. `vista=registra` o `rigioca` senza
archivio → pagina iniziale.

### 3.3 Fotocamera

`startLive` entrando in «Prova» e al passo 2 di «Registra»; `stopLive` tornando alla pagina
iniziale e al rigioco (che già la ferma). Il permesso lo chiede il browser la prima volta.

### 3.4 Nomi dei gesti

Nuovo `apps/web/src/lib/gesture-lab/gesture-catalog.ts`: per ognuno dei nove `GestureName`
icona, nome italiano, riga «Come si fa», evento atteso e cosa fa sul palco. Le registrazioni
continuano a salvare in `expect` il tipo di evento: il catalogo traduce evento ↔ gesto con il
dizionario predefinito (`DRAG` → evento `GRAB`). `expect` nullo = «Gesto nuovo», mostrato con
la sua etichetta.

Il nome di una registrazione (`label`) è il nome italiano del gesto, o il nome scritto per un
gesto nuovo; la nota va in `description`. Schema e tabella invariati.

### 3.5 Esito

Nuova funzione pura `evaluateRecording(recording, settings): GestureEvent['type'][]` in
`lib/gesture-lab/`: spinge tutti i fotogrammi in una `createPipeline` con la taratura data e
restituisce gli eventi scattati. Serve al passo 4 e all'apertura di un rigioco, così l'esito si
legge subito anche prima di premere «Rigioca». Il rigioco animato resta quello di oggi.

## 4. Test

Prima dei componenti, come sempre:

- `gesture-catalog`: nove gesti, ogni evento atteso è un evento valido, andata e ritorno
  evento ↔ gesto.
- `evaluateRecording`: una registrazione che produce l'evento atteso lo restituisce; una vuota
  restituisce `[]`.
- Navigazione: `vista` sconosciuta o non permessa → pagina iniziale; senza archivio solo «Prova».
- `record-wizard`: i quattro passi in ordine, «Gesto nuovo» chiede il nome, salvataggio con
  `label` e `description` giusti, «Rifai» torna al passo 2.
- `replay-screen`: filtro per gesto, apertura per `id`, «Elimina» solo sulle proprie.
- `advanced-panel`: chiuso di default, sezioni chiuse, la maniglia alterna metà/intero col click.
- I test di oggi su tab e pannelli (`gesture-lab-layout`, `gesture-lab-server-panels`,
  `gesture-lab-record`) si riscrivono sulle nuove schermate.
- Verifica a mano su staging: iPhone verticale e orizzontale, computer 1920x1080.

## Fuori da questa spec

- Riconoscitori nuovi per i gesti registrati come «Gesto nuovo».
- Modifiche alla call, al palco reale o al pacchetto `gesture`.
- Video nelle registrazioni (vietato dalla regola 1).
