/**
 * RAIOC OS - Live Public Edge Verification
 * Validates that:
 * 1. https://www.emanuelrendas.com/ -> returns Landing Page HTML (index.html)
 * 2. https://dashboard.emanuelrendas.com/ -> returns Mission Control Dashboard HTML (dashboard.html)
 * 3. https://api.emanuelrendas.com/api/health -> returns API JSON
 * 4. https://api.emanuelrendas.com/status -> returns Executive Status JSON
 */

import https from 'node:https';

const testEndpoint = (url, expectedTitleOrKey, isJson = false) => new Promise((resolve) => {
  const req = https.get(url, {
    headers: {
      'User-Agent': 'RAIOC-Edge-Verifier/1.0',
      'Cache-Control': 'no-cache',
    },
    timeout: 8000,
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const match = data.includes(expectedTitleOrKey);
      console.log(`[GET ${url}]`);
      console.log(`  - Status:       HTTP ${res.statusCode}`);
      console.log(`  - Content-Type: ${res.headers['content-type']}`);
      console.log(`  - Match Found:  ${match ? '✅ YES' : '❌ NO'} ("${expectedTitleOrKey}")`);
      console.log(`  - Preview:      ${data.slice(0, 90).replace(/\n/g, ' ')}\n`);
      resolve({ url, statusCode: res.statusCode, match, isJson });
    });
  });

  req.on('error', (err) => {
    console.error(`[GET ${url}] Error: ${err.message}\n`);
    resolve({ url, statusCode: 0, error: err.message });
  });

  req.on('timeout', () => {
    req.destroy();
    console.error(`[GET ${url}] Timeout\n`);
    resolve({ url, statusCode: 0, error: 'TIMEOUT' });
  });
});

(async () => {
  console.log('================================================================================');
  console.log('🌐 RAIOC OS — LIVE PUBLIC EDGE RESOLUTION & ISOLATION VERIFICATION');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================================\n');

  // Test 1: Public Website (Landing Page)
  await testEndpoint('https://www.emanuelrendas.com/', 'Emanuel Rendas');

  // Test 2: Mission Control Dashboard
  await testEndpoint('https://dashboard.emanuelrendas.com/', 'Executive Command Center');

  // Test 3: API Health
  await testEndpoint('https://api.emanuelrendas.com/api/health', 'HEALTHY', true);

  // Test 4: Executive Status
  await testEndpoint('https://api.emanuelrendas.com/status', 'HEALTHY', true);

  console.log('================================================================================');
  console.log('🏁 EDGE VERIFICATION EXECUTION COMPLETE');
  console.log('================================================================================\n');
})();
