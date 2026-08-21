/* ═══════════════ CALCULATORS — /instruments only ═══════════════
   Investment Lab, STR/long-let NOI, quick yield, Golden Visa,
   currency and readiness quiz. Guarded so the file is inert if
   the instruments markup is ever absent. */
(function(){
if(!document.getElementById('instruments') && !document.getElementById('str')) return;

/* ═══════════════ TOOLS — tabs ═══════════════ */
document.querySelectorAll('.tt').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tt').forEach(x=>x.classList.remove('on'));
    document.querySelectorAll('.tool-panel').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');
    document.getElementById('tab-'+t.dataset.tab).classList.add('on');
  });
});

/* ═══════════════ INVESTMENT LAB ENGINE ═══════════════ */
const AED = n => 'AED ' + Math.round(n).toLocaleString('en-US');
const AEDk = n => Math.abs(n) >= 1e6
  ? 'AED ' + (n/1e6).toFixed(2) + 'M'
  : 'AED ' + Math.round(n/1000) + 'K';

/* Every engine below delegates to assets/finance.js. That file holds the
   single definition of net operating income and net yield used across the
   whole site, so two panels can no longer disagree about the same asset. */
const F = window.Finance;
const val = (id, d = 0) => { const el = document.getElementById(id); return el ? (+el.value || d) : d; };

/* ─────────── engagement, not keystrokes ───────────
   Every panel recalculates on each `input` event, so tracking there would
   post an event per character typed. This fires once per tool, four
   seconds after the visitor stops changing things — the point at which
   they have a model rather than a half-typed number.

   What travels is the SHAPE of the model: a budget band, whether leverage
   was used, the hold period. Never the price, never the rent, never the
   figures themselves. Knowing someone modelled an eight-figure purchase is
   useful; storing their exact numbers is surveillance, and they came here
   to do arithmetic in private. */
const bandOf = (price) =>
  !price          ? null :
  price <  2e6    ? 'under AED 2M'  :
  price <  5e6    ? 'AED 2M – 5M'   :
  price < 15e6    ? 'AED 5M – 15M'  :
  price < 50e6    ? 'AED 15M – 50M' : 'AED 50M+';

/* Armed on the input listeners rather than inside the render functions:
   every panel renders once on load to show its defaults, so tracking the
   render would report "calculator used" for anyone who merely opened the
   page — turning the one signal that identifies a high-intent visitor into
   a second, worse pageview count. */
function armTracking(ids, tool, props){
  let sent = false, timer = null;
  const bump = ()=>{
    if(sent || !window.Track) return;
    clearTimeout(timer);
    timer = setTimeout(()=>{ sent = true; window.Track('calculator_used', Object.assign({ tool }, props())); }, 4000);
  };
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.addEventListener('input', bump); el.addEventListener('change', bump); }
  });
}

/* Reads the Lab's inputs into the shape the shared engine expects. */
function labInputs(appreciation){
  return {
    price: val('L-price'),
    rent:  val('L-rent'),
    serviceCharge: val('L-sc'),
    mgmtPct:    val('L-mgmt', 5) / 100,
    vacancyPct: val('L-vac', 8.33) / 100,
    maintPct:   val('L-maint', 5) / 100,
    ltvPct: val('L-ltv'),
    otherCosts: val('L-other'),
    rate:   val('L-rate'),
    term:   val('L-term', 25),
    years:  val('L-exit', 5),
    appreciationPct: appreciation,
  };
}
const model = (appreciation) => F.allInReturn(labInputs(appreciation));

