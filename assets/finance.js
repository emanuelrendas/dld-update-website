/* ═══════════════════════════════════════════════════════════════════════
   SHARED FINANCE ENGINE

   One definition of yield for the whole site. Before this file existed the
   Quick ROI panel, the Investment Lab and the STR model each deducted a
   different set of costs and returned a different "net yield" for the same
   property — the Quick ROI figure was the most generous and the least
   labelled. A visitor comparing two panels got two answers and no
   explanation.

   ─────────────── THE ONE DEFINITION ───────────────

     Net operating income
       = gross rental income
       − vacancy allowance
       − service charge
       − property management
       − maintenance allowance

     Net yield = net operating income ÷ purchase price

   Acquisition costs (DLD 4%, agency, registration) and financing costs
   (mortgage interest) are DELIBERATELY EXCLUDED from operating yield. They
   are real costs, but they belong to the acquisition and the capital
   structure, not to the operation of the asset. Folding them into a yield
   figure makes it incomparable with every published yield in the market.

   They are modelled separately in allInReturn(), where the assumptions are
   stated rather than buried.

   ─────────────── CLASSIFICATION ───────────────

   Everything this file produces is MODELLED or USER INPUT. Nothing here is
   an official statistic and nothing here may be presented as one. The
   operating ratios below are assumptions — defaults a visitor can change,
   not market measurements.

   ═══════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  /* Operating assumptions. Defaults only — every one is editable on the
     page, and every one is labelled as an assumption beside its field. */
  const ASSUMPTIONS = {
    vacancyPct: 1 / 12,   /* one month a year between tenancies */
    mgmtPct:    0.05,     /* letting and management, share of gross rent */
    maintPct:   0.05,     /* maintenance, renewals, minor capex */
  };

  /* Statutory acquisition costs. These ARE official — DLD and Dubai Land
     Department registration schedules — but they are inputs to a model,
     not a market statistic. */
  const ACQUISITION = {
    dldPct:       0.04,    /* DLD transfer fee — official */
    agencyPct:    0.02,    /* market-standard agency commission */
    mortgageReg:  0.0025,  /* mortgage registration, share of loan — official */
    regFeeOver:   4000,    /* registration fee above AED 500,000 — official */
    regFeeUnder:  2000,    /* registration fee at or below AED 500,000 */
    regThreshold: 500000,
  };

  const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

  /* ─────────── operating ─────────── */

  /* Gross yield — rent before any deduction, over price. The figure the
     market quotes, and the only one directly comparable to a listing. */
  function grossYield(rent, price) {
    return price > 0 ? num(rent) / num(price) * 100 : 0;
  }

  /* Net operating income. Every deduction is returned alongside the total
     so a panel can show the bridge and have it reconcile — the displayed
     lines ARE the calculation, never a separate hardcoded figure. */
  function noi(o) {
    const rent          = num(o.rent);
    const serviceCharge = num(o.serviceCharge);
    const vacancy       = rent * (o.vacancyPct ?? ASSUMPTIONS.vacancyPct);
    const management    = rent * (o.mgmtPct    ?? ASSUMPTIONS.mgmtPct);
    const maintenance   = rent * (o.maintPct   ?? ASSUMPTIONS.maintPct);
    const total         = rent - vacancy - serviceCharge - management - maintenance;
    return { rent, vacancy, serviceCharge, management, maintenance, total };
  }

  function netYield(o, price) {
    const p = num(price);
    return p > 0 ? noi(o).total / p * 100 : 0;
  }

  /* ─────────── acquisition ─────────── */

  /* What it costs to get the asset onto your balance sheet. Kept out of
     yield on purpose; surfaced here so a panel can show it as its own line
     rather than smuggling it into a percentage. */
  function acquisitionCosts(price, loan, other = 0) {
    const p = num(price), l = num(loan);
    const dld        = p * ACQUISITION.dldPct;
    const agency     = p * ACQUISITION.agencyPct;
    const mortgage   = l * ACQUISITION.mortgageReg;
    const regFee     = p > ACQUISITION.regThreshold ? ACQUISITION.regFeeOver
                                                    : ACQUISITION.regFeeUnder;
    /* Trustee office, developer NOC, mortgage valuation and bank arrangement
       fees all sit here. They are real and they are not small, but they vary
       by trustee, developer and lender, so this model does not assume a
       figure for them — it exposes the line and defaults it to zero. A zero
       the visitor can see and change is honest; an invented default that
       quietly flatters cash-on-cash is not. */
    const otherCost  = num(other);
    return { dld, agency, mortgage, regFee, other: otherCost,
             total: dld + agency + mortgage + regFee + otherCost };
  }

  /* ─────────── financing ─────────── */

  function monthlyPayment(principal, annualRate, years) {
    const P = num(principal);
    if (P <= 0) return 0;
    const r = num(annualRate) / 100 / 12, n = num(years) * 12;
    if (n <= 0) return 0;
    if (r === 0) return P / n;
    return P * r / (1 - Math.pow(1 + r, -n));
  }

  function loanBalance(principal, annualRate, years, monthsPaid) {
    const P = num(principal);
    if (P <= 0) return 0;
    const r = num(annualRate) / 100 / 12, n = num(years) * 12;
    if (monthsPaid >= n) return 0;
    if (r === 0) return P * (1 - monthsPaid / n);
    const pmt = monthlyPayment(P, annualRate, years);
    return P * Math.pow(1 + r, monthsPaid) - pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r);
  }

  /* IRR by bisection — robust, no derivative, no library. */
  function irr(flows) {
    const npv = (r) => flows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
    let lo = -0.95, hi = 3;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2 * 100;
  }

  /* ─────────── all-in return ───────────
     A different question from net yield, and labelled as one: what the
     equity returns over a hold, after acquisition costs, debt service and
     an exit. Appreciation is a USER ASSUMPTION and defaults to zero —
     a pre-filled growth rate is a forecast, and this site does not
     publish forecasts. */
  function allInReturn(o) {
    const price = num(o.price);
    const loan  = price * (num(o.ltvPct) / 100);
    const down  = price - loan;
    const acq   = acquisitionCosts(price, loan, o.otherCosts);
    const cashIn = down + acq.total;

    const operating = noi(o);
    const debtYear  = monthlyPayment(loan, o.rate, o.term) * 12;
    const cashFlow  = operating.total - debtYear;

    const years    = num(o.years);
    const appr     = num(o.appreciationPct);   /* user assumption, 0 by default */
    const exitVal  = price * Math.pow(1 + appr / 100, years);
    const balance  = loanBalance(loan, o.rate, o.term, years * 12);
    const sellCost = exitVal * (o.sellingCostPct ?? 0.02);
    const netProceeds = exitVal - balance - sellCost;

    const profit = netProceeds - cashIn + cashFlow * years;

    const flows = [-cashIn];
    for (let i = 1; i <= years; i++) flows.push(i === years ? cashFlow + netProceeds : cashFlow);

    return {
      price, loan, down, acquisition: acq, cashIn,
      operating, debtYear, cashFlow,
      exitVal, balance, sellCost, netProceeds,
      profit,
      totalReturnPct: cashIn > 0 ? profit / cashIn * 100 : 0,
      /* The total is cumulative over the whole hold. Shown beside an IRR
         without that said out loud, a five-year +64% reads as annual. The
         annualised equivalent is the compound rate on equity; it is
         undefined once the equity is entirely lost, and returns null rather
         than a number in that case. */
      annualisedPct: (() => {
        if (!(cashIn > 0) || !(years > 0)) return null;
        const multiple = 1 + profit / cashIn;
        return multiple <= 0 ? null : (Math.pow(multiple, 1 / years) - 1) * 100;
      })(),
      cashOnCashPct:  cashIn > 0 ? cashFlow / cashIn * 100 : 0,
      irrPct: irr(flows),
      years, appreciationPct: appr,
    };
  }

  root.Finance = {
    ASSUMPTIONS, ACQUISITION,
    grossYield, noi, netYield,
    acquisitionCosts, monthlyPayment, loanBalance, irr, allInReturn,
  };
})(window);
