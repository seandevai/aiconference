import type { Hand, Landmark } from '@omnicanvas/gesture';

// Mani sintetiche, dita verso l'alto (y decresce). Coordinate in unità della mano (s),
// attorno al centro indicato. Le soglie del classificatore hanno margini ampi su queste forme.
type SyntheticPose = 'open_palm' | 'index_up' | 'pinch' | 'thumb_up' | 'thumb_down' | 'fist';

export function hand(pose: SyntheticPose, center = { x: 0.5, y: 0.5 }, s = 0.2): Hand {
  const p = (dx: number, dy: number): Landmark => ({
    x: center.x + dx * s,
    y: center.y + dy * s,
    z: 0,
  });
  const mcp = {
    index: [-0.15, 0],
    middle: [-0.05, -0.03],
    ring: [0.05, 0],
    pinky: [0.15, 0.05],
  } as const;
  const extended = ([x, y]: readonly [number, number]) => [
    p(x, y),
    p(x, y - 0.25),
    p(x, y - 0.4),
    p(x, y - 0.5),
  ];
  const folded = ([x, y]: readonly [number, number]) => [
    p(x, y),
    p(x, y - 0.12),
    p(x, y - 0.02),
    p(x, y + 0.05),
  ];

  const thumbs = {
    side: [p(-0.12, 0.4), p(-0.25, 0.3), p(-0.4, 0.15), p(-0.55, 0.05)],
    folded: [p(-0.12, 0.4), p(-0.2, 0.3), p(-0.15, 0.27), p(-0.05, 0.25)],
    up: [p(-0.12, 0.4), p(-0.2, 0.1), p(-0.2, -0.15), p(-0.2, -0.4)],
    down: [p(-0.12, 0.4), p(-0.2, 0.3), p(-0.2, 0.6), p(-0.2, 0.9)],
    pinch: [p(-0.12, 0.4), p(-0.25, 0.3), p(-0.22, 0.1), p(-0.13, -0.35)],
  };

  const fingersUp = { index: true, middle: true, ring: true, pinky: true };
  const layout: Record<SyntheticPose, { thumb: keyof typeof thumbs; up: typeof fingersUp }> = {
    open_palm: { thumb: 'side', up: fingersUp },
    index_up: { thumb: 'folded', up: { index: true, middle: false, ring: false, pinky: false } },
    pinch: { thumb: 'pinch', up: fingersUp },
    thumb_up: { thumb: 'up', up: { index: false, middle: false, ring: false, pinky: false } },
    thumb_down: { thumb: 'down', up: { index: false, middle: false, ring: false, pinky: false } },
    fist: { thumb: 'folded', up: { index: false, middle: false, ring: false, pinky: false } },
  };
  const { thumb, up } = layout[pose];

  const finger = (name: keyof typeof mcp) => {
    if (pose === 'pinch' && name === 'index') {
      const [x, y] = mcp.index;
      return [p(x, y), p(x, y - 0.2), p(x, y - 0.3), p(x, y - 0.35)];
    }
    return up[name] ? extended(mcp[name]) : folded(mcp[name]);
  };

  return {
    landmarks: [
      p(0, 0.5),
      ...thumbs[thumb],
      ...finger('index'),
      ...finger('middle'),
      ...finger('ring'),
      ...finger('pinky'),
    ],
  };
}
