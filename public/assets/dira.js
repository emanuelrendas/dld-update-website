/* ═══════════════════════════════════════════════════════════════════
   HOMEPAGE — NET YIELD / GOLDEN VISA CALCULATOR AND THE DIRA INTAKE

   Two components that share one purpose: turn an anonymous reader into a
   record. The calculator gives before it asks; the assessment asks once
   the visitor has a reason to answer.

   ─────────────── WHAT IS OFFICIAL HERE ───────────────

   Three inputs are statutory and are labelled as such on the page:

     DLD transfer fee        4% of purchase price
     Trustee office fee      AED 4,000
     Golden Visa threshold   AED 2,000,000

   Everything else is a MODEL ASSUMPTION the visitor sets: the service
   charge per square foot, the rent, the vacancy allowance. The panel
   states this rather than implying the output is a valuation.

   Net yield uses the same definition as every other panel on the site:
   rent, less vacancy, less service charge, less management, over price.
   Acquisition costs are shown separately and never folded into the
   percentage — folding them in produces a number that cannot be compared
   with any published yield.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────── statutory, not assumed ─────────── */
  const DLD_PCT        = 0.04;
  const TRUSTEE_FEE    = 4000;
  const AGENCY_PCT     = 0.02;
  const GOLDEN_VISA    = 2000000;

  /* ─────────── model assumptions, editable on the page ─────────── */
  const VACANCY_PCT    = 1 / 12;   /* one month a year between tenancies */
  const MGMT_PCT       = 0.05;

  const AED = (n) => 'AED ' + Math.round(n).toLocaleString('en-US');
  const AEDk = (n) => Math.abs(n) >= 1e6
    ? 'AED ' + (n / 1e6).toFixed(2) + 'M'
    : 'AED ' + Math.round(n / 1000) + 'K';
  const num = (id, d = 0) => { const el = document.getElementById(id); return el ? (+el.value || d) : d; };
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  /* ═══════════════ CALCULATOR ═══════════════ */
  const calc = document.getElementById('hc');
  if (calc) {
    const run = () => {
      const price = num('hc-price');
      const sqft  = num('hc-sqft');
      const rent  = num('hc-rent');
      const scPsf = num('hc-sc');

      const dld     = price * DLD_PCT;
      const agency  = price * AGENCY_PCT;
      const acq     = dld + agency + TRUSTEE_FEE;

      const service = sqft * scPsf;
      const vacancy = rent * VACANCY_PCT;
      const mgmt    = rent * MGMT_PCT;
      const noi     = rent - vacancy - service - mgmt;

      set('hc-dld',     AED(dld));
      set('hc-agency',  AED(agency));
      set('hc-trustee', AED(TRUSTEE_FEE));
      set('hc-acq',     AED(acq));
      set('hc-in',      AEDk(price + acq));

      set('hc-rentv',   AED(rent));
      set('hc-vac',     '−' + AED(vacancy));
      set('hc-scv',     '−' + AED(service));
      set('hc-mgmt',    '−' + AED(mgmt));
      set('hc-noi',     AED(noi));

      set('hc-gross', price > 0 ? (rent / price * 100).toFixed(2) + '%' : '—');
      set('hc-net',   price > 0 ? (noi  / price * 100).toFixed(2) + '%' : '—');

      /* Golden Visa is a threshold test on the purchase price, not on the
         all-in cost. Stating the shortfall is more useful than a yes/no. */
      const gv = document.getElementById('hc-gv');
      if (gv) {
        const qualifies = price >= GOLDEN_VISA;
        gv.textContent = qualifies
          ? 'Qualifies — at or above the AED 2,000,000 threshold'
          : `${AED(GOLDEN_VISA - price)} below the AED 2,000,000 threshold`;
        gv.classList.toggle('yes', qualifies);
        gv.classList.toggle('no', !qualifies);
      }

      /* The WhatsApp payload carries the model, so the first message is
         already the conversation rather than an introduction to it. */
      const wa = document.getElementById('hc-wa');
      if (wa && window.WA_NUMBER) {
        const msg =
          'DUBAI MODEL — via website\n' +
          'Purchase: ' + AED(price) + (sqft ? '  ·  ' + sqft + ' sqft' : '') + '\n' +
          'Annual rent: ' + AED(rent) + '\n' +
          'Acquisition cost: ' + AED(acq) + ' (DLD 4% + agency 2% + trustee)\n' +
          'Net operating income: ' + AED(noi) + '\n' +
          'Gross yield: ' + (price > 0 ? (rent / price * 100).toFixed(2) : '0') + '%  ·  ' +
          'Net yield: ' + (price > 0 ? (noi / price * 100).toFixed(2) : '0') + '%\n' +
          'Golden Visa: ' + (price >= GOLDEN_VISA ? 'qualifies' : 'below threshold');
        wa.href = 'https://wa.me/' + window.WA_NUMBER + '?text=' + encodeURIComponent(msg);
      }
    };

    ['hc-price', 'hc-sqft', 'hc-rent', 'hc-sc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener('input', run); el.addEventListener('change', run); }
    });
    run();

    /* Engagement, not keystrokes — same rule as the instruments page. */
    if (window.Track) {
      let sent = false, t = null;
      const bump = () => {
        if (sent) return;
        clearTimeout(t);
        t = setTimeout(() => {
          sent = true;
          const p = num('hc-price');
          window.Track('calculator_used', {
            tool: 'homepage_yield',
            budget_band: !p ? null : p < 2e6 ? 'under AED 2M' : p < 5e6 ? 'AED 2M – 5M'
                        : p < 15e6 ? 'AED 5M – 15M' : 'AED 15M+',
            used_leverage: false,
          });
        }, 4000);
      };
      ['hc-price', 'hc-sqft', 'hc-rent', 'hc-sc'].forEach((id) =>
        document.getElementById(id)?.addEventListener('input', bump));
    }
  }

  /* ═══════════════ DIRA — four steps, then contact ═══════════════ */
  const dira = document.getElementById('dira');
  if (!dira) return;

  const answers = {};
  let step = 1;
  const LAST = 4;

  const show = (n) => {
    step = n;
    dira.querySelectorAll('.d-step').forEach((s) =>
      s.hidden = Number(s.dataset.step) !== n);
    dira.querySelectorAll('.d-pip').forEach((p, i) => {
      p.classList.toggle('on',   i + 1 === n);
      p.classList.toggle('done', i + 1 <  n);
    });
    set('d-count', `Step ${n} of ${LAST}`);
    const back = document.getElementById('d-back');
    if (back) back.hidden = n === 1;
    /* Focus the step heading so a screen reader announces the change and
       a keyboard user is not left at the top of the document. */
    dira.querySelector(`.d-step[data-step="${n}"] .d-q`)?.focus();
  };

  /* Steps 1–3 are single-choice: picking an answer advances. */
  dira.querySelectorAll('.d-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = btn.closest('.d-step');
      answers[s.dataset.key] = btn.dataset.value;
      s.querySelectorAll('.d-opt').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      if (Number(s.dataset.step) === 1 && window.Track) window.Track('assessment_started', {});
      setTimeout(() => show(Math.min(LAST, Number(s.dataset.step) + 1)), 180);
    });
  });

  document.getElementById('d-back')?.addEventListener('click', () => show(Math.max(1, step - 1)));

  const form = document.getElementById('d-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const consent = document.getElementById('d-consent')?.checked === true;
    const note = document.getElementById('d-note');
    const btn  = document.getElementById('d-submit');

    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    const q = new URLSearchParams(location.search);
    fetch('/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        capital_band:     answers.capital_band,
        strategic_focus:  answers.strategic_focus,
        tax_jurisdiction: answers.tax_jurisdiction,
        name: val('d-name'), email: val('d-email'), whatsapp: val('d-wa'),
        consent,
        session_id: (() => { try { return sessionStorage.getItem('er_sid'); } catch { return null; } })(),
        referrer_url: document.referrer || null,
        utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'),
      }),
    })
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((d) => {
        window.Track && window.Track('assessment_completed', { stored: !!(d && d.ok) });
        if (d && d.ok) {
          /* Both routes stay open. The download is the reason they came;
             the WhatsApp link is the reason they stay. */
          const done = document.getElementById('d-done');
          if (done) {
            done.hidden = false;
            form.hidden = true;
            dira.querySelector('.d-rail')?.setAttribute('hidden', '');
            const wa = document.getElementById('d-wa-link');
            if (wa && window.WA_NUMBER) {
              wa.href = 'https://wa.me/' + window.WA_NUMBER + '?text=' + encodeURIComponent(
                'Completed the Dubai Investor Readiness Assessment.\n' +
                'Name: ' + val('d-name') + '\n' +
                'Capital: ' + (answers.capital_band || '—') + '\n' +
                'Focus: ' + (answers.strategic_focus || '—') + '\n' +
                'Based: ' + (answers.tax_jurisdiction || '—'));
            }
            done.querySelector('h3')?.focus();
          }
        } else if (note) {
          note.hidden = false;
          note.textContent = 'That did not save. Please continue on WhatsApp below and I will pick it up there.';
          note.classList.add('warn');
          if (btn) { btn.disabled = false; btn.textContent = 'Get the blueprint'; }
        }
      })
      .catch(() => {
        window.Track && window.Track('assessment_completed', { stored: false });
        if (note) {
          note.hidden = false;
          note.textContent = 'That did not save. Please continue on WhatsApp below and I will pick it up there.';
          note.classList.add('warn');
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Get the blueprint'; }
      });
  });

  show(1);
})();