function runLab(){
  if(!document.getElementById('L-price')) return;
  const base = val('L-app');            /* user assumption, 0 unless typed */
  const dn = model(Math.max(-10, base - 3));
  const md = model(base);
  const up = model(base + 3);

  const yrs = md.years;
  /* Say the horizon out loud. A cumulative +64% sitting beside an IRR reads
     as annual to anyone skimming, and that is the reader this panel is for. */
  document.querySelectorAll('.scn .sl').forEach(el => {
    el.textContent = 'Total return over ' + yrs + (yrs === 1 ? ' year' : ' years');
  });

  const setScn = (id, m, appr) => {
    document.getElementById(id).textContent = (m.totalReturnPct>=0?'+':'') + m.totalReturnPct.toFixed(0) + '%';
    const ann = m.annualisedPct === null ? 'n/a' :
      (m.annualisedPct>=0?'+':'') + m.annualisedPct.toFixed(1) + '% / yr annualised';
    document.getElementById(id+'-a').textContent =
      appr.toFixed(1) + '% growth · ' + ann + ' · ' + AEDk(m.profit);
  };
  setScn('S-dn', dn, Math.max(-10, base-3));
  setScn('S-md', md, base);
  setScn('S-up', up, base+3);

  const S = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent = v; };

  S('K-cash', AEDk(md.cashIn));
  S('K-cf',   AEDk(md.cashFlow));
  document.getElementById('K-cf-box').classList.toggle('neg', md.cashFlow < 0);
  S('K-coc', md.cashOnCashPct.toFixed(1) + '%');
  S('K-irr', md.irrPct === null ? 'n/a' : md.irrPct.toFixed(1) + '%');
  S('K-ann', md.annualisedPct === null ? 'n/a' : (md.annualisedPct>=0?'+':'') + md.annualisedPct.toFixed(1) + '%');

  /* operating bridge — the displayed lines ARE the calculation */
  const op = md.operating;
  S('Y-rent',  AED(op.rent));
  S('Y-vac',   '-' + AED(op.vacancy));
  S('Y-sc',    '-' + AED(op.serviceCharge));
  S('Y-mgmt',  '-' + AED(op.management));
  S('Y-maint', '-' + AED(op.maintenance));
  S('Y-noi',   AED(op.total));
  S('Y-gross', F.grossYield(op.rent, md.price).toFixed(2) + '%');
  S('Y-net',   (md.price > 0 ? op.total / md.price * 100 : 0).toFixed(2) + '%');

  S('F-down', AED(md.down));
  S('F-dld',  AED(md.acquisition.dld));
  S('F-comm', AED(md.acquisition.agency));
  S('F-mreg', AED(md.acquisition.mortgage));
  S('F-other', AED(md.acquisition.other));
  S('F-in',   AED(md.cashIn));
  S('F-mort', md.debtYear>0 ? '-' + AED(md.debtYear) : AED(0));
  S('F-exit', AED(md.exitVal));
  S('F-bal',  md.balance>0 ? '-' + AED(md.balance) : AED(0));
  S('F-sell', '-' + AED(md.sellCost));
  S('F-net',  AED(md.netProceeds));
}
['L-price','L-rent','L-sc','L-mgmt','L-vac','L-maint','L-ltv','L-rate','L-term','L-exit','L-app','L-other']
  .forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', runLab); });

armTracking(['L-price','L-rent','L-sc','L-mgmt','L-vac','L-maint','L-ltv','L-rate','L-term','L-exit','L-app','L-other'], 'investment_lab', ()=>({
  budget_band:   bandOf(val('L-price')),
  used_leverage: val('L-ltv') > 0,
  hold_years:    val('L-exit', 5),
}));
runLab();

/* ═══════════════ STR / LONG-TERM NOI ENGINE ═══════════════
   Statutory fees (DET registration and permit bands, Tourism Dirham range,
   municipality fee, VAT) come from DET published schedules.

   Everything else below is a MODEL ASSUMPTION and is disclosed as one on
   the page: which permit band is charged, AED 15 a night for Tourism
   Dirham, AED 13,200 a year of utilities, four-year furnishing
   amortisation, and the seasonality split — 7 peak months at the stated
   ADR, 5 trough months at 62% of it. None of these are official figures
   and none are presented as DLD or DET data. Verified 8 Aug 2026. */
let strMode = 'str';

