# Banco di prova su PC e mano al centro sul telefono — design

Data: 09/10/2026. Segue `2026-10-06-gesture-lab-redesign-design.md`. Mockup approvati in
`.superpowers/brainstorm/24238-1791534810/content/` (fuori da git): `banco-pc.html` (scelta C) e
`rigioco-telefono.html` (scelta A).

## Perché

Sean, provando il laboratorio dopo il redesign del 06/10:

1. **Telefono confuso:** il palco con le finestre prende tutto lo spazio e il rigioco non si
   segue. Oggi in verticale la mano ha il 38% dell'altezza e il palco il resto.
2. **Debug dal vivo su PC:** oltre a registrare lo scheletro, vederlo in tempo reale insieme ai
   numeri che spiegano perché un gesto scatta o no. Lo scheletro oggi esiste, ma è spento di
   default (`toggles.feedback`) e i numeri stanno in «Avanzate → Diagnostica», in colonna.

Successo: su PC Sean apre «Banco di prova», muove la mano e capisce dai numeri perché un gesto
non scatta, senza aprire «Avanzate». Sul telefono Sean rigioca una registrazione e vede mano,
esito e comandi senza scorrere e senza che il palco li copra.

## Decisioni prese con Sean (09/10)

| Tema | Scelta |
|---|---|
| Contenuto del banco | scheletro più numeri dal vivo (posa, dita, hold, eventi); niente palco |
| Disposizione del banco | scheletro sopra, tre riquadri sotto: posa · dita · eventi |
| Dove sta il banco | quarta scelta della pagina iniziale, solo su PC; «Prova» resta com'è |
| Registra su PC | il banco (scheletro e riquadri) al posto del palco, con i passi guidati |
| Telefono | in Prova, Registra e Rigioca solo la mano a tutto spazio; palco a richiesta |
| Scheletro | sempre acceso, ovunque; l'interruttore «feedback» sparisce |

## Cosa cambia per schermata

PC vuol dire da `lg` in su; telefono vuol dire sotto `lg`, in verticale e in orizzontale. Lo
decide solo il CSS, come oggi.

| Schermata | PC | Telefono |
|---|---|---|
| Pagina iniziale | quattro scelte: Prova, Banco di prova, Registra, Rigioca | tre scelte, il banco non compare |
| Prova | come oggi: palco grande, mano sotto | mano a tutto spazio, «Mostra il palco» |
| Banco di prova (nuova) | scheletro sopra, tre riquadri sotto | non esiste: `?vista=banco` torna alla pagina iniziale |
| Registra | passi guidati, banco al posto del palco | passi guidati, mano a tutto spazio, «Mostra il palco» |
| Rigioca | come oggi: palco e mano | mano a tutto spazio, esito e comandi in vista, «Mostra il palco» |

Il banco e Registra su PC hanno anche loro «Avanzate», come oggi.

## Il banco

Scheletro come in `HandView` (grigio il grezzo, lime il filtrato), col nome del gesto e
l'anello dell'hold. Sotto, tre riquadri affiancati della stessa altezza:

1. **Posa:** posa grezza, posa stabile, armato o in pausa, avanzamento dell'hold come barra
   (`view.hold.progress`), pausa residua in ms (`view.cooldownLeftMs`), trascinamento in corso.
2. **Dita:** una barra per indice, medio, anulare e mignolo col valore di `poseMetrics`, con due
   tacche alle soglie `tuning.pose.folded` e `tuning.pose.extended`; una barra per il pinch con
   la tacca a `tuning.pose.pinchOn`; pollice esteso o chiuso. Le barre vanno da 0 a 1; un
   valore fuori scala si ferma al bordo e il numero resta scritto.
3. **Eventi:** gli ultimi eventi del registro (`log`), il più recente in alto, coi secondi dall'avvio come oggi.

Senza mano in vista i riquadri dicono «Nessuna mano in vista» e le barre restano vuote; a
fotocamera spenta vale il messaggio di oggi sullo scheletro.

