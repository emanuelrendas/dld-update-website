/**
 * FX Rates Route Handler
 * Integrates with ECB reference rates + UAE peg with fallback.
 */

const AED_PER_USD = 3.6725;
const FALLBACK = {
  date: '2026-08-04',
  aedPerEur: 4.2373,
  aedPerGbp: 4.9495,
};

export async function handleFxRequest() {
  const headers = {
    'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
    'Content-Type': 'application/json',
  };

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

    if (aedPerEur < 3.2 || aedPerEur > 5.2 || aedPerGbp < 4.0 || aedPerGbp > 6.5) {
      throw new Error('Derived rate outside plausible band');
    }

    return {
      status: 200,
      headers,
      body: {
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
      },
    };
  } catch (err) {
    return {
      status: 200,
      headers,
      body: {
        ok: true,
        live: false,
        source: 'Last verified rates — ECB feed unavailable',
        date: FALLBACK.date,
        rates: { USD: AED_PER_USD, EUR: FALLBACK.aedPerEur, GBP: FALLBACK.aedPerGbp },
        note: `Live feed unreachable (${err.message}). Showing rates verified ${FALLBACK.date}.`,
      },
    };
  }
}
