# Registrazioni di gesture

Ogni file JSON qui dentro è un test: il riconoscitore deve produrre l'evento `expect`.
Si registrano da `/dev/gesture-recorder` (solo `npm run dev`), con la propria webcam.
Nome del file: `<evento>-<descrizione>.json`, es. `FOCUS_NEXT-swipe-veloce.json`.
Contengono solo landmark (numeri), mai immagini.
Si registrano anche dal laboratorio («Scarica JSON»). Le gesture nuove (`expect: null`) non sono test: il test le salta.

Si possono rigiocare con le impostazioni correnti da /dev/gesture-lab.
