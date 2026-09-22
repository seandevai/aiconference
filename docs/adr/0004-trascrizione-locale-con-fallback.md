# ADR-0004 — Trascrizione locale con fallback server esplicito

**Data:** 22/09/2026 · **Stato:** sostituito da ADR-0006

## Contesto

Il PRD chiede che l'audio venga convertito in testo localmente via Web Speech API,
sia per costo sia per coerenza con l'ephemerality. Il PRD stesso però mette in conto
"Whisper + Claude API" nella tabella costi, a 0,45 $ l'ora.

Web Speech API ha un problema noto: la copertura reale è buona su Chrome, parziale
altrove, e su Safari il comportamento cambia fra versioni. In più, su Chrome
l'implementazione invia comunque l'audio ai server di Google, il che indebolisce
l'argomento privacy se non viene detto.

## Decisione

Primo percorso: Web Speech API nel browser, con la trascrizione che non lascia mai
il client se non come finestra di testo mandata all'agente.

Fallback: Whisper server-side, attivato solo quando il browser non supporta il primo
percorso, con audio processato in memoria e mai scritto su disco.

Il percorso attivo deve essere **visibile nella UI della stanza**. Se l'audio passa
da un vendor esterno, l'utente lo vede prima di parlare, non in una nota legale.

La verifica di copertura reale è un passo obbligatorio della slice 3. Se Web Speech
API si rivela inaffidabile oltre Chrome, questo ADR viene sostituito e il costo
orario del modello economico va rivisto verso l'alto.

## Conseguenze

Positive: costo basso sul percorso principale, coerenza con la promessa di privacy,
degrado controllato invece di rottura.

Negative: due percorsi di trascrizione da mantenere e testare. La promessa "nulla
lascia il dispositivo" va formulata con precisione, perché su Chrome non è
letteralmente vera. L'informativa privacy deve distinguere i due casi.
