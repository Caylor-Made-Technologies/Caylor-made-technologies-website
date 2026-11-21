// @ts-nocheck: three.js and the shared stage are plain JS here; the scene is checked in the browser suite.
/**
 * The hero in 3D: the CM monogram as lit tubes over a dark field. When it mounts, a pulse of light runs
 * out along every trace to its pad (current flowing), the letters catch a slow light sweep, and then the
 * scene rests: 0 frames until the pointer moves (desktop) and nothing at all on touch.
 * Loaded only after first paint, only on capable devices (see src/scripts/hero3d.ts).
 */
import { CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { createStage } from '../../caylor-ui/three/stage.js';
import { STROKES, PADS } from '../lib/monogram';

const S = 0.05; // 100 units -> 5 m
// Same box as the SVG poster (viewBox 0 0 100 100, centered), and a camera that frames exactly that box,
// so the crossfade from poster to 3D has no jump.
const at = (p) => new Vector3((p[0] - 50) * S, -(p[1] - 50) * S, 0);

export function mount(canvas, { onLost }) {
  const stage = createStage(canvas, { camera: [0, 0, 8.18], target: [0, 0, 0], fov: 34, onLost });
  const { scene } = stage;
  scene.environmentIntensity = 0.9;
  const root = new Group();
  scene.add(root);

  const white = new MeshStandardMaterial({ color: 0xf2f5fa, metalness: 0.55, roughness: 0.28 });
  const blue = new MeshStandardMaterial({ color: 0x3054b5, emissive: 0x3054b5, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.35 });
  const glyph = new MeshStandardMaterial({ color: 0x5b7de0, emissive: 0x3054b5, emissiveIntensity: 0.8, roughness: 0.3 });
  const pulseMat = new MeshBasicMaterial({ color: 0xbfd0ff });

  const traces = [];
  for (const s of STROKES) {
    const pts = s.pts.map(at);
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', s.arc ? 0.5 : 0.0);
    const r = s.kind === 'letter' ? 0.17 : s.kind === 'glyph' ? 0.09 : 0.055;
    const mesh = new Mesh(new TubeGeometry(curve, s.arc ? 96 : Math.max(8, pts.length * 12), r, s.kind === 'letter' ? 14 : 8, false), s.kind === 'letter' ? white : s.kind === 'glyph' ? glyph : blue);
    root.add(mesh);
    if (s.kind === 'trace') {
      const dot = new Mesh(new SphereGeometry(0.09, 10, 8), pulseMat);
      dot.visible = false;
      root.add(dot);
      traces.push({ curve, dot });
    }
  }
  for (const p of PADS) {
    const pad = new Mesh(new CylinderGeometry(0.16, 0.16, 0.08, 20), blue);
    pad.rotation.x = Math.PI / 2;
    pad.position.copy(at(p));
    root.add(pad);
  }
  // A moving light that sweeps across the letters once.
  const sweep = new PointLight(0x9fb6ff, 0, 9, 1.6);
  sweep.position.set(-4, 1.5, 2.5);
  scene.add(sweep);

  // Intro: pulses run out along the traces (staggered), the sweep crosses, then rest.
  let t = 0;
  root.rotation.set(-0.12, 0.28, 0);
  stage.animate((dt) => {
    t += dt;
    const k = Math.min(1, t / 2.6);
    root.rotation.y = 0.28 * (1 - easeOut(k));
    root.rotation.x = -0.12 * (1 - easeOut(k));
    traces.forEach((tr, i) => {
      const u = (t - 0.15 - i * 0.08) / 0.9;
      tr.dot.visible = u > 0 && u < 1;
      if (tr.dot.visible) tr.dot.position.copy(tr.curve.getPointAt(Math.min(1, u)));
    });
    sweep.intensity = 14 * Math.sin(Math.PI * k);
    sweep.position.x = -4 + 8 * k;
    return t < 2.8;
  });

  // Desktop: a gentle tilt toward the pointer (draws only while it settles).
  const fine = matchMedia('(pointer: fine)').matches;
  let target = [0, 0];
  let settling = false;
  const onMove = (e) => {
    target = [((e.clientY / innerHeight) - 0.5) * -0.16, ((e.clientX / innerWidth) - 0.5) * 0.28];
    if (settling || t < 2.8) return;
    settling = true;
    stage.animate(() => {
      root.rotation.x += (target[0] - root.rotation.x) * 0.08;
      root.rotation.y += (target[1] - root.rotation.y) * 0.08;
      const still = Math.abs(target[0] - root.rotation.x) < 0.001 && Math.abs(target[1] - root.rotation.y) < 0.001;
      settling = !still;
      return !still;
    });
  };
  if (fine) addEventListener('pointermove', onMove, { passive: true });

  return {
    dispose() { removeEventListener('pointermove', onMove); stage.dispose(); },
    frames: stage.frames, stats: stage.stats, workStats: stage.workStats,
  };
}

function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
