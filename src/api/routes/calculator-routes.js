/**
 * RAIOC API - Calculator Routes
 * Endpoints for frontend calculators to execute live calculations grounded in IKL assumptions.
 */

import { propertyCalculators } from '../calculators/property-calculators.js';

export async function handleCalculatorRequest(path, payload = {}) {
  const normalized = path.replace(/^\/api\/calculators\/?/, '');

  if (normalized === 'acquisition' || normalized === 'acquisition-cost') {
    const result = propertyCalculators.calculateAcquisitionCost(payload);
    return { status: 200, body: result };
  }

  if (normalized === 'golden-visa') {
    const result = propertyCalculators.calculateGoldenVisaEligibility(payload);
    return { status: 200, body: result };
  }

  if (normalized === 'rental-yield' || normalized === 'yield') {
    const result = propertyCalculators.calculateRentalYield(payload);
    return { status: 200, body: result };
  }

  return { status: 404, body: { error: `Unknown calculator endpoint: ${path}` } };
}
