# Launch checklist report

Tested 2026-10-21 on a local Cloudflare Pages preview (`wrangler pages dev`), mobile settings unless noted.

## Lighthouse (mobile)

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Home | 99 | 100 | 100 | 100 |
| Services & Pricing | 100 | 100 | 100 | 100 |
| Work | 99 | 100 | 100 | 100 |
| About | 100 | 100 | 100 | 100 |
| Contact | 100 | 100 | 96* | 100 |
| Privacy | 100 | 100 | 100 | 100 |

Layout shift (CLS) 0 on every page. LCP 1.7–2.1 s on Lighthouse's slow-4G mobile setting.
\*The test sandbox blocks Cloudflare, so the Turnstile script failed to load and logged a console error. Re-check on the live site; expected 100.

## Accessibility
- [x] axe scan (WCAG 2.1 A/AA + best practices): **0 violations** on all 7 pages, at phone and desktop widths
- [x] One `h1` per page, headings in order, every image has alt text
- [x] Skip link is the first Tab stop; visible focus ring everywhere
- [x] Mobile menu works by keyboard (opens, Escape closes); built on the native popover, no JavaScript
- [x] Color contrast: body, muted, link, and button text all pass AA on the dark backgrounds (primary button uses a slightly deeper blue `#1B63EB` so white text passes)
- [x] `prefers-reduced-motion`: no running animations
- [x] No horizontal scroll at 390 px (phone), 768 px (tablet), 1366 px (desktop)

## Security headers (verified in the local Cloudflare preview)
- [x] Content-Security-Policy: `default-src 'self'`, scripts only from self + `challenges.cloudflare.com`, no `unsafe-inline`, `frame-ancestors 'none'`, `object-src 'none'`
- [x] Strict-Transport-Security: `max-age=63072000; includeSubDomains` (add `preload` after a month live; see README)
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Permissions-Policy: camera, mic, geolocation, payment, USB, etc. disabled
- [x] Cross-Origin-Opener-Policy: same-origin
- [x] No inline scripts or style attributes in any built page
- [x] External links use `rel="noopener noreferrer"`
- [x] `npm audit`: 0 vulnerabilities; 3 runtime dependencies, pinned exactly
- [x] `.env` / `.dev.vars` git-ignored; `.env.example` has names only
- [ ] After deploy: re-check headers on the live URL (securityheaders.com)

## Contact form
Automated (`npm test`, 10 tests) and in a real browser against the local Cloudflare runtime:
- [x] Success: valid message passes Turnstile and sends a plain-text email with Reply-To set to the visitor (unit test with faked Turnstile/Resend)
- [x] Success screen shows and gets focus (browser)
- [x] Validation errors: shown next to each field, first bad field focused, `aria-invalid` set (browser); server rejects bad fields on its own (browser + unit)
- [x] HTML and email-header injection stripped (unit)
- [x] Spam blocked: invalid Turnstile token → 403 (browser + unit); missing token → 403 (unit)
- [x] Honeypot filled → fake success, nothing sent (browser + unit)
- [x] Rate limit: 6th message from one IP within an hour → 429; only a hash of the IP is stored (browser + unit)
- [x] Cross-site posts refused (browser + unit); oversized / non-JSON bodies refused (unit)
- [x] Missing server keys → safe error message, no details leaked (unit)
- [ ] **After deploy: send a real test message** (the sandbox can't reach Cloudflare or Resend)

## SEO
- [x] Unique title + meta description on every page
- [x] Canonical URLs, `sitemap-index.xml`, `robots.txt` with sitemap link
- [x] Open Graph + Twitter card with `og-image.jpg` (1200×630, from the banner)
- [x] `ProfessionalService` / `LocalBusiness` JSON-LD with Hereford, TX, ZIP, geo, and service area
- [x] Favicon (.ico + PNG), Apple touch icon, web manifest from the CM mark
- [x] 404 page returns HTTP 404 and is `noindex`

## TODO: things only you can do
- [ ] **Domain:** buy it, then follow "Connect your domain" in the README (update `url` in `site.json`).
- [ ] **Cloudflare + Resend accounts:** set up and add keys (README → "Deploy to Cloudflare Pages").
- [x] Photo on the About page (added 2026-10-21)
- [ ] **Read the About text** and make it sound like you.
- [ ] **Confirm with your cousin** that Astro Jumpers can be shown as a portfolio piece.
- [ ] **Higher-resolution logo files** if you can get them (current ones are cropped from phone screenshots).
- [ ] **Privacy Policy:** template until a Texas attorney reviews it.
- [ ] Set `"spotsLeft"` in `pricing.json` as clients sign on.
- [ ] Optional: Google Business Profile for Caylor Made Technologies, pointing at the new site.
