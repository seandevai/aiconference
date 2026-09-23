# ADR-0007 — La scheda è l'unico oggetto del canvas

**Data:** 22/09/2026 · **Stato:** sostituito da ADR-0009

## Contesto

Con le gesture dentro l'MVP (ADR-0005), il canvas deve essere qualcosa che le
gesture possano comandare. Uno swipe scorre fra cose; un pinch ingrandisce una cosa.
Servono quindi oggetti discreti, ordinati e ridimensionabili.

Il canvas immaginato nella versione 1 della spec era invece un documento che si
compila da solo — obiettivi, decisioni, prossimi passi. Su un documento uno swipe
non significa nulla: non c'è niente da scorrere.

Le due idee tiravano il prodotto in direzioni opposte. Andava scelto un baricentro.

## Decisione

**Tutto ciò che il canvas produce è una scheda.** Un concept visivo, un diagramma,
un elenco di decisioni, un'immagine: stesso oggetto, `kind` diverso.

```ts
type Card = {
  id: string
  kind: 'concept' | 'diagram' | 'document' | 'image'
  status: 'draft' | 'kept'
  variants: Variant[]
  activeVariant: number
  size: 'large' | 'small'
  order: number
  authorId: string
  expiresAt?: number
}
```

Il canvas è una **lista ordinata di schede**, non un documento. Il verbale finale è
semplicemente l'insieme delle schede tenute, composto in PDF alla chiusura.

Una scheda aperta occupa circa il 58% del canvas e lascia le altre visibili di lato.
Non copre mai tutto.

Le gesture mappano uno a uno su questo modello: swipe scorre `variants`, pinch
cambia `size`, palmo attiva il riconoscimento.

Nessun CRDT. Il conflitto si risolve con last-write-wins sull'ordinamento più un id
monotono per scheda: a questa granularità basta.

Le schede con `status: 'draft'` hanno `expiresAt`. Se nessuno le tiene entro la
scadenza, il riduttore le rimuove e non entrano nel PDF.

## Conseguenze

Positive: un solo modello mentale per l'utente e un solo modello dati per il codice.
Le gesture sono sempre sensate, in qualsiasi punto del canvas. `packages/canvas`
riceve comandi senza sapere se arrivano da mouse, mano o agente, il che rende la
regola «ogni gesto ha il suo click» una proprietà del codice invece che una promessa.

Negative: un elenco di decisioni dentro una scheda è meno leggibile di un documento
continuo, e il PDF deve ricomporre schede in un testo che si legga come un verbale —
lavoro di composizione non banale. Se in futuro serve una superficie di disegno
libero, il modello va esteso da lista di schede a documento con operazioni, e non è
una modifica gratuita (già notato in ADR-0002).

## Alternative scartate

**Canvas a due zone** — documento che si compila da un lato, galleria esplorabile
dall'altro. Copre entrambi i casi d'uso, ma raddoppia il modello mentale e le
gesture funzionano solo in metà schermo.

**Canvas come documento puro.** Migliore per il verbale, ma rende le gesture
decorative e svuota ADR-0005.
