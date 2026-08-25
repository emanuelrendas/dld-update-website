/* ═══════════════ LIVE DLD FEED ═══════════════
   Hits our own /api/dld endpoint, which authenticates with Dubai Pulse
   server-side. If credentials are not set, or the request fails, the panel
   stays hidden and the published static figures above remain the record. */
(async function loadDLD(){
  const panel = document.getElementById('live-panel');
  if(!panel) return;
  try{
    const res  = await fetch('/api/dld');
    const data = await res.json();
    if(!data.configured || !data.ok) return;   /* stay silent, never show a broken state */

    const A = n => 'AED ' + Number(n).toLocaleString('en-US');
    const t = data.totals;
    const stamp = new Date(data.lastUpdated).toLocaleDateString('en-GB',
      {day:'numeric', month:'short', year:'numeric'});

    document.getElementById('live-dot').classList.add('on');
    document.getElementById('live-stamp').textContent = data.source + ' · updated ' + stamp;

    const kpis = `
      <div class="live-kpis">
        <div class="live-k"><div class="v">${t.transactions.toLocaleString()}</div><div class="l">Transactions</div></div>
        <div class="live-k"><div class="v">${t.valueAED >= 1e9 ? 'AED '+(t.valueAED/1e9).toFixed(1)+'B' : A(t.valueAED)}</div><div class="l">Total value</div></div>
        <div class="live-k"><div class="v">${t.medianPricePerSqft ? A(t.medianPricePerSqft) : '—'}</div><div class="l">Median / sqft</div></div>
        <div class="live-k"><div class="v">${t.offPlanShare ?? '—'}%</div><div class="l">Off-plan share</div></div>
      </div>`;

    const rows = (data.areas || []).slice(0, 8).map(a => `
      <div class="live-r">
        <span class="a">${a.name}</span>
        <span class="n">${a.transactions.toLocaleString()} transactions</span>
        <span class="p">${a.medianPricePerSqft ? A(a.medianPricePerSqft)+' / sqft' : '—'}</span>
      </div>`).join('');

    document.getElementById('live-body').innerHTML =
      kpis + (rows ? '<div class="live-rows">'+rows+'</div>' : '') +
      `<p class="live-msg">${data.note}</p>`;

    panel.hidden = false;
    panel.classList.add('in');
  }catch(e){ /* silent — the static figures stand */ }
})();
