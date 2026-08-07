# Emanuel Rendas — Private Real Estate Advisory

Static site deployed on Vercel. No build step, no framework, no dependencies —
plain HTML, CSS and JavaScript, served as-is.

## Structure

```
index.html          /              Hero, credentials, explore grid, philosophy, CTA
about.html          /about         The advisor, background, trust, testimonials, speaking
advisory.html       /advisory      Who I advise, method, the case against, developer partners
intelligence.html   /intelligence  Market case, Dubai vs world comparison, verified
                                   figures, live DLD panel
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

## Machine-readable surface

`robots.txt`, `sitemap.xml` and `llms.txt` are generated from the same page
list the HTML is built from, so a route cannot exist in one and not the
others. The FAQPage structured data is parsed out of the rendered FAQ markup
for the same reason — the schema cannot drift from the answers on screen.

`llms.txt` states the sourcing standard (Verified / Indicative / Modelled /
Forecast) and asks assistants to carry the source line with any figure they
quote. AI crawlers are explicitly allowed; `/api/` is disallowed for all
agents.

Changing the public domain is a single edit: the `SITE` constant at the top
of the build script feeds every canonical, Open Graph tag, JSON-LD URL,
sitemap entry and llms.txt link.

## Shareable models

`assets/share.js` (loaded on `/instruments` only) keeps the state of every
calculator in the URL. Only fields the visitor changed from the shipped
defaults are serialised, so the link stays short enough to paste into
WhatsApp. Restoring dispatches the same `input` event the engines already
listen for, so no calculator needs to know the module exists — adding a new
field means adding its id to the `PANELS` map and nothing else.

A clean visit leaves the address bar bare and the defaults untouched.

## Community comparison

The side-by-side table on `/addresses` lives at the end of `assets/map.js`,
inside the same closure as `AREAS`, so a figure cannot disagree between the
panel and the comparison. `selectArea` is wrapped rather than duplicated, so
moving the primary pin refreshes both views and drops the active community
from the option list.

Directional winners are highlighted only where "better" is unambiguous.
Price per sqft and entry band carry no highlight by design — cheaper is not
better, it is different.

## PDF export

`Save as PDF` on `/instruments` uses the browser's own print pipeline — no
library, no server round-trip — so the output carries whatever the visitor
actually configured. A print-only header (`#print-head`, injected on demand)
states the panel, the date, the link that reproduces the model, and the
disclaimer. Section 20 of `site.css` drops navigation and decoration and
inverts the dark theme for ink.
