# ADR-0012 — Parola chiave con openWakeWord, modello addestrato da noi, nome provvisorio «Ehi Omnia»

**Data:** 26/09/2026 · **Stato:** accettato, nome provvisorio · **Sostituisce:** nulla

## Contesto

L'agente si attiva a comando (spec §2.3): parola chiave, indice alzato o bottone ✨.
La parola chiave gira nel browser, così nessun audio lascia la macchina finché non
scatta. La spec lasciava aperti motore e nome (§12) e segnala il rischio che i
modelli open siano addestrati soprattutto in inglese (§11, rischio 3).

Il nome di lavoro «Ehi Omni» è breve: due parole corte con suoni frequenti nel
parlato italiano («e ogni», «ehi, uomini»), quindi rischio alto di falsi positivi.

Confronto in `docs/decisions/2026-09-26-proposta-voce-4b.md`, approvato da Sean il
26/09/2026.

## Decisione

Il motore è **openWakeWord** (Apache 2.0), eseguito in ONNX nel browser con
`onnxruntime-web` dentro `packages/stt`.

Il modello per l'italiano lo **addestriamo noi** con voci sintetiche italiane
(Piper TTS), secondo la procedura di openWakeWord.

Il nome è **«Ehi Omnia»**, **provvisorio**: Sean vuole passare in seguito a un nome
più amichevole. Il codice tratta nome e modello come configurazione (un file `.onnx`
e una stringa), così cambiarli significa riaddestrare e sostituire un asset, non
toccare il codice.

## Conseguenze

Positive: nessun costo di licenza né per minuto, nessun account, nessun audio fuori
dal browser prima dell'attivazione. `onnxruntime-web` è già usato dallo spike CPU.

Negative: l'addestramento è lavoro nostro, e lo ripaghiamo quando cambia il nome:
il nome provvisorio costa un secondo addestramento. La precisione su voci vere
italiane non è garantita da voci sintetiche: va misurata (falsi positivi per ora di
riunione, mancati riconoscimenti) prima della demo. Il modello aggiunge carico CPU a
un browser che già esegue MediaPipe e WebRTC. Finché la precisione non regge, ✨ e
l'indice alzato restano il modo affidabile di attivare l'agente.

## Alternative scartate

**Picovoice Porcupine.** Italiano supportato e modelli su richiesta, ma licenza
commerciale intorno ai 6.000 $/anno per 100 dispositivi: contraddice il vincolo di
investimento iniziale minimo prima di aver validato il prodotto.

**«Ehi Omni».** Troppo corto, falsi positivi probabili nel parlato italiano.

**«Ok Canvas».** Suono raro in italiano, ma lega la parola chiave a un termine
tecnico; scartato a favore di un nome vicino al prodotto.