function strModel(){
  const P    = +document.getElementById('T-price').value || 1;
  const size = +document.getElementById('T-size').value || 0;
  const scR  = +document.getElementById('T-sc').value || 0;
  const rent = +document.getElementById('T-rent').value || 0;
  const adr  = +document.getElementById('T-adr').value || 0;
  const occ  = (+document.getElementById('T-occ').value || 0) / 100;
  const opP  = (+document.getElementById('T-op').value || 0) / 100;
  const furn = +document.getElementById('T-furn').value || 0;

  const serviceCharge = size * scR;

  /* ── LONG-TERM ──
     Identical definition to the Lab and the Quick ROI panel. */
  const op      = F.noi({ rent, serviceCharge });
  const ltGross = op.rent;
  const ltMgmt  = op.management;
  const ltVoid  = op.vacancy;
  const ltMaint = op.maintenance;
  const ltNet   = op.total;

  /* ── SHORT-TERM ──
     Every assumption below is now an editable field on the page rather
     than a constant buried in this file. Defaults shown in brackets. */
  const troughPct = val('T-trough', 62) / 100;   /* summer ADR as a share of peak */
  const tourismPN = val('T-tourism', 15);        /* Tourism Dirham per occupied night */
  const permit    = val('T-permit', 670);        /* DET annual unit permit */
  const utilities = val('T-util', 13200);        /* DEWA, chiller, connectivity, consumables */
  const amortYrs  = val('T-amort', 4) || 4;      /* furnishing amortisation period */

  const peakNights   = 213;                    /* Oct–Apr */
  const troughNights = 152;                    /* May–Sep */
  const troughADR    = adr * troughPct;
  const bookedPeak   = peakNights * occ;
  const bookedTrough = troughNights * occ;
  const strGross     = bookedPeak * adr + bookedTrough * troughADR;
  const nightsBooked = bookedPeak + bookedTrough;

  const opFee    = strGross * opP;
  const opVat    = opFee * 0.05;               /* 5% VAT on operator services — official */
  const tourism  = nightsBooked * tourismPN;
  /* 7% municipality fee is guest-borne under standard operator structures and is
     therefore excluded from owner NOI. Confirm treatment in the operator agreement. */
  const capex    = furn / amortYrs;
  const strNet   = strGross - serviceCharge - opFee - opVat - tourism - permit - utilities - capex;

  const revpar = nightsBooked ? strGross / 365 : 0;

  return {P,size,serviceCharge,ltGross,ltMgmt,ltVoid,ltMaint,ltNet,
          strGross,opFee,opVat,tourism,permit,utilities,capex,strNet,
          nightsBooked,revpar,adr,troughADR,occ};
}

function renderSTR(){
  if(!document.getElementById('T-price')) return;
  const m = strModel();
  const A = n => 'AED ' + Math.round(n).toLocaleString('en-US');
  const rows = document.getElementById('noi-rows');

  if(strMode === 'lt'){
    document.getElementById('noi-title').textContent = 'Long-Term Tenancy';
    document.getElementById('noi-sub').textContent = 'annual · 12-month contract';
    rows.innerHTML =
      `<div class="noi-r gross"><span class="nk">Contract rent</span><span class="nv">${A(m.ltGross)}</span></div>
       <div class="noi-r"><span class="nk">Service charge · ${m.size} sqft</span><span class="nv neg">-${A(m.serviceCharge)}</span></div>
       <div class="noi-r"><span class="nk">Vacancy allowance</span><span class="nv neg">-${A(m.ltVoid)}</span></div>
       <div class="noi-r"><span class="nk">Property management</span><span class="nv neg">-${A(m.ltMgmt)}</span></div>
       <div class="noi-r"><span class="nk">Maintenance allowance</span><span class="nv neg">-${A(m.ltMaint)}</span></div>
       <div class="noi-r net"><span class="nk">Net operating income</span><span class="nv">${A(m.ltNet)}</span></div>
       <div class="noi-r"><span class="nk">Gross yield</span><span class="nv">${(m.ltGross/m.P*100).toFixed(2)}%</span></div>
       <div class="noi-r"><span class="nk">Net yield</span><span class="nv">${(m.ltNet/m.P*100).toFixed(2)}%</span></div>`;
  } else {
    document.getElementById('noi-title').textContent = 'Dynamic STR Yield';
    document.getElementById('noi-sub').textContent = `${Math.round(m.nightsBooked)} nights · RevPAR ${A(m.revpar)}`;
    rows.innerHTML =
      `<div class="noi-r gross"><span class="nk">Gross booking revenue</span><span class="nv">${A(m.strGross)}</span></div>
       <div class="noi-r"><span class="nk">Service charge · ${m.size} sqft</span><span class="nv neg">-${A(m.serviceCharge)}</span></div>
       <div class="noi-r"><span class="nk">Operator management</span><span class="nv neg">-${A(m.opFee)}</span></div>
       <div class="noi-r"><span class="nk">VAT on operator fee (5%)</span><span class="nv neg">-${A(m.opVat)}</span></div>
       <div class="noi-r"><span class="nk">Tourism Dirham</span><span class="nv neg">-${A(m.tourism)}</span></div>
       <div class="noi-r"><span class="nk">DET permit</span><span class="nv neg">-${A(m.permit)}</span></div>
       <div class="noi-r"><span class="nk">Utilities, connectivity, consumables</span><span class="nv neg">-${A(m.utilities)}</span></div>
       <div class="noi-r"><span class="nk">Furnishing capex · 4-year amortisation</span><span class="nv neg">-${A(m.capex)}</span></div>
       <div class="noi-r net"><span class="nk">Net operating income</span><span class="nv">${A(m.strNet)}</span></div>
       <div class="noi-r"><span class="nk">Gross yield</span><span class="nv">${(m.strGross/m.P*100).toFixed(2)}%</span></div>
       <div class="noi-r"><span class="nk">Net yield</span><span class="nv">${(m.strNet/m.P*100).toFixed(2)}%</span></div>`;
  }

  /* verdict compares both models regardless of which is displayed */
  const delta = m.strNet - m.ltNet;
  const deltaPct = m.ltNet !== 0 ? delta / Math.abs(m.ltNet) * 100 : 0;
  const grossSpread = m.ltGross ? (m.strGross - m.ltGross) / m.ltGross * 100 : 0;
  /* Breakeven only means something when both nets are positive. With a
     negative STR net the ratio flips sign and returns a plausible-looking
     percentage for a case that never breaks even at any occupancy. */
  const beValid = m.occ > 0 && m.strNet > 0 && m.ltNet > 0;
  const breakevenOcc = beValid ? m.occ * (m.ltNet / m.strNet) * 100 : null;

  const head = document.getElementById('v-head');
  const body = document.getElementById('v-body');

  if(delta > 0){
    head.innerHTML = `STR clears long-term by <em>${A(delta)}</em> net`;
    body.textContent =
      `Gross revenue runs ${grossSpread.toFixed(0)}% above the contract rent, and ${(100 - (m.strNet/m.strGross*100)).toFixed(0)}% of that gross is consumed by operating friction. ` +
      (breakevenOcc !== null && breakevenOcc < 100
        ? `The arbitrage survives at this occupancy. It reverses below roughly ${breakevenOcc.toFixed(0)}% — model the trough, not the peak.`
        : `Model the trough, not the peak.`);
  } else {
    head.innerHTML = `Long-term clears STR by <em>${A(Math.abs(delta))}</em> net`;
    body.textContent =
      `Gross revenue runs ${grossSpread.toFixed(0)}% above the contract rent, but operating friction absorbs the entire spread. ` +
      `At these inputs the twelve-month tenancy is the better instrument — fewer moving parts, no capex, no licensing exposure.`;
  }
}

