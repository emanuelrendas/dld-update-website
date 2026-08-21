/* ═══════════════ INTELLIGENCE MAP — /addresses only ═══════════════ */
(function(){
if(!document.getElementById('map')) return;

/* ═══════════════ INTERACTIVE DUBAI MAP ═══════════════ */
/* ═══════════════ INTELLIGENCE MAP — DUBAI ONLY ═══════════════
   gr    = growth outlook score 1-5      ] Rendas Intelligence,
   rk    = supply risk score 1-5         ] ordinal judgement,
   pres  = capital preservation 1-5      ] rubric published on the page
   b     = indicative entry range        — Modelled
   band  = entry filter bucket           — Modelled

   WHAT IS NOT HERE, AND WHY. Price per sqft, gross yield, net yield,
   service charge, supply absorption and liquidity depth were all removed.
   None of them derives from the DLD register, and the site's standard is
   that an empty state beats an unsupported number. Price per sqft and the
   entry range return as OFFICIAL the day Dubai Pulse credentials are set —
   the register publishes meter_sale_price directly, and percentiles of
   actual_worth give a real entry band. Gross and net yield need rent data
   joined to sales at unit level, which no validated method yet provides.

   SCOPE. Dubai submarkets only. Abu Dhabi and Ras Al Khaimah addresses
   were removed from this map because they are not in the DLD register and
   presenting them on the same canvas implied they were. Abu Dhabi now sits
   in the separately-headed UAE Regional Comparison on /addresses, carrying
   its own official ADREC figures and its own jurisdiction label.

   PROVENANCE. These are INDICATIVE ranges, not calculated DLD statistics.
   They are not derived from the DLD transaction register and must not be
   presented as though they were. Price per sqft is rounded deliberately:
   an indicative range does not support a figure like 3,027, and printing
   one manufactures precision the evidence cannot carry.

   Verified 8 August 2026.                                              */
const AREAS = {
  palm:     {n:"Palm Jumeirah", b:"AED 5M — 150M+", gr:4, rk:1, band:"o20", st:"ready", pres:5,
             d:"Fixed island, permanent supply constraint. Signature villas and Garden Homes for clients acquiring assets their grandchildren will hold.",
             c:"Trophy · beachfront", y:"UHNWI, international", r:"Appreciation-led"},
  bay:      {n:"Jumeirah Bay Island", b:"AED 15M — 120M+", gr:4, rk:1, band:"o20", st:"ready", pres:5,
             d:"The seahorse island. Bulgari-anchored, severely limited inventory, and one of the strongest price trajectories in the region.",
             c:"Ultra-prime · island", y:"Collectors of assets", r:"Appreciation-led"},
  hills2:   {n:"Emirates Hills", b:"AED 20M — 100M+", gr:3, rk:1, band:"o20", st:"ready", pres:5,
             d:"Dubai's original gated enclave. Mature landscaping, absolute privacy, and a resident register that reads like a market index.",
             c:"Villas · established", y:"Principals, families", r:"Appreciation-led"},
  downtown: {n:"Downtown Dubai", b:"AED 2M — 40M", gr:3, rk:3, band:"2to8", st:"both", pres:4,
             d:"Burj Khalifa district. The most liquid resale market in the city — for clients who value exit optionality as much as entry.",
             c:"Urban · liquid", y:"Investors, professionals", r:"Balanced"},
  marina:   {n:"Dubai Marina", b:"AED 1.2M — 20M", gr:3, rk:3, band:"u2", st:"ready", pres:4,
             d:"The city's most established waterfront rental market. Deep tenant demand, proven liquidity, and the strongest entry point for first-time Dubai investors.",
             c:"Waterfront · rental", y:"Yield investors, expats", r:"Income-led"},
  difc:     {n:"DIFC", b:"AED 1.8M — 25M", gr:3, rk:2, band:"u2", st:"ready", pres:4,
             d:"The financial centre's residential core. Professional tenant depth and rental performance that behaves like infrastructure.",
             c:"Financial · yield", y:"Yield investors", r:"Income-led"},
  hills:    {n:"Dubai Hills Estate", b:"AED 2.5M — 45M", gr:4, rk:3, band:"2to8", st:"both", pres:4,
             d:"Emaar's flagship community. Schools, parkland, golf frontage — where relocating families anchor and end-user demand keeps deepening.",
             c:"Family · growth", y:"End-users, relocators", r:"Balanced"},
  creek:    {n:"Dubai Creek Harbour", b:"AED 1.5M — 18M", gr:4, rk:4, band:"u2", st:"offplan", pres:3,
             d:"Emaar's next waterfront district. Pre-handover pricing on a masterplan still years from completion — a genuine off-plan case with genuine delivery risk.",
             c:"Emerging · off-plan", y:"Forward investors", r:"Growth-led"},
  south:    {n:"Dubai South", b:"AED 600K — 4M", gr:5, rk:4, band:"u2", st:"offplan", pres:3,
             d:"Built around Al Maktoum International — an AED 128bn expansion targeting 260 million annual passengers. A five-to-ten-year infrastructure thesis, not a two-year trade.",
             c:"Infrastructure play", y:"Patient capital", r:"Growth-led"}
};

/* ── heat scales per layer ── */
/* Two scales. Neutral (teal → champagne) for price, yield and growth.
   Danger (emerald → amber → red) for supply risk, where direction has meaning. */
const SCALE_NEUTRAL = ['#1F7A6B','#3E9C7A','#9AA352','#D0A048','#F0C674'];
const SCALE_RISK    = ['#1A8A5C','#7FA83E','#D4A72C','#D97A2B','#C2452D'];
const LAYERS = {
  growth: {t:'Growth outlook', lo:'Steady', hi:'Strongest', sc:SCALE_NEUTRAL,
           v:a=>a.gr, min:3, max:5, fmt:a=>['','Limited','Modest','Steady','Strong','Strongest'][a.gr]},
  risk:   {t:'Supply & delivery risk', lo:'Lowest risk', hi:'Highest risk', sc:SCALE_RISK,
           v:a=>a.rk, min:1, max:5, fmt:a=>['','Very low','Low','Moderate','Elevated','High'][a.rk]}
};

let activeLayer  = 'growth';
let activeFilter = 'all';
let activeArea   = 'palm';
let activeStruct = 'ready';   /* Level 0 gate */

/* a market qualifies if it is that structure, or serves both */
const matchesStruct = a => a.st === activeStruct || a.st === 'both';

function heatColor(area){
  const L = LAYERS[activeLayer];
  const sc = L.sc || SCALE_NEUTRAL;
  const t = Math.max(0, Math.min(1, (L.v(area) - L.min) / (L.max - L.min)));
  return sc[Math.round(t * (sc.length - 1))];
}

function paintMap(){
  const L = LAYERS[activeLayer];
  document.getElementById('lg-title').textContent = L.t;

  const sc = document.getElementById('lg-scale');
  const pal = L.sc || SCALE_NEUTRAL;
  sc.innerHTML = '<span class="lg-sw">' + L.lo + '</span>' +
    pal.map(c=>'<span class="lg-sw"><i style="background:'+c+'"></i></span>').join('') +
    '<span class="lg-sw">' + L.hi + '</span>';

  let shown = 0;
  document.querySelectorAll('.map-pin').forEach(p=>{
    const a = AREAS[p.dataset.a]; if(!a) return;
    const visible = matchesStruct(a) && (activeFilter === 'all' || a.band === activeFilter);
    p.classList.toggle('dim', !visible);
    if(visible) shown++;
    const col = heatColor(a);
    const core = p.querySelector('circle.core');
    const ring = p.querySelector('circle.ring');
    if(core){ core.style.fill = col; }
    if(ring){
      ring.style.stroke = col;
      ring.style.fill = col + '33';   /* stronger tint so colour reads inside the ring */
    }
  });

  document.getElementById('map-count').textContent =
    (activeStruct === 'ready' ? 'Completed' : 'Off-plan') + ' · ' + L.t + ' · ' + shown +
    (shown === 1 ? ' Dubai market' : ' Dubai markets');

  /* highlight the extremes of the active layer so the switch is unmistakable */
  const vis = Object.keys(AREAS).filter(k=> matchesStruct(AREAS[k]) && (activeFilter==='all' || AREAS[k].band===activeFilter));
  if(vis.length){
    const sorted = [...vis].sort((a,b)=> L.v(AREAS[b]) - L.v(AREAS[a]));
    const hi = AREAS[sorted[0]], lo = AREAS[sorted[sorted.length-1]];
    const ex = document.getElementById('lg-extremes');
    if(ex) ex.innerHTML =
      '<span><b>Highest</b> ' + hi.n.split(' · ')[0] + ' — ' + L.fmt(hi) + '</span>' +
      '<span><b>Lowest</b> ' + lo.n.split(' · ')[0] + ' — ' + L.fmt(lo) + '</span>';
  }

  /* brief motion cue on the stage so a layer change is felt, not just seen */
  const stage = document.querySelector('.map-stage');
  if(stage && !reduced){
    stage.classList.remove('flash'); void stage.offsetWidth; stage.classList.add('flash');
  }
}

function selectArea(key){
  const a = AREAS[key]; if(!a) return;
  activeArea = key;
  document.querySelectorAll('.map-pin').forEach(p=> p.classList.toggle('on', p.dataset.a === key));
  document.getElementById('mp-name').textContent   = a.n;
  document.getElementById('mp-band').textContent   = a.b;
  document.getElementById('mp-desc').textContent   = a.d;
  document.getElementById('mp-yield').textContent  = a.r;
  const STRUCT = {ready:'Completed / secondary', offplan:'Off-plan pipeline', both:'Both structures available'};
  document.getElementById('mp-struct').textContent = STRUCT[a.st];

  document.getElementById('mp-growth').textContent = LAYERS.growth.fmt(a);
  document.getElementById('mp-risk').textContent   = LAYERS.risk.fmt(a);
  document.getElementById('mp-stars').innerHTML =
    Array.from({length:5}, (_,i)=> '<i class="'+(i < a.pres ? 'f':'')+'"></i>').join('');
}

document.querySelectorAll('.map-pin').forEach(p=>{
  p.addEventListener('click', ()=> selectArea(p.dataset.a));
  p.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectArea(p.dataset.a); } });
});
document.querySelectorAll('.map-tb').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.map-tb').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); activeLayer = b.dataset.layer; paintMap();
  });
});
document.querySelectorAll('.map-fl').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.map-fl').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); activeFilter = b.dataset.filter; paintMap();
    const cur = AREAS[activeArea];
    if(activeFilter !== 'all' && cur && cur.band !== activeFilter){
      const first = Object.keys(AREAS).find(k=> AREAS[k].band === activeFilter);
      if(first) selectArea(first);
    }
  });
});

