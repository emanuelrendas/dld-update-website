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

/* monthly payment on an amortising loan */
function monthlyPayment(principal, annualRate, years){
  if(principal <= 0) return 0;
  const r = annualRate/100/12, n = years*12;
  if(r === 0) return principal/n;
  return principal * r / (1 - Math.pow(1+r, -n));
}
/* outstanding balance after m months */
function loanBalance(principal, annualRate, years, monthsPaid){
  if(principal <= 0) return 0;
  const r = annualRate/100/12, n = years*12;
  if(monthsPaid >= n) return 0;
  if(r === 0) return principal * (1 - monthsPaid/n);
  const pmt = monthlyPayment(principal, annualRate, years);
  return principal*Math.pow(1+r,monthsPaid) - pmt*((Math.pow(1+r,monthsPaid)-1)/r);
}
/* IRR by bisection — robust, no derivative needed */
function irr(flows){
  const npv = r => flows.reduce((s,cf,t)=> s + cf/Math.pow(1+r,t), 0);
  let lo = -0.95, hi = 3;
  if(npv(lo) * npv(hi) > 0) return null;
  for(let i=0;i<200;i++){
    const mid = (lo+hi)/2;
    if(npv(lo)*npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo+hi)/2*100;
}

/* full model for one appreciation assumption */
function model(appreciation){
  const P    = +document.getElementById('L-price').value || 0;
  const rent = +document.getElementById('L-rent').value || 0;
  const sc   = +document.getElementById('L-sc').value || 0;
  const mgmt = +document.getElementById('L-mgmt').value / 100;
  const ltv  = +document.getElementById('L-ltv').value / 100;
  const rate = +document.getElementById('L-rate').value || 0;
  const term = +document.getElementById('L-term').value;
  const yrs  = +document.getElementById('L-exit').value;

  const loan   = P * ltv;
  const down   = P - loan;
  const dld    = P * 0.04;
  const comm   = P * 0.02;
  const mreg   = loan * 0.0025;
  const reg    = P > 500000 ? 4000 : 2000;
  const cashIn = down + dld + comm + mreg + reg;

  const pmtM   = monthlyPayment(loan, rate, term);
  const pmtY   = pmtM * 12;
  const netOp  = rent - sc - (rent * mgmt);      /* net operating income */
  const cfY    = netOp - pmtY;                    /* after debt service */

  const exitVal = P * Math.pow(1 + appreciation/100, yrs);
  const balance = loanBalance(loan, rate, term, yrs*12);
  const sellCost= exitVal * 0.02;
  const netProc = exitVal - balance - sellCost;

  const totalProfit = netProc - cashIn + (cfY * yrs);
  const totalReturn = cashIn > 0 ? totalProfit / cashIn * 100 : 0;
  const coc         = cashIn > 0 ? cfY / cashIn * 100 : 0;

  const flows = [-cashIn];
  for(let i=1;i<=yrs;i++) flows.push(i === yrs ? cfY + netProc : cfY);
  const r = irr(flows);

  return {P,loan,down,dld,comm,mreg,reg,cashIn,pmtY,netOp,cfY,
          exitVal,balance,sellCost,netProc,totalProfit,totalReturn,coc,irr:r,yrs};
}

function runLab(){
  if(!document.getElementById('L-price')) return;
  const base = +document.getElementById('L-app').value || 0;
  const dn = model(Math.max(-10, base - 3));
  const md = model(base);
  const up = model(base + 3);

  const setScn = (id, m, appr) => {
    document.getElementById(id).textContent = (m.totalReturn>=0?'+':'') + m.totalReturn.toFixed(0) + '%';
    document.getElementById(id+'-a').textContent = appr.toFixed(1) + '% / yr · ' + AEDk(m.totalProfit);
  };
  setScn('S-dn', dn, Math.max(-10, base-3));
  setScn('S-md', md, base);
  setScn('S-up', up, base+3);

  document.getElementById('K-cash').textContent = AEDk(md.cashIn);
  document.getElementById('K-cf').textContent   = AEDk(md.cfY);
  document.getElementById('K-cf-box').classList.toggle('neg', md.cfY < 0);
  document.getElementById('K-coc').textContent  = md.coc.toFixed(1) + '%';
  document.getElementById('K-irr').textContent  = md.irr === null ? 'n/a' : md.irr.toFixed(1) + '%';

  const S = (id,v)=> document.getElementById(id).textContent = v;
  S('F-down', AED(md.down));  S('F-dld', AED(md.dld));
  S('F-comm', AED(md.comm));  S('F-mreg', AED(md.mreg));
  S('F-in',   AED(md.cashIn));
  S('F-mort', md.pmtY>0 ? '-' + AED(md.pmtY) : AED(0));
  S('F-exit', AED(md.exitVal));
  S('F-bal',  md.balance>0 ? '-' + AED(md.balance) : AED(0));
  S('F-sell', '-' + AED(md.sellCost));
  S('F-net',  AED(md.netProc));
}
['L-price','L-rent','L-sc','L-mgmt','L-ltv','L-rate','L-term','L-exit','L-app']
  .forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', runLab); });
runLab();

/* ═══════════════ STR / LONG-TERM NOI ENGINE ═══════════════
   All fee inputs from DET published schedules and operator benchmarks, Aug 2026.
   Seasonality: 7 peak months at stated ADR, 5 trough months at 62% of it. */
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

  /* ── LONG-TERM ── */
  const ltGross = rent;
  const ltMgmt  = rent * 0.05;                 /* letting + management */
  const ltVoid  = rent * (1/12);               /* one month void allowance between tenancies */
  const ltNet   = ltGross - serviceCharge - ltMgmt - ltVoid;

  /* ── SHORT-TERM ── */
  const peakNights   = 213;                    /* Oct–Apr */
  const troughNights = 152;                    /* May–Sep */
  const troughADR    = adr * 0.62;
  const bookedPeak   = peakNights * occ;
  const bookedTrough = troughNights * occ;
  const strGross     = bookedPeak * adr + bookedTrough * troughADR;
  const nightsBooked = bookedPeak + bookedTrough;

  const opFee    = strGross * opP;
  const opVat    = opFee * 0.05;               /* 5% VAT on operator services */
  const tourism  = nightsBooked * 15;          /* Tourism Dirham, AED 10–20/night — modelled as owner-borne */
  /* 7% municipality fee is guest-borne under standard operator structures and is
     therefore excluded from owner NOI. Confirm treatment in the operator agreement. */
  const permit   = 670;                        /* DET annual unit permit, 1BR band */
  const utilities= 13200;                      /* DEWA, chiller, connectivity, consumables */
  const capex    = furn / 4;                   /* furnishing amortised over four years */
  const strNet   = strGross - serviceCharge - opFee - opVat - tourism - permit - utilities - capex;

  const revpar = nightsBooked ? strGross / 365 : 0;

  return {P,size,serviceCharge,ltGross,ltMgmt,ltVoid,ltNet,
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
       <div class="noi-r"><span class="nk">Letting &amp; management (5%)</span><span class="nv neg">-${A(m.ltMgmt)}</span></div>
       <div class="noi-r"><span class="nk">Void allowance (1 month)</span><span class="nv neg">-${A(m.ltVoid)}</span></div>
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
  const breakevenOcc = m.occ ? (m.occ * (m.ltNet / m.strNet)) * 100 : 0;

  const head = document.getElementById('v-head');
  const body = document.getElementById('v-body');

  if(delta > 0){
    head.innerHTML = `STR clears long-term by <em>${A(delta)}</em> net`;
    body.textContent =
      `Gross revenue runs ${grossSpread.toFixed(0)}% above the contract rent, and ${(100 - (m.strNet/m.strGross*100)).toFixed(0)}% of that gross is consumed by operating friction. ` +
      `The arbitrage survives at this occupancy. It reverses below roughly ${Math.max(0, breakevenOcc).toFixed(0)}% — model the trough, not the peak.`;
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
['T-price','T-size','T-sc','T-rent','T-adr','T-occ','T-op','T-furn']
  .forEach(id=>{ const el = document.getElementById(id); if(el) el.addEventListener('input', renderSTR); });
renderSTR();

/* ═══════════════ TOOLS — ROI ═══════════════ */
const fmt = n => 'AED ' + Math.round(n).toLocaleString('en-US');
function calcROI(){
  const P = +document.getElementById('r-price').value || 0;
  const R = +document.getElementById('r-rent').value || 0;
  const S = +document.getElementById('r-sc').value || 0;
  const A = +document.getElementById('r-app').value;
  document.getElementById('r-app-v').textContent = A.toFixed(1);
  if(P<=0){ return; }
  const gross = R/P*100, net = (R-S)/P*100, monthly = (R-S)/12;
  const v5 = P*Math.pow(1+A/100,5);
  const total = ((v5-P) + (R-S)*5)/P*100;
  document.getElementById('r-gross').textContent = gross.toFixed(2)+'%';
  document.getElementById('r-net').textContent = net.toFixed(2)+'%';
  document.getElementById('r-monthly').textContent = fmt(monthly);
  document.getElementById('r-5y').textContent = fmt(v5);
  document.getElementById('r-total').textContent = '+'+total.toFixed(1)+'%';
}
['r-price','r-rent','r-sc','r-app'].forEach(id=> document.getElementById(id).addEventListener('input', calcROI));
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
/* AED per unit. USD is the fixed UAE peg. EUR and GBP start from last
   verified values and are replaced by ECB-derived rates on load. */
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
