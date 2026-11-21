/**
 * The CM circuit monogram as data, drawn after the logo (assets/brand/logo-mark.png): a C with a code
 * glyph inside, an M, and circuit traces that end in round pads. One set of paths feeds the instant
 * SVG poster (HeroMonogram.astro, painted with the HTML) and the 3D scene (src/three/monogramScene.ts),
 * so the two always match. Units: a 100 x 100 box, y down.
 */
export type Pt = [number, number];
export interface Stroke { pts: Pt[]; kind: 'letter' | 'glyph' | 'trace'; pad?: boolean; arc?: { cx: number; cy: number; r: number; from: number; to: number } }

const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 40): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
  });

/** Letters first (they are the shape), then the glyph, then traces in the order they draw in. */
export const STROKES: Stroke[] = [
  // C: an open ring, gap facing the M.
  { kind: 'letter', pts: arc(31, 52, 23, 38, 322), arc: { cx: 31, cy: 52, r: 23, from: 38, to: 322 } },
  // M
  { kind: 'letter', pts: [[55, 74], [55, 30], [67, 52], [79, 30], [79, 74]] },
  // </> inside the C
  { kind: 'glyph', pts: [[25, 45], [19.5, 52], [25, 59]] },
  { kind: 'glyph', pts: [[33.5, 43.5], [28.5, 60.5]] },
  { kind: 'glyph', pts: [[37, 45], [42.5, 52], [37, 59]] },
  // Traces (from the letters out to pads)
  { kind: 'trace', pad: true, pts: [[55, 30], [55, 20], [49, 14]] },
  { kind: 'trace', pad: true, pts: [[61, 41], [61, 22]] },
  { kind: 'trace', pad: true, pts: [[73, 41], [73, 24], [78, 19]] },
  { kind: 'trace', pad: true, pts: [[79, 36], [88, 27], [88, 17]] },
  { kind: 'trace', pad: true, pts: [[79, 60], [92, 60]] },
  { kind: 'trace', pad: true, pts: [[67, 52], [67, 80], [62, 85]] },
  { kind: 'trace', pad: true, pts: [[60, 74], [60, 90]] },
  { kind: 'trace', pad: true, pts: [[74, 68], [74, 84], [80, 90]] },
  { kind: 'trace', pad: true, pts: [[15, 69], [9, 75], [9, 84]] },
  { kind: 'trace', pad: true, pts: [[12, 39], [6, 33]] },
  { kind: 'trace', pad: true, pts: [[31, 29], [31, 18], [37, 12]] },
];

/** SVG path data for a stroke. */
export function pathD(s: Stroke): string {
  return s.pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
}

/** Pad centers (the last point of each trace that ends in a pad). */
export const PADS: Pt[] = STROKES.filter((s) => s.pad).map((s) => s.pts[s.pts.length - 1]);

/** Polyline length, used to time the draw-in (CSS stroke-dasharray and the 3D draw range). */
export function lengthOf(s: Stroke): number {
  let d = 0;
  for (let i = 1; i < s.pts.length; i++) d += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
  return d;
}
