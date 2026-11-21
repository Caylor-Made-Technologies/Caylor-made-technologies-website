// Browser checks for the site (built dist/ served locally): every page loads with zero console errors,
// axe clean, no sideways scroll at 320 px; the hero 3D mounts, stays in budget and goes idle; the poster
// is used under Reduce Motion; every app card launches to its real live URL. Saves screenshots and,
// with RECORD=1, scroll-through videos (desktop and 390x844) in docs/recordings/.
// Run: npm run build && node tests/e2e/site.cjs
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../../dist');
const OUT = path.join(__dirname, '../../docs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.jpg': 'image/jpeg' };
// Send the production Content-Security-Policy from public/_headers, so the checks run under it.
const CSP = fs.readFileSync(path.join(__dirname, '../../public/_headers'), 'utf8').match(/Content-Security-Policy: (.+)/)[1].replace(/ upgrade-insecure-requests/, '');
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', CSP);
  let p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const apps = require('../../src/data/apps.json');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failed++; };
const PAGES = ['/', '/work/', '/services/', '/about/', '/contact/', '/privacy/', '/car-doctor/', '/money-leak-finder/', '/controls-academy/', '/critical-facilities-sim/', '/404.html'];

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const watch = (page) => {
    // The contact page's Turnstile script is aborted below (third party, offline test); its load error is expected.
    page.on('console', (m) => m.type() === 'error' && !(/\/contact\//.test(page.url()) && /ERR_FAILED/.test(m.text())) && errors.push(page.url() + ' ' + m.text()));
    page.on('pageerror', (e) => errors.push(page.url() + ' ' + String(e)));
    // Third-party (Turnstile on /contact/) is blocked here: offline test, and its script is not ours.
    page.route(/challenges\.cloudflare\.com/, (r) => r.abort());
  };
  const axe = async (page, name) => {
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => `${v.id} x${v.nodes.length} ${v.nodes[0].target}`));
    check(r.length === 0, `axe ${name}: ${r.join(', ') || 'clean'}`);
  };

  // 0. Under the real CSP (no bypass): the 3D hero loads and nothing is blocked.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const csp = [];
    page.on('console', (m) => /Content Security Policy|Refused/i.test(m.text()) && csp.push(m.text()));
    await page.goto(base + '/?3d=1&debug3d', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__scene3d, null, { timeout: 20000 }).catch(() => {});
    check(await page.evaluate(() => !!window.__scene3d), 'hero 3D loads under the production CSP');
    check(csp.length === 0, `no CSP violations: ${csp.slice(0, 2).join(' | ') || 'none'}`);
    await ctx.close();
  }

  // 1. Home, phone, 3D forced on.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, bypassCSP: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + '/?3d=1&debug3d', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__scene3d, null, { timeout: 20000 });
  for (let i = 0, prev = -1; i < 40; i++) { const f = await page.evaluate(() => window.__scene3d.frames()); if (f === prev) break; prev = f; await page.waitForTimeout(400); }
  await page.screenshot({ path: `${OUT}/screenshots/after-home-390.png` });
  const st = await page.evaluate(() => window.__scene3d.stats());
  check(st.calls < 100 && st.triangles < 100000, `hero 3D budget: ${st.calls} draw calls, ${st.triangles} triangles`);
  const f0 = await page.evaluate(() => window.__scene3d.frames());
  await page.waitForTimeout(1500);
  check((await page.evaluate(() => window.__scene3d.frames())) === f0, 'hero idle: 0 frames on touch');
  const ctas = await page.locator('main .btn--primary').count();
  check(ctas === 2, `one CTA in the hero, one in Contact (${ctas})`);
  // Launch links are the real live URLs from apps.json (never invented).
  const launches = await page.locator('.app__launch').evaluateAll((as) => as.map((a) => a.href));
  check(JSON.stringify(launches) === JSON.stringify(apps.filter((a) => a.url).map((a) => a.url)), `${launches.length} Launch links match apps.json`);
  await page.locator('#apps').scrollIntoViewIfNeeded();
  for (let y = 0; y < 8000; y += 600) { await page.mouse.wheel(0, 600); await page.waitForTimeout(80); }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/screenshots/after-home-390-full.png`, fullPage: true });
  await axe(page, 'home (phone)');
  await ctx.close();

  // 2. Desktop.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + '/?3d=1&debug3d', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__scene3d, null, { timeout: 20000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/screenshots/after-home-1440.png` });
    await page.mouse.move(1100, 300);
    await page.waitForTimeout(150);
    const f1 = await page.evaluate(() => window.__scene3d.frames());
    await page.mouse.move(1000, 500);
    await page.waitForTimeout(400);
    check((await page.evaluate(() => window.__scene3d.frames())) > f1, 'desktop: pointer tilt redraws');
    await page.locator('#apps').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/screenshots/after-apps-1440.png` });
    await axe(page, 'home (desktop)');
    await ctx.close();
  }

  // 3. Reduce Motion: the poster only, no canvas.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true, bypassCSP: true });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const mode = await page.evaluate(() => document.querySelector('[data-hero-stage]').dataset.mode);
    check(/^2d:/.test(mode) && !(await page.$('[data-hero-stage] canvas')), `reduced motion -> poster (${mode})`);
    await page.screenshot({ path: `${OUT}/screenshots/after-home-390-poster.png` });
    // Every page: loads, no sideways scroll at 320 px, axe clean.
    await page.setViewportSize({ width: 320, height: 640 });
    for (const p of PAGES) {
      await page.goto(base + p, { waitUntil: 'networkidle' });
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(w <= 320, `320 px ${p}: width ${w}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of PAGES.slice(1)) { await page.goto(base + p, { waitUntil: 'networkidle' }); await axe(page, p); }
    await ctx.close();
  }

  // 4. Scroll-through recordings.
  if (process.env.RECORD) {
    for (const [w, h, name, mobile] of [[1440, 900, 'desktop', false], [390, 844, 'phone-390x844', true]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: `${OUT}/recordings/tmp`, size: { width: w, height: h } } });
      const page = await ctx.newPage();
      await page.goto(base + '/?3d=1', { waitUntil: 'networkidle' });
      await page.waitForTimeout(4000);
      const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= total; y += Math.round(h / 3)) { await page.evaluate((y) => scrollTo({ top: y, behavior: 'smooth' }), y); await page.waitForTimeout(650); }
      await page.waitForTimeout(1000);
      const vid = page.video();
      await ctx.close();
      fs.renameSync(await vid.path(), `${OUT}/recordings/home-${name}.webm`);
    }
    fs.rmSync(`${OUT}/recordings/tmp`, { recursive: true, force: true });
  }

  check(errors.length === 0, `console errors: ${errors.length ? errors.slice(0, 5).join(' | ') : 'none'}`);
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll site checks passed');
  process.exit(failed ? 1 : 0);
})();