document.querySelectorAll('.mode-b').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.mode-b').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    strMode = b.dataset.mode;
    renderSTR();
  });
});
['T-price','T-size','T-sc','T-rent','T-adr','T-occ','T-op','T-furn','T-trough','T-tourism','T-permit','T-util','T-amort']
  .forEach(id=>{ const el = document.getElementById(id); if(el) el.addEventListener('input', renderSTR); });
renderSTR();

/* ═══════════════ TOOLS — ROI ═══════════════ */
const fmt = n => 'AED ' + Math.round(n).toLocaleString('en-US');
/* Same definition as the Lab and the STR long-let arm — vacancy,
   service charge, management and maintenance all deducted. This panel
   previously subtracted the service charge alone and reported the result
   as "net yield", which read materially higher than the Lab for the same
   property with no explanation offered. */
function calcROI(){
  const P = val('r-price'), R = val('r-rent'), S = val('r-sc'), A = val('r-app');
  document.getElementById('r-app-v').textContent = A.toFixed(1);
  if(P<=0) return;

  const op  = F.noi({ rent:R, serviceCharge:S });   /* shared assumptions */
  const v5  = P * Math.pow(1 + A/100, 5);
  const total = ((v5 - P) + op.total * 5) / P * 100;

  document.getElementById('r-gross').textContent   = F.grossYield(R,P).toFixed(2)+'%';
  document.getElementById('r-net').textContent     = (op.total / P * 100).toFixed(2)+'%';
  document.getElementById('r-monthly').textContent = fmt(op.total/12);
  document.getElementById('r-5y').textContent      = fmt(v5);
  document.getElementById('r-total').textContent   = (total>=0?'+':'')+total.toFixed(1)+'%';
}
['r-price','r-rent','r-sc','r-app'].forEach(id=> document.getElementById(id).addEventListener('input', calcROI));
armTracking(['r-price','r-rent','r-sc','r-app'], 'quick_roi', ()=>({
  budget_band: bandOf(val('r-price')), used_leverage: false,
}));
calcROI();

