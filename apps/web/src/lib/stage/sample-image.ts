'use client';

// Immagine di prova disegnata nel browser: prova il percorso peer to peer senza agente.
export async function sampleImage(): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 270;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2d canvas not available');
  const gradient = context.createLinearGradient(0, 0, 480, 270);
  gradient.addColorStop(0, '#0f766e');
  gradient.addColorStop(1, '#1e3a8a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 480, 270);
  context.fillStyle = '#ffffff';
  context.font = 'bold 32px sans-serif';
  context.fillText('Schema di prova', 32, 140);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png'),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
