# CLAUDE.md

Caylor Made Technologies business website (Jonathon's own storefront and portfolio). See README.md for how the site works.

## Project memory (Obsidian vault)
The full history, decisions, and next steps for this project live in the
`Caylor-Made-Technologies/obsidian-vault` repo at `Projects/Caylor Made Technologies Website.md`.

- **At the start of a session**, if the task involves a decision or you need background,
  attach `Caylor-Made-Technologies/obsidian-vault` and read `Projects/Caylor Made Technologies Website.md`
  and the vault's `CLAUDE.md`.
- **Before the session ends**, whenever anything changed, attach the vault repo and update
  `Projects/Caylor Made Technologies Website.md`:
  - a dated line under **Log** saying what changed
  - any new decision and its reason under **Decisions**
  - updated **Status** and **Next steps**
  Commit and push that to the vault's `main` branch.
- Never copy keys, passwords, or customer personal info into the vault.

## Working here
- Astro (static) + plain CSS. Prices live only in `src/data/pricing.json`, portfolio in `src/data/projects.json`, contact details in `src/data/site.json`.
- The only server code is `functions/api/contact.ts` (Cloudflare Pages Function). Secrets only in Cloudflare environment variables.
- Keep the CSP strict: no inline scripts or `style=""` attributes (`public/_headers`).
- Run `npm run build` and `npm audit` before pushing. Pin exact dependency versions.
- Jonathon is usually on his phone: keep explanations short.
- No Claude or Anthropic naming anywhere: no "Co-Authored-By: Claude" or session links in commits or PRs, no `claude/` branch names, no "Generated with Claude" text, no mentions in site files. This file is not published (Astro only publishes `public/` and `src/pages/`).