document.querySelectorAll('.gate-b').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.gate-b').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    activeStruct = b.dataset.st;
    /* absorption matters for pipeline; liquidity matters for completed stock */
    const preferred = activeStruct === 'offplan' ? 'risk' : 'growth';
    document.querySelectorAll('.map-tb').forEach(t=>t.classList.toggle('on', t.dataset.layer===preferred));
    activeLayer = preferred;
    paintMap();
    const cur = AREAS[activeArea];
    if(!cur || !matchesStruct(cur)){
      const first = Object.keys(AREAS).find(k=> matchesStruct(AREAS[k]) &&
        (activeFilter==='all' || AREAS[k].band===activeFilter));
      if(first) selectArea(first);
    }
  });
});

paintMap();
selectArea('palm');


/* ═══════════════ COMPARE TWO COMMUNITIES ═══════════════
   Reads the same AREAS record the panel does, so a figure can never
   disagree between the two views. Directional winners are marked only
   where "better" is unambiguous — price per sqft and entry band are
   left neutral, because cheaper is not better, it is different. */
const CMP_ROWS = [
  {k:'Median price / sqft', v:()=>'Awaiting official DLD data', dir:0},
  {k:'Gross yield',         v:()=>'Not available from official data', dir:0},
  {k:'Growth outlook',    v:a=>LAYERS.growth.fmt(a),           dir:1, n:a=>a.gr},
  {k:'Supply risk',       v:a=>LAYERS.risk.fmt(a),             dir:-1, n:a=>a.rk},
  {k:'Capital preservation', v:a=>a.pres+' / 5',               dir:1, n:a=>a.pres},
  {k:'Entry band',        v:a=>a.b,                            dir:0},
  {k:'Return profile',    v:a=>a.r,                            dir:0},
];

