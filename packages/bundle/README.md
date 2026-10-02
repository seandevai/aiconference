Raccolta dei contenuti, ZIP e cifratura AES-GCM nel browser, upload del blob.
La chiave non lascia mai il frammento del link. Vedi ADR-0008.

Pronto (slice 8, parte pura, senza rete):

- `collectFiles(stage, assets)`: finestre, vassoio e archiviati diventano file. Testi in
  Markdown, grafici e tabelle in CSV, immagini dai byte in memoria. Le immagini che il
  browser non ha più (host che ha ricaricato) tornano in `missing`.
- `zipFiles(files)`: ZIP senza compressione, data fissa al 1/1/1980.
- `sealBundle(files)`: un file resta com'è, più file diventano `nod-riunione.zip`. Nome e
  tipo stanno dentro il cifrato. Blob: versione (1 byte), IV (12 byte), AES-GCM 256.
  Restituisce il blob e la chiave in base64url (43 caratteri).
- `openBundle(blob, key)`: per la pagina `/p/<id>`. Rifiuta chiave sbagliata e blob alterato.
- `bundleLink(origin, id, key)` e `keyFromFragment(location.hash)`.

Manca: migrazione `bundles` con RLS, upload firmato su R2, pagina `/p/<id>`, PDF a quota,
avviso prima della chiusura.
