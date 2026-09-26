Microfono, parola chiave locale e streaming al vendor STT, tutto nel browser. L'audio non
passa dai nostri server: il server emette solo un token a vita breve (`./server`).
Vedi ADR-0006, ADR-0011 (Deepgram Nova-3) e ADR-0012 (openWakeWord).

Unico package che nomina Deepgram. Il VAD lato client arriva con la slice 6.
