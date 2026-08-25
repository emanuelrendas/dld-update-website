/**
 * RAIOC API - IKL Routes
 * Endpoints for frontend to query Institutional Knowledge Layer data (communities, developers, tax, regulations, personas).
 */

import { ikl } from '../../core/ikl/index.js';

export async function handleIklRequest(path, query = {}) {
  const normalized = path.replace(/^\/api\/ikl\/?/, '');

  if (normalized === '' || normalized === 'version') {
    return {
      status: 200,
      body: {
        version: ikl.getVersion(),
        metadata: ikl.getVersionMetadata(),
      },
    };
  }

  if (normalized.startsWith('communities')) {
    const parts = normalized.split('/');
    if (parts[1]) {
      const community = ikl.getCommunity(parts[1]);
      if (!community) return { status: 404, body: { error: 'Community not found' } };
      return { status: 200, body: community };
    }
    return { status: 200, body: ikl.getCommunities() };
  }

  if (normalized.startsWith('developers')) {
    const parts = normalized.split('/');
    if (parts[1]) {
      const dev = ikl.getDeveloper(parts[1]);
      if (!dev) return { status: 404, body: { error: 'Developer not found' } };
      return { status: 200, body: dev };
    }
    return { status: 200, body: ikl.getDevelopers() };
  }

  if (normalized.startsWith('regulations')) {
    const parts = normalized.split('/');
    if (parts[1]) {
      const reg = ikl.getRegulation(parts[1]);
      if (!reg) return { status: 404, body: { error: 'Regulation not found' } };
      return { status: 200, body: reg };
    }
    return { status: 200, body: ikl.getRegulations() };
  }

  if (normalized.startsWith('tax')) {
    const parts = normalized.split('/');
    if (parts[1]) {
      const taxRule = ikl.getTaxRule(parts[1]);
      if (!taxRule) return { status: 404, body: { error: 'Tax rule not found' } };
      return { status: 200, body: taxRule };
    }
    return { status: 200, body: ikl.getTaxRules() };
  }

  if (normalized.startsWith('personas')) {
    return { status: 200, body: ikl.getPersonas() };
  }

  if (normalized.startsWith('strategies')) {
    return { status: 200, body: ikl.getStrategies() };
  }

  return { status: 404, body: { error: `Unknown IKL path: ${path}` } };
}
