# Caylor Made Technologies website

The official site for Caylor Made Technologies: websites and custom software for small and local businesses in Hereford, TX and the Texas Panhandle.

- **Stack:** [Astro](https://astro.build) (static pages) + plain CSS. The only server code is the contact form function.
- **Hosting:** Cloudflare Pages (static files + one Pages Function).
- **Contact form:** Cloudflare Turnstile spam check + hidden honeypot + 5-per-hour rate limit per IP, validated on the server, emailed through [Resend](https://resend.com).

---

## Run it on your computer

Needs Node.js 22.18 or newer.

```bash
npm install
npm run dev        # http://localhost:4321  (pages only; the form needs the Cloudflare preview below)
npm run build      # builds the site into dist/
npm test           # contact form tests (no keys or internet needed)
npm run check      # type check
```

To test the contact form for real on your computer, use Cloudflare's tool:

```bash
cp .env.example .dev.vars          # then fill in the values
npx wrangler pages dev dist --kv RATE_LIMIT
```

## Change prices, projects, or contact info

Everything you'll want to edit is in `src/data/`. Change it, commit, and Cloudflare rebuilds the site.

| What | File |
|---|---|
| Prices, plan features, payment terms, FAQ | `src/data/pricing.json` |
| Portfolio projects | `src/data/projects.json` |
| Email, phone, city, service area, site URL | `src/data/site.json` |

- **Spots left:** set `"spotsLeft": 3` in `pricing.json` to show "Launch Pricing: First 5 Clients Only · 3 left" on the pricing page. `null` hides it.
- **New project:** add an entry to `projects.json` and put its screenshot in `src/assets/projects/` (same file name as `"image"`). No screenshot yet? Leave the file out and a "Screenshot coming soon" placeholder shows. `"featured": true` puts it on the home page (first two).
- **Logo changed?** Replace the files in `assets/brand/` and run `npm run brand`. That regenerates the transparent logos, favicons, app icons, and the social share image.

## Environment variables

Never commit real values. `.env`, `.env.*`, and `.dev.vars` are already in `.gitignore`.

| Name | Where it's used | What it is |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | Build (public) | Turnstile **site key**. Safe to be public. |
| `TURNSTILE_SECRET_KEY` | Function (secret) | Turnstile **secret key** |
| `RESEND_API_KEY` | Function (secret) | Resend API key (Sending access only) |
| `CONTACT_TO_EMAIL` | Function | Where messages go, e.g. `jonathoncaylor2@gmail.com` |
| `CONTACT_FROM_EMAIL` | Function | Sender, e.g. `Caylor Made Website <hello@yourdomain.com>` |
| `RATE_LIMIT` | Function (KV binding) | KV namespace used for the per-IP limit |

Until `PUBLIC_TURNSTILE_SITE_KEY` is set, the build uses Cloudflare's test key. With a real secret key on the server, test tokens are rejected, so the form fails closed instead of letting spam through.

## Deploy to Cloudflare Pages

1. **Cloudflare account:** sign up free at dash.cloudflare.com.
2. **Create the project:** Workers & Pages → Create → Pages → *Connect to Git* → pick `Caylor-Made-Technologies/Caylor-made-technologies-website`.
   - Production branch: `main`
   - Framework preset: Astro
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Name the project `caylor-made-technologies` so the free address is `caylor-made-technologies.pages.dev` (it matches `url` in `site.json`).
3. **Turnstile:** Cloudflare dashboard → Turnstile → Add widget. Hostnames: `caylor-made-technologies.pages.dev` (add your domain later). Mode: Managed. Copy the site key and secret key.
4. **Rate-limit storage:** Workers & Pages → KV → Create namespace `contact-rate-limit`. Then Pages project → Settings → Bindings → Add → KV namespace, variable name `RATE_LIMIT`.
5. **Resend:** sign up at resend.com → API Keys → create a key with *Sending access*. Until you have a domain, use `onboarding@resend.dev` as `CONTACT_FROM_EMAIL`. It can only send to the email you signed up to Resend with, so sign up with the address that should receive messages.
6. **Variables:** Pages project → Settings → Variables and Secrets. Add every variable in the table above for **Production** (mark the keys as *Secret*).
7. **Deploy:** Deployments → Retry deployment (variables apply on the next build). After that, every push to `main` deploys automatically.
8. **Test it live:** send yourself a message from `/contact/`, then check the security headers at securityheaders.com.

## Connect your domain

1. Buy the domain (Cloudflare Registrar sells at cost, and DNS is set up for you).
2. Pages project → Custom domains → Set up a domain → enter it (add both `yourdomain.com` and `www`).
3. Update `"url"` in `src/data/site.json` to `https://yourdomain.com` (canonical links, sitemap, and social cards use it).
4. Add the domain to the Turnstile widget's hostnames.
5. In Resend → Domains, add the domain and the DNS records it gives you. Then change `CONTACT_FROM_EMAIL` to `Caylor Made Website <hello@yourdomain.com>`.
6. In `public/_headers`, uncomment the block at the bottom so the `.pages.dev` copy stays out of Google.
7. Optional, later: once everything has worked over HTTPS for a month, add `; preload` to `Strict-Transport-Security` in `public/_headers` and submit at hstspreload.org. This is hard to undo: every subdomain must support HTTPS forever.

## Security notes

- Static site. The only server code is `functions/api/contact.ts`.
- Strict Content-Security-Policy in `public/_headers`: no inline scripts or styles; only Cloudflare Turnstile is allowed as a third party. Keep it that way: no `style="…"` attributes, no inline `<script>`.
- Fonts are self-hosted (`public/fonts/`, SIL Open Font License). No trackers, no analytics, no cookies.
- The contact function checks, in order: same-site origin → size limit (16 KB) → JSON → honeypot → rate limit (5/hour/IP, stores only a hash of the IP, expires after 1 hour) → field validation → Turnstile (server-side) → sends a **plain-text** email with Resend.
- Dependencies are pinned to exact versions. Run `npm audit` before updating.
- The Privacy Policy is a template until reviewed by a Texas attorney.

## Project layout

```
assets/brand/           original brand images (source for npm run brand)
functions/api/contact.ts  contact form handler (Cloudflare Pages Function)
public/                 _headers, fonts, favicons, social image
src/assets/             logos and screenshots (optimized to WebP at build)
src/components/         header, footer, cards, circuit background
src/data/               pricing, projects, site info  ← edit these
src/lib/contact-rules.ts  form rules shared by browser and server
src/pages/              one file per page
src/styles/global.css   colors, type, buttons, cards
tests/                  contact function tests
tools/make-brand.mjs    builds logos/favicons from assets/brand
```
