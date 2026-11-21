// @ts-nocheck: the 3D gate is shared plain JS (caylor-ui/three/support.js).
// Decides whether the hero gets its 3D layer. The poster (inline SVG) is already on screen; on capable
// devices the 3D chunk loads after first paint and fades in over it. Weak devices, Reduce Motion and
// no-WebGL keep the poster, which is a finished design on its own.
import { afterFirstPaint, decide3D, forcedMode, probeDevice } from '../../caylor-ui/three/support.js';

const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
if (stage) {
  const gate = decide3D(probeDevice(), forcedMode());
  stage.dataset.mode = gate.use3D ? '3d-pending' : `2d:${gate.reason}`;
  if (gate.use3D) {
    // Wait for the poster's draw-in (~1.8 s, CSS on the main thread) to finish before parsing the 3D
    // chunk and compiling shaders, so the two never compete and the draw-in never stutters.
    const drawnIn = new Promise((done) => setTimeout(done, Math.max(0, 1900 - performance.now())));
    Promise.all([afterFirstPaint(2500), drawnIn])
      .then(() => import('../three/monogramScene'))
      .then((m) => {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        stage.appendChild(canvas);
        const view = m.mount(canvas, {
          onLost: () => { view.dispose(); canvas.remove(); stage.dataset.live = 'false'; stage.dataset.mode = '2d:context-lost'; },
        });
        stage.dataset.mode = '3d';
        view.firstFrame.then(() => { stage.dataset.live = 'true'; });
        if (location.search.includes('debug3d')) (window as any).__scene3d = view;
      })
      .catch(() => { stage.dataset.mode = '2d:load-failed'; });
  }
}