/* ═══════════════ TOOLS — Golden Visa ═══════════════ */
function calcVisa(){
  const v = +document.getElementById('v-val').value || 0;
  const paid = document.getElementById('v-paid').value;
  const box = document.getElementById('v-verdict');
  if(v >= 2000000 && paid === 'full'){
    box.className = 'gv-verdict yes';
    box.innerHTML = '<div class="v1">Eligible — 10-Year Golden Visa</div><div class="v2">This value and structure qualify under current rules. I confirm the precise position before every purchase.</div>';
  } else if(v >= 2000000){
    box.className = 'gv-verdict no';
    box.innerHTML = '<div class="v1">Value qualifies — structure matters</div><div class="v2">Financed purchases have specific conditions. This is exactly the kind of detail we resolve inside a mandate.</div>';
  } else {
    box.className = 'gv-verdict no';
    box.innerHTML = '<div class="v1">Below the AED 2M threshold</div><div class="v2">You are ' + fmt(2000000-v) + ' from eligibility. There are strong qualifying options — let\'s discuss them.</div>';
  }
}
['v-val','v-paid'].forEach(id=> document.getElementById(id).addEventListener('input', calcVisa));
calcVisa();

/* ═══════════════ TOOLS — FX (USD peg exact; EUR/GBP indicative) ═══════════════ */
/* AED per unit. USD is the fixed UAE Central Bank peg and does not move.
   EUR and GBP are fallbacks only, last verified 8 Aug 2026, and are
   replaced by ECB-derived rates on load. If /api/fx fails these stand,
   which is why the label reads "verified" rather than "live". */
let RATES = { USD:3.6725, EUR:4.2373, GBP:4.9495 };
function calcFX(){
  const amt = +document.getElementById('fx-amt').value || 0;
  const cur = document.getElementById('fx-cur').value;
  const aed = cur==='AED' ? amt : amt * RATES[cur];
  document.getElementById('fx-aed').textContent = fmt(aed);
  document.getElementById('fx-usd').textContent = '$ ' + Math.round(aed/RATES.USD).toLocaleString();
  document.getElementById('fx-eur').textContent = '€ ' + Math.round(aed/RATES.EUR).toLocaleString();
  document.getElementById('fx-gbp').textContent = '£ ' + Math.round(aed/RATES.GBP).toLocaleString();
}
['fx-amt','fx-cur'].forEach(id=> document.getElementById(id).addEventListener('input', calcFX));
calcFX();

/* ═══════════════ FX — ECB reference rates ═══════════════ */
(async function loadFX(){
  try{
    const r = await fetch('/api/fx');
    const d = await r.json();
    if(!d || !d.rates || !d.rates.EUR) return;   /* keep verified fallback */

    RATES = d.rates;
    if(typeof calcFX === 'function') calcFX();

    const el = document.getElementById('fx-src');
    if(el){
      const when = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB',
        {day:'numeric', month:'long', year:'numeric'});
      el.textContent = d.live
        ? `Rates as at ${when}, from the European Central Bank.`
        : `Rates verified ${when}.`;
    }
  }catch(e){ /* silent — the verified fallback stands */ }
})();

/* ═══════════════ TOOLS — QUIZ ═══════════════ */
const answers = [null,null,null,null];
document.querySelectorAll('.quiz-opts').forEach(g=>{
  g.querySelectorAll('.qo').forEach(b=>{
    b.addEventListener('click', ()=>{
      g.querySelectorAll('.qo').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      answers[+g.dataset.q] = +b.dataset.s;
      if(answers.every(a=>a!==null)) quizResult();
    });
  });
});
function quizResult(){
  const s = answers.reduce((a,b)=>a+b,0); /* 6 .. 11 */
  const out = document.getElementById('quiz-out');
  let t,d;
  if(s >= 10){ t='Ready for a mandate'; d='Your objective, capital and timeline align. The next step is a private conversation — bring your questions, I\'ll bring the inventory the portals never show.'; }
  else if(s >= 8){ t='One conversation away'; d='The foundations are in place. A 20-minute call would sharpen the objective and map the two or three positions worth your attention.'; }
  else { t='The right time to learn'; d='No pressure and no rush. Start the conversation early — the clients who prepare 6 months ahead consistently enter on better terms.'; }
  out.innerHTML = '<div class="gv-verdict yes"><div class="v1">'+t+'</div><div class="v2">'+d+'</div></div>' +
    '<a class="btn btn-solid" style="width:100%;justify-content:center;margin-top:18px;" href="#consult">Book an Investment Strategy Session</a>';
}

})();
