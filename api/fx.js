// ═══════════════════════════════════════════════════════════════
// FX RATES — European Central Bank reference rates + UAE dollar peg
//
// AED is not quoted by the ECB, so rates are derived rather than taken:
//
//   AED/USD  = 3.6725          fixed by UAE Central Bank since 1997
//   AED/EUR  = (EUR/USD) × 3.6725
//   AED/GBP  = AED/EUR ÷ (EUR/GBP)
//
// Both inputs are official: ECB publishes the cross rates, the UAE Central
// Bank fixes the peg. No commercial FX provider sits in between.
//
// Source: api.frankfurter.app — ECB reference rates, free, no key required.
// ECB publishes once per working day around 16:00 CET.
// ═══════════════════════════════════════════════════════════════

const AED_PER_USD = 3.6725;   // UAE Central Bank peg — fixed, not a market rate

// Last verified values, used only if the ECB feed is unreachable.
// Never silently stale: the response always states which path was taken.
const FALLBACK = {
  date: '2026-08-04',
  aedPerEur: 4.2373,
  aedPerGbp: 4.9495,
};

export default async function handler(req, res) {
  // ECB publishes daily. A 6-hour edge cache keeps us current without
  // hammering a free public endpoint.
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP', {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error(`ECB feed returned ${r.status}`);

    const d = await r.json();
    const usdPerEur = Number(d?.rates?.USD);
    const gbpPerEur = Number(d?.rates?.GBP);

    if (!usdPerEur || !gbpPerEur) throw new Error('Incomplete rate payload');

    const aedPerEur = usdPerEur * AED_PER_USD;
    const aedPerGbp = aedPerEur / gbpPerEur;

    // Sanity band. A rate outside this range means the feed changed shape,
    // not that the market moved. Better to fall back than publish nonsense.
    if (aedPerEur < 3.2 || aedPerEur > 5.2 || aedPerGbp < 4.0 || aedPerGbp > 6.5) {
      throw new Error('Derived rate outside plausible band');
    }

    return res.status(200).json({
      ok: true,
      live: true,
      source: 'European Central Bank reference rates · UAE Central Bank peg',
      date: d.date,
      rates: {
        USD: AED_PER_USD,
        EUR: Number(aedPerEur.toFixed(4)),
        GBP: Number(aedPerGbp.toFixed(4)),
      },
      note: 'AED/USD is the fixed UAE peg. EUR and GBP are derived from ECB cross rates, published once per working day.',
    });

  } catch (err) {
    return res.status(200).json({
      ok: true,
      live: false,
      source: 'Last verified rates — ECB feed unavailable',
      date: FALLBACK.date,
      rates: { USD: AED_PER_USD, EUR: FALLBACK.aedPerEur, GBP: FALLBACK.aedPerGbp },
      note: `Live feed unreachable (${err.message}). Showing rates verified ${FALLBACK.date}.`,
    });
  }
}
