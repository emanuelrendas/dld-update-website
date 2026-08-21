/* ═══════════════ LIVE DLD REGISTER PANEL ═══════════════
   Reads /api/dld, which authenticates against Dubai Pulse server-side.

   This panel used to hide itself on any failure, leaving the published
   figures above it standing with no indication that the live connection
   was dead. That is the silent-fallback failure: a visitor could not tell
   a working feed from a broken one. The panel now always renders, and
   says which of the five states it is in.

   The green indicator lights on exactly one condition: a current request
   returned status LIVE. Not a cached page, not a stale snapshot, not a
   configured-but-failing key. ═══════════════════════════════════════ */
(async function loadDLD(){
  const panel = document.getElementById('live-panel');
  if(!panel) return;

  const body  = document.getElementById('live-body');
  const stamp = document.getElementById('live-stamp');
  const dot   = document.getElementById('live-dot');

  const show = (html, stampText) => {
    body.innerHTML = html;
    stamp.textContent = stampText;
    panel.hidden = false;
    panel.classList.add('in');
  };
  const state = (title, detail) =>
    `<div class="live-msg" style="padding:22px 18px;">
       <div style="color:var(--champ-hi);letter-spacing:.16em;font-size:9.5px;
                   text-transform:uppercase;font-weight:700;margin-bottom:8px;">${title}</div>
       <div>${detail}</div>
     </div>`;

  let d;
  try {
    const res = await fetch('/api/dld', { headers: { accept: 'application/json' } });
    d = await res.json();
  } catch (e) {
    dot.classList.remove('on');
    return show(state('Official data unavailable',
      'The Land Department connection could not be reached. The published figures above carry their own verification dates.'),
      'no connection');
  }

  if (d.status !== 'LIVE') {
    dot.classList.remove('on');
    const detail =
      d.configured === false
        ? 'No Dubai Pulse credentials are configured, so no live register data is being served. '
        + 'Every figure above is a published official release carrying its own period and verification date.'
      : d.status === 'INCOMPLETE'
        ? (d.message || 'Collection was truncated. Totals are withheld rather than published as an undercount.')
      : (d.message || 'The register returned no usable records for this period.');
    return show(state(
      d.status === 'INCOMPLETE' ? 'Collection incomplete — figures withheld' : 'Official data unavailable',
      detail), d.status.toLowerCase());
  }

  /* ── LIVE ── */
  const A = n => 'AED ' + Number(n).toLocaleString('en-US');
  const t = d.totals;
  const when = new Date(d.fetchedAt).toLocaleDateString('en-GB',
    { day:'numeric', month:'short', year:'numeric' });

  dot.classList.add('on');

  const kpis = `
    <div class="live-kpis">
      <div class="live-k"><div class="v">${t.transactions.toLocaleString()}</div><div class="l">Transactions</div></div>
      <div class="live-k"><div class="v">${t.valueAED >= 1e9 ? 'AED '+(t.valueAED/1e9).toFixed(1)+'B' : A(t.valueAED)}</div><div class="l">Total value</div></div>
      <div class="live-k"><div class="v">${t.medianPricePerSqft ? A(t.medianPricePerSqft) : '—'}</div><div class="l">Median / sqft</div></div>
      <div class="live-k"><div class="v">${t.transactions ? Math.round(t.offPlan.count / t.transactions * 100) : '—'}%</div><div class="l">Off-plan share</div></div>
    </div>`;

  const rows = (d.byCommunity || []).slice(0, 8).map(a => `
    <div class="live-r">
      <span class="a">${a.name}</span>
      <span class="n">${a.transactions.toLocaleString()} transactions</span>
      <span class="p">${a.medianPricePerSqft ? A(a.medianPricePerSqft)+' / sqft' : '—'}</span>
    </div>`).join('');

  /* Communities the site tracks but cannot yet map to a DLD area name are
     named rather than quietly omitted — an absent row otherwise reads as
     "no activity", which would be a false statement about a live market. */
  const unmapped = (d.unmappedCommunities || []).length
    ? `<p class="live-msg"><b>Official DLD community mapping unavailable</b> for
       ${d.unmappedCommunities.join(', ')} — the register's area name for these has not been
       confirmed, and guessing it would attribute the wrong transactions.</p>` : '';

  show(kpis + (rows ? '<div class="live-rows">'+rows+'</div>' : '') + unmapped +
       `<p class="live-msg">${d.note} Records read ${d.rowsIn.toLocaleString()},
        used ${d.rowsUsed.toLocaleString()}, discarded ${d.rowsDiscarded.toLocaleString()}.</p>`,
       `${d.source} · ${d.period.from} → ${d.period.to} · fetched ${when}`);
})();
