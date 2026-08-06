# Emanuel Rendas — Private Real Estate Advisory

Static site deployed on Vercel. No build step, no framework, no dependencies —
plain HTML, CSS and JavaScript, served as-is.

## Structure

```
index.html          /              Hero, credentials, explore grid, philosophy, CTA
about.html          /about         The advisor, background, trust, testimonials, speaking
advisory.html       /advisory      Who I advise, method, the case against, developer partners
intelligence.html   /intelligence  Market case, verified figures, live DLD panel
addresses.html      /addresses     Tracked communities + interactive intelligence map
instruments.html    /instruments   Investment Lab, quick yield, Golden Visa, FX, STR arbitrage
contact.html        /contact       Private brief form, FAQ, market brief

assets/
  site.css      Whole stylesheet. The original single-page rules are kept
                verbatim; everything from the "MULTI-PAGE REFACTOR" banner
                down is the split-architecture layer.
  site.js       Shared chrome: preloader, cursor, dust canvas, nav, reveals,
                FAQ, provenance tooltips, brief form. Every module guards its
                own root element.
  calc.js       Calculators — /instruments only
  map.js        Intelligence map — /addresses only
  dld.js        Live DLD panel — /intelligence only
  emanuel.jpg   Portrait (was a 138KB base64 blob inside the HTML)

api/
  dld.js        Dubai Pulse proxy — see README_DLD.md
  fx.js         ECB reference rates

vercel.json     cleanUrls (so /about resolves to about.html), asset caching,
                security headers
sitemap.xml     All seven routes
```

## Conventions

**Routing is real.** Each route is its own document with its own `<title>`,
meta description, canonical URL, Open Graph tags and JSON-LD. Navigation is
native — the browser owns history and the back button. Cross-page transitions
come from the View Transitions API (`@view-transition` in `site.css`), and
internal links are prefetched on hover, focus or touch-start. Browsers without
View Transitions simply navigate normally.

**One `<h1>` per page.** Section headings are `<h2>`; the leading heading on
each split page is promoted to `<h1>`.

**Anchors clear the sticky nav** via `scroll-padding-top` / `scroll-margin-top`
in CSS, not a hardcoded pixel offset in JavaScript.

**The site is English.** It previously advertised `og:locale:alternate` for
pt_PT and es_ES without any translated pages existing; those tags are gone.
"EN · PT · ES" refers to the languages Emanuel speaks with clients, not to
site translations.

**Nothing is stored.** The brief form opens WhatsApp on the visitor's own
device. If the pop-up is blocked or WhatsApp is unavailable, a fallback panel
offers the same brief as a `mailto:` and as copyable text, so the lead is not
lost silently.

## Editing content

Content lives directly in the page files. Two places carry inline notes for
future updates:

- `about.html` — the testimonial blocks are placeholders; replace them with
  real quotes only with written permission.
- `advisory.html` — the credential cards are structural facts, not invented
  statistics. Replace with verified figures when you have them.

Social profile URLs are in `assets/site.js` under `SOCIAL`. Leave a value
empty and that icon does not render.

## Local preview

Any static server works, but plain `python3 -m http.server` will not resolve
the clean URLs (`/about` rather than `/about.html`). Either open the `.html`
files directly, or run a server that falls back to `<path>.html`.
