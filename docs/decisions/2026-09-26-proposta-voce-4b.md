# Proposta — le tre decisioni per la voce dell'agente (slice 4B)

**Stato:** approvata da Sean il 26/09/2026, diventata ADR-0011, ADR-0012 (nome provvisorio) e ADR-0013. Chiude le righe «vendor STT», «parola chiave»
e «provider immagini» della spec §12. Approvata, ogni scelta diventa un ADR.
**Prezzi:** verificati a settembre 2026 da fonti pubbliche (link in fondo); da ricontrollare
sulle pagine ufficiali prima di firmare.

Criteri della spec: qualità dell'italiano, prezzo reale, zero retention per contratto,
chiamata dal browser con token a vita breve (ADR-0006), investimento iniziale minimo.

## 1. Trascrizione (STT)

| | Deepgram Nova-3 | AssemblyAI streaming | Speechmatics |
|---|---|---|---|
| Italiano in streaming | sì (anche multilingue) | da verificare in streaming | sì, forte |
| Prezzo streaming | ~0,0077 $/min (monolingue), ~0,0092 $/min multilingue | simile | più alto |
| Token temporanei per il browser | sì | sì | sì |
| Già nel contratto env | `DEEPGRAM_API_KEY` | no | no |

**Raccomandazione: Deepgram Nova-3, modello monolingue per lingua del partecipante.**
Costo indicativo: un'ora di sottotitoli con 2 persone ≈ 2 × 60 × 0,0077 ≈ 0,92 $; una
richiesta all'agente (≈10 s di audio) ≈ 0,0013 $. Da fare prima dell'uso con clienti:
DPA con zero retention per iscritto (BACKLOG, «Debito e rischi»).

## 2. Parola chiave

| | openWakeWord | Picovoice Porcupine |
|---|---|---|
| Licenza e costo | open source (Apache 2.0), gratis | commerciale, ~6.000 $/anno per 100 dispositivi |
| Italiano | modello da addestrare noi con voci sintetiche italiane (Piper TTS) | supportato, modelli su richiesta |
| Nel browser | ONNX (onnxruntime-web, già usato dallo spike) | WASM |

**Raccomandazione: openWakeWord con un modello addestrato da noi.** Porcupine contraddice il
vincolo di investimento minimo. Rischio noto (spec §11, rischio 3): la precisione si
misura; ✨ e l'indice alzato restano sempre disponibili.

**Nome:** servono 3-4 sillabe e suoni poco comuni nel parlato di una riunione.
«Ehi Omni» è breve e rischia falsi positivi («e ogni», «ehi, uomini»). Proposte, in ordine:
1. «Ehi Omnia» · 2. «Ok Canvas» · 3. «Ehi Omni» (da tenere solo se i test di falsi positivi reggono).

## 3. Immagini

| | fal.ai FLUX schnell | OpenAI immagini |
|---|---|---|
| Prezzo | ~0,003–0,025 $/immagine | più alto |
| Latenza | 1-3 s | più lenta |
| Già nel contratto env | `FAL_KEY` | `OPENAI_API_KEY` |

**Raccomandazione: fal.ai FLUX schnell**, dietro conferma esplicita (spec §2.3), con
`OPENAI_API_KEY` tolta dal contratto env se non serve altrove.

## Cosa serve da Sean

- Un sì (o un'alternativa) per ciascuna delle tre righe.
- Account e chiavi: Deepgram, fal.ai. Per openWakeWord non serve un account.
- Il nome scelto per la parola chiave.

## Fonti

- Deepgram Nova-3: https://deepgram.com/learn/introducing-nova-3-speech-to-text-api ·
  https://convertaudiototext.com/blog/deepgram-nova-3-explained ·
  https://diyai.io/ai-tools/speech-to-text/deepgram-pricing-2026/
- Porcupine: https://picovoice.ai/products/voice/wake-word/ ·
  https://checkthat.ai/brands/picovoice/pricing ·
  https://picovoice.ai/docs/quick-start/porcupine-web/
- FLUX su fal.ai: https://costgoat.com/pricing/flux ·
  https://www.teamday.ai/blog/ai-api-pricing-comparison-2026
