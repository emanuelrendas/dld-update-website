/* ═══════════════════ CANONICAL METRIC RENDERER ═══════════════════
   Fills every <span data-metric="…"> on the page from /api/metrics.

   The contract this file enforces, and the reason it exists:

     A market figure is never written into the HTML. The markup carries a
     slot and a format; the value, its period, its authority and its
     classification all arrive together from the canonical layer. A slot
     with no data renders an explicit unavailable state — it does not fall
     back to a number, because there is no number in the page to fall back
     to.

   That is what makes finding M from the architecture audit impossible to
   reintroduce: there is nothing stale to silently show.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const slots = document.querySelectorAll('[data-metric]');
  if (!slots.length) return;

  /* ── formatting ── */
  const fmt = {
    aedB:   v => 'AED ' + (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B',
    aedBn:  v => 'AED ' + Math.round(v / 1e9) + 'B',
    aed:    v => 'AED ' + Math.round(v).toLocaleString('en-US'),
    count:  v => Math.round(v).toLocaleString('en-US'),
    pct:    v => (v > 0 ? '+' : '') + v.toFixed(1) + '%',
    pct0:   v => (v > 0 ? '+' : '') + Math.round(v) + '%',
    num:    v => String(v),
    index:  v => v.toFixed(2),
  };

  /* ── how each status presents ──
     Never a placeholder digit. The absence is the message. */
  const EMPTY = {
    UNAVAILABLE: 'Official data unavailable',
    INCOMPLETE:  'Period incomplete — figure withheld',
    STALE:       null,   // value still shown, but marked; see below
  };

  const CLS = {
    'OFFICIAL · PRIMARY':   'cls-p',
    'OFFICIAL · AUTHORITY': 'cls-a',
    'THIRD-PARTY':          'cls-t',
    'MODELLED':             'cls-m',
    'USER INPUT':           'cls-u',
  };

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function periodLabel(p) {
    if (!p) return '—';
    if (p.type === 'static') return p.id;
    return p.id;
  }

  /* ── render one slot ── */
  function paint(el, m) {
    const format = fmt[el.dataset.format] || fmt.num;

    if (!m || m.value === null || m.value === undefined ||
        m.status === 'UNAVAILABLE' || m.status === 'INCOMPLETE') {
      el.innerHTML = '<span class="na">' +
        esc((m && EMPTY[m.status]) || EMPTY.UNAVAILABLE) + '</span>';
      el.removeAttribute('data-src');
      el.classList.remove('src');
      if (m && m.period) el.setAttribute('title', 'Last verified period: ' + periodLabel(m.period));
      return;
    }

    el.textContent = format(m.value);

    /* A slot inside running prose takes the value but not the tooltip —
       the headline figure above it already carries the provenance, and
       underlining every number in a sentence is noise, not transparency. */
    if (el.hasAttribute('data-plain')) {
      if (m.status === 'STALE') el.classList.add('is-stale');
      return;
    }

    /* provenance travels with the value, not with the markup */
    el.classList.add('src');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-src', m.source + (m.authority && !m.source.includes(m.authority)
      ? ' — ' + m.authority : ''));
    el.setAttribute('data-period', periodLabel(m.period));
    el.setAttribute('data-verified', m.verifiedAt +
      (m.status === 'STALE' ? ' · superseded' : ''));
    el.setAttribute('data-conf', m.status === 'STALE'
      ? m.classification + ' · STALE'
      : m.classification);

    if (m.status === 'STALE') el.classList.add('is-stale');
    if (m.status === 'LIVE')  el.classList.add('is-live');
  }

  /* ── badges declared beside a slot ── */
  function paintBadges(map) {
    document.querySelectorAll('[data-metric-badge]').forEach(el => {
      const m = map[el.dataset.metricBadge];
      if (!m) { el.textContent = ''; return; }
      el.className = 'cls ' + (CLS[m.classification] || 'cls-m');
      el.textContent = m.status === 'LIVE' ? 'Live · ' + m.classification
                     : m.status === 'STALE' ? m.classification + ' · superseded'
                     : m.classification;
    });
  }

  /* ── source bars declared beside a block ── */
  function paintBars(map) {
    document.querySelectorAll('[data-metric-source]').forEach(el => {
      const m = map[el.dataset.metricSource];
      if (!m) return;
      const rows = [
        ['Source', m.source],
        ['Authority', m.authority],
        ['Period', periodLabel(m.period)],
        ['Published', m.published || 'not stated'],
        ['Last verified', m.verifiedAt],
        ['Classification', m.classification + (m.status === 'STALE' ? ' · superseded' : '')],
      ];
      if (m.methodology) rows.push(['Methodology', m.methodology]);
      el.className = 'srcbar';
      el.innerHTML = rows.map(([k, v]) =>
        `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    });
  }

  /* ── the live indicator ──
     Lights only on a successful current fetch that reported LIVE. Nothing
     else may turn it on: not a cached page, not a stale snapshot. */
  function paintLive(payload) {
    document.querySelectorAll('[data-live-indicator]').forEach(el => {
      const on = payload && payload.live === true;
      el.classList.toggle('on', on);
      el.setAttribute('title', on
        ? 'Live connection to the Dubai Land Department register'
        : 'No live connection — published figures shown with their verification date');
    });
  }

  function unavailableAll(reason) {
    slots.forEach(el => {
      el.innerHTML = '<span class="na">' + esc(reason) + '</span>';
      el.classList.remove('src');
    });
    document.querySelectorAll('[data-metric-badge]').forEach(el => { el.textContent = ''; });
    paintLive(null);
  }

  fetch('/api/metrics', { headers: { accept: 'application/json' } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(payload => {
      const map = payload.metrics || {};
      slots.forEach(el => paint(el, map[el.dataset.metric]));
      paintBadges(map);
      paintBars(map);
      paintLive(payload);

      if (payload.validationErrors && payload.validationErrors.length) {
        console.warn('[metrics] registry validation errors:', payload.validationErrors);
      }
    })
    .catch(err => {
      /* The canonical layer is unreachable. Say so. Do not invent, do not
         reuse, do not leave a stale number standing. */
      console.warn('[metrics] canonical layer unavailable:', err.message);
      unavailableAll('Official data unavailable');
    });
})();
