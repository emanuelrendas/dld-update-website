/* ═══════════════════════════════════════════════════════════
   SHAREABLE MODELS — /instruments only

   A visitor's scenario used to die with the browser tab. The state of
   every calculator now lives in the URL, so a model can be sent to a
   spouse, an accountant, or back to Emanuel and reopen exactly as it
   was. Only fields the visitor actually changed are serialised, which
   keeps the link short enough to paste into WhatsApp.
   ═══════════════════════════════════════════════════════════ */
(function () {
  const PANELS = {
    lab: ['L-price', 'L-rent', 'L-sc', 'L-mgmt', 'L-ltv', 'L-rate', 'L-term', 'L-exit', 'L-app'],
    roi: ['r-price', 'r-rent', 'r-sc', 'r-app'],
    visa: ['v-val', 'v-paid'],
    fx: ['fx-amt', 'fx-cur'],
    str: ['T-price', 'T-size', 'T-sc', 'T-rent', 'T-adr', 'T-occ', 'T-furn', 'T-op'],
  };
  const ALL = Object.values(PANELS).flat();
  if (!ALL.some(id => document.getElementById(id))) return;

  /* defaults are whatever the markup shipped with — captured before any
     restore, so "changed" always means changed by the visitor */
  const DEFAULTS = {};
  ALL.forEach(id => { const el = document.getElementById(id); if (el) DEFAULTS[id] = el.value; });

  const activeTab = () => document.querySelector('.tt.on')?.dataset.tab || 'lab';

  const encode = () => {
    const p = new URLSearchParams();
    const tab = activeTab();
    if (tab !== 'lab') p.set('t', tab);
    ALL.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== DEFAULTS[id]) p.set(id, el.value);
    });
    return p.toString();
  };

  /* Restoring dispatches the same 'input' event the engines already listen
     for, so no calculator needs to know this module exists. */
  const restore = () => {
    const p = new URLSearchParams(location.search);
    if (![...p.keys()].length) return false;
    let touched = 0;
    ALL.forEach(id => {
      if (!p.has(id)) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.value = p.get(id);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      touched++;
    });
    const tab = p.get('t');
    if (tab) document.querySelector(`.tt[data-tab="${tab}"]`)?.click();
    return touched > 0;
  };

  const shareURL = () => {
    const q = encode();
    return location.origin + location.pathname + (q ? '?' + q : '');
  };

  /* keep the address bar in step so a plain copy-paste also carries state */
  let sync;
  const scheduleSync = () => {
    clearTimeout(sync);
    sync = setTimeout(() => {
      const q = encode();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }, 400);
  };
  ALL.forEach(id => document.getElementById(id)?.addEventListener('input', scheduleSync));
  document.querySelectorAll('.tt').forEach(t => t.addEventListener('click', scheduleSync));

  /* ---- share bar, injected rather than authored into every panel ---- */
  const bar = document.createElement('div');
  bar.className = 'share-bar';
  bar.innerHTML = `
    <div class="sb-t">Keep this model</div>
    <p class="sb-d">Your figures live in the link. Send it to whoever else needs to see the numbers — it reopens exactly as you left it. Nothing is stored on this website.</p>
    <div class="sb-act">
      <button type="button" class="btn btn-solid" id="sb-copy">Copy the link</button>
      <a class="btn btn-line" id="sb-wa" target="_blank" rel="noopener noreferrer">Send it to Emanuel</a>
    </div>
    <output class="sb-msg" id="sb-msg" aria-live="polite"></output>`;

  const host = document.getElementById('instruments')?.querySelector('.wrap');
  if (host) host.appendChild(bar);

  const msg = bar.querySelector('#sb-msg');
  const say = t => { msg.textContent = t; clearTimeout(say._t); say._t = setTimeout(() => msg.textContent = '', 3200); };

  bar.querySelector('#sb-copy').addEventListener('click', async () => {
    const url = shareURL();
    try {
      await navigator.clipboard.writeText(url);
      say('Link copied.');
    } catch {
      /* clipboard blocked (insecure context, Safari gesture rules) — show it
         so the visitor can still copy by hand rather than hitting a dead end */
      const f = document.createElement('input');
      f.value = url; f.className = 'sb-fallback'; f.readOnly = true;
      msg.replaceChildren(f); f.select();
      say._t && clearTimeout(say._t);
    }
  });

  const wa = bar.querySelector('#sb-wa');
  const refreshWA = () => {
    const text = 'Hello Emanuel — here is the scenario I modelled on your site:\n' + shareURL();
    wa.href = 'https://wa.me/' + (typeof WA !== 'undefined' ? WA : '971543871702') + '?text=' + encodeURIComponent(text);
  };
  refreshWA();
  bar.addEventListener('mouseenter', refreshWA);
  wa.addEventListener('click', refreshWA);
  ALL.forEach(id => document.getElementById(id)?.addEventListener('input', refreshWA));

  /* restore last, so the engines are already wired when values land */
  if (restore()) {
    refreshWA();
    document.getElementById('instruments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