Il componente `BenchPanel` sostituisce `Diagnostics`: stessi dati, disposti in tre riquadri.
In «Avanzate» la sezione Diagnostica usa `BenchPanel` in colonna (sotto `lg` i riquadri si
impilano).

## Il palco a richiesta sul telefono

Sotto `lg` la scena mostra solo la mano, che prende tutto lo spazio rimasto da intestazione,
esito e comandi. Un bottone «Mostra il palco» / «Nascondi il palco» (alto almeno 44 px) apre il
palco al posto della mano; la mano torna con lo stesso bottone. Lo stato non si salva: ogni
schermata parte con la mano.

Il palco resta montato e si nasconde con `hidden`, come già il `<video>`: finestre e fuoco non
si perdono, e le gesture continuano ad agire sul palco anche quando non si vede. Aprendolo si
vede l'effetto.

## Codice

Una sola pagina, un solo `useGestureLab`, come oggi. Server, tabelle, server action, call,
`packages/gesture`, `packages/canvas` e `stage-gesture-handler.ts` non cambiano.

- `lib/gesture-lab/lab-view.ts`: nuova vista `banco`, senza archivio.
- `home-screen.tsx`: quarta scelta «Banco di prova», nascosta sotto `lg` (`max-lg:hidden`).
- `lab.tsx`: se la vista è `banco` e lo schermo è sotto `lg`, torna alla pagina iniziale.
  Il controllo usa `matchMedia('(min-width: 64rem)')` al montaggio e al cambio. È l'unico
  punto in cui decide JavaScript, perché qui si cambia vista e non solo aspetto.
- `lab-scene.tsx`: riceve `variant: 'stage' | 'bench'` e i dati del banco. Su PC `stage`
  mette palco grande e mano sotto (oggi), `bench` mette mano sopra e `BenchPanel` sotto. Sotto
  `lg` le due varianti sono uguali: mano a tutto spazio e bottone del palco.
- `bench-screen.tsx` (nuovo): intestazione, scena in variante `bench`, avvio e arresto della
  fotocamera, come `TryScreen`.
- `bench-panel.tsx` (nuovo) sostituisce `diagnostics.tsx`.
- `record-wizard.tsx`: la scena in variante `bench`.
- `hand-view.tsx`: lo scheletro e l'anello dell'hold sono sempre attivi; la prop `feedback`
  sparisce.
- `lab-controls.tsx`: l'interruttore «feedback» sparisce. `settings.ts` legge ancora
  `toggles.feedback` dalle impostazioni salvate e lo ignora, così un `localStorage` vecchio non
  rompe la pagina; il tipo perde il campo.

## Test

Prima del codice, visti rossi e poi verdi (regola 5).

- `lab-view`: `?vista=banco` è valida anche senza archivio; `viewSearch('banco')`.
- `BenchPanel`: con una mano nota e una `tuning` nota, valori, posizione delle tacche e barre
  ai bordi per valori fuori scala; «Nessuna mano in vista» senza mano; eventi in ordine.
- `LabScene`: in variante `bench` c'è il pannello e non il palco; in variante `stage` c'è il
  palco; il bottone del palco alterna mano e palco e ha nome accessibile (regola 6: è il click
  equivalente del guardare l'effetto del gesto).
- `HomeScreen`: quattro scelte, quella del banco con la classe che la nasconde sotto `lg`.
- `HandView`: lo scheletro si disegna senza interruttore.
- `settings`: impostazioni salvate con `feedback` si leggono senza errori.
- Controllo a mano: 1920x1080 (banco, Registra, Prova, Rigioca) e iPhone in verticale e in
  orizzontale (Prova, Registra, Rigioca, palco a richiesta).

## Fuori

- Numeri dal vivo sul telefono.
- Palco nel banco.
- Registrare video o immagini: si salvano solo i punti della mano (regola 1).
- Gesti con due mani in contemporanea (`docs/BACKLOG.md`, «Gesture a due mani — 08/10»).
