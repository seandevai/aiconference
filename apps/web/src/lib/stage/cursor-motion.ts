// Inseguimento esponenziale: ogni halfLifeMs il cursore copre metà della distanza che resta.
// Ridisegnato a 60fps rende fluido un cursore che riceve punti a 10-30fps.
export function followPoint(
  current: { x: number; y: number } | null,
  target: { x: number; y: number },
  dtMs: number,
  halfLifeMs: number,
): { x: number; y: number } {
  if (!current) return { ...target };
  const k = 1 - 2 ** (-Math.max(0, dtMs) / halfLifeMs);
  return { x: current.x + (target.x - current.x) * k, y: current.y + (target.y - current.y) * k };
}