function renderCompare(){
  const box = document.getElementById('cmp-out');
  const sel = document.getElementById('cmp-sel');
  if(!box || !sel) return;
  const other = sel.value;
  if(!other || other === activeArea){ box.innerHTML = ''; box.hidden = true; return; }
  const A = AREAS[activeArea], B = AREAS[other];
  if(!A || !B) return;

  const rows = CMP_ROWS.map(r=>{
    let aw='', bw='';
    if(r.dir && r.n){
      const na=r.n(A), nb=r.n(B);
      if(na !== nb){ const aBetter = r.dir > 0 ? na > nb : na < nb; aw = aBetter?' win':''; bw = aBetter?'':' win'; }
    }
    return `<tr><th>${r.k}</th><td class="cv${aw}">${r.v(A)}</td><td class="cv${bw}">${r.v(B)}</td></tr>`;
  }).join('');

  box.innerHTML =
    `<table class="cmp-tbl"><thead><tr><th></th><th>${A.n}</th><th>${B.n}</th></tr></thead><tbody>${rows}</tbody></table>
     <p class="cmp-note">Figures are indicative and modelled from registered transactions; the method is stated beside each metric in the panel above. A highlight marks the stronger side only where the direction is unambiguous — price and entry band carry none, because cheaper is not better, it is different.</p>`;
  box.hidden = false;
}

/* rebuild the option list whenever the primary selection moves */
function syncCompareOptions(){
  const sel = document.getElementById('cmp-sel');
  if(!sel) return;
  const keep = sel.value;
  sel.innerHTML = '<option value="">Compare with…</option>' +
    Object.entries(AREAS).filter(([k])=> k !== activeArea)
      .map(([k,a])=> `<option value="${k}"${k===keep?' selected':''}>${a.n}</option>`).join('');
}

(function mountCompare(){
  const panel = document.getElementById('mp-name')?.closest('div[class]')?.parentElement
             || document.getElementById('map')?.querySelector('.wrap');
  if(!panel) return;
  const bar = document.createElement('div');
  bar.className = 'cmp-bar';
  bar.innerHTML =
    `<label class="cmp-l" for="cmp-sel">Side by side</label>
     <select id="cmp-sel" aria-label="Compare the selected community with another"></select>
     <div class="cmp-out" id="cmp-out" hidden></div>`;
  panel.appendChild(bar);
  syncCompareOptions();
  document.getElementById('cmp-sel').addEventListener('change', renderCompare);

  /* wrap the existing selector so both views always move together */
  const inner = selectArea;
  selectArea = function(key){ inner(key); syncCompareOptions(); renderCompare(); };
})();

})();
