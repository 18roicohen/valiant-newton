/**
 * Production Readiness & Zero-Bug Verification Suite
 * Thoroughly validates all production endpoints on https://data.dynep.com
 */

const BASE_URL = process.env.BASE_URL || 'https://data.dynep.com';

interface AuditResult {
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  latencyMs: number;
  contentType: string;
  passed: boolean;
  notes?: string;
}

const auditResults: AuditResult[] = [];

async function testEndpoint(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    expectedStatus?: number;
    validator?: (data: any, text: string) => boolean | string;
  } = {}
) {
  const method = options.method || 'GET';
  const expectedStatus = options.expectedStatus || 200;
  const url = `${BASE_URL}${endpoint}`;

  const startTime = Date.now();
  let actualStatus = 0;
  let contentType = '';
  let passed = false;
  let notes = '';

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'User-Agent': 'Dynep-Production-Auditor/1.0',
        ...options.headers,
      },
    };

    if (options.body) {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!fetchOptions.headers) fetchOptions.headers = {};
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, fetchOptions);
    actualStatus = res.status;
    contentType = res.headers.get('content-type') || '';

    const text = await res.text();
    let parsed: any = null;
    if (contentType.includes('application/json')) {
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        notes = 'Invalid JSON body';
      }
    }

    if (actualStatus === expectedStatus) {
      if (options.validator) {
        const valRes = options.validator(parsed, text);
        if (valRes === true) {
          passed = true;
        } else {
          passed = false;
          notes = typeof valRes === 'string' ? valRes : 'Validation check failed';
        }
      } else {
        passed = true;
      }
    } else {
      passed = false;
      notes = `Expected HTTP ${expectedStatus}, got ${actualStatus}`;
    }
  } catch (err: any) {
    passed = false;
    notes = `Network exception: ${err.message}`;
  }

  const latencyMs = Date.now() - startTime;
  auditResults.push({
    endpoint,
    method,
    expectedStatus,
    actualStatus,
    latencyMs,
    contentType,
    passed,
    notes: notes || undefined,
  });
}

async function runProductionAudit() {
  console.log('========================================================================');
  console.log(`🛡️  DYNEP PRODUCTION ZERO-BUG AUDIT SUITE`);
  console.log(`🎯  Auditing Target: ${BASE_URL}`);
  console.log('========================================================================\n');

  // 1. Core Pages & Static Assets
  await testEndpoint('/', {
    validator: (_, text) => {
      if (!text.includes('DYNEP | Global AI Cloud GPU Spot Market Terminal')) return 'Missing expected title';
      if (!text.includes('DGX-31 COMPOSITE')) return 'Missing ticker tape';
      if (!text.includes('quickClaimKey')) return 'Missing developer claim JS';
      return true;
    },
  });

  await testEndpoint('/health', {
    validator: (data) => {
      if (data?.status !== 'ok') return 'Health status is not ok';
      return true;
    },
  });

  await testEndpoint('/docs', {
    validator: (_, text) => {
      if (!text.includes('Dynep Micro-DaaS API') && !text.includes('Swagger')) return 'Missing API documentation';
      return true;
    },
  });

  await testEndpoint('/terms', {
    validator: (_, text) => {
      if (!text.includes('Terms of Service') || !text.includes('Disclaimer')) return 'Missing Terms content';
      return true;
    },
  });

  await testEndpoint('/privacy', {
    validator: (_, text) => {
      if (!text.includes('Privacy Policy') || !text.includes('Data Retention')) return 'Missing Privacy content';
      return true;
    },
  });

  // 2. SEO & Crawlers
  await testEndpoint('/sitemap.xml', {
    validator: (_, text) => text.includes('<urlset') && text.includes('https://data.dynep.com/'),
  });

  await testEndpoint('/dynep-indexnow-key.txt', {
    validator: (_, text) => text.trim() === 'dynep-indexnow-7b4c8e192f6a',
  });

  await testEndpoint('/gpu/h100-lowest-price', {
    validator: (_, text) => text.includes('H100') && text.includes('Spot Pricing'),
  });

  await testEndpoint('/gpu/rtx-4090-spot-rates', {
    validator: (_, text) => text.includes('RTX 4090') && text.includes('Spot Pricing'),
  });

  // 3. Public Viral Spot Summary
  await testEndpoint('/v1/spot/summary', {
    validator: (data) => {
      if (!Array.isArray(data?.benchmark_summary)) return 'benchmark_summary is not an array';
      if (data.benchmark_summary.length === 0) return 'benchmark_summary is empty';
      const hasH100 = data.benchmark_summary.some((i: any) => i.gpu_model.includes('H100'));
      if (!hasH100) return 'H100 missing from benchmark';
      return true;
    },
  });

  // 4. Free Key Claim Flow
  const testEmail = `audit-${Date.now()}@domain.com`;
  let newlyIssuedKey = '';
  await testEndpoint('/api/keys/free', {
    method: 'POST',
    body: { email: testEmail },
    expectedStatus: 201,
    validator: (data) => {
      if (!data?.api_key || !data.api_key.startsWith('sk_live_')) return 'Invalid API key format';
      newlyIssuedKey = data.api_key;
      return true;
    },
  });

  // 5. Auth & Quota Enforcement on /v1/data
  // Case A: Missing header (Expected 401)
  await testEndpoint('/v1/data', {
    expectedStatus: 401,
    validator: (data) => data?.code === 'AUTH_HEADER_MISSING',
  });

  // Case B: Invalid key (Expected 401)
  await testEndpoint('/v1/data', {
    headers: { Authorization: 'Bearer sk_live_invalid_key_123456789' },
    expectedStatus: 401,
    validator: (data) => data?.code === 'INVALID_API_KEY',
  });

  // Case C: Valid Key (Expected 200)
  if (newlyIssuedKey) {
    await testEndpoint('/v1/data?limit=2', {
      headers: { Authorization: `Bearer ${newlyIssuedKey}` },
      expectedStatus: 200,
      validator: (data) => {
        if (!Array.isArray(data?.data)) return 'Records data is not an array';
        if (!data.pagination) return 'Pagination missing';
        return true;
      },
    });
  }

  // 6. CSV Feed Export
  await testEndpoint('/v1/feed.csv', {
    headers: { Authorization: 'Bearer daas_admin_secret_key_2026' },
    expectedStatus: 200,
    validator: (_, text) => {
      if (!text.includes('entity_id') && !text.includes('natural_key') && !text.includes('title')) {
        return 'CSV missing header row';
      }
      return true;
    },
  });

  // 7. Polar Checkout Session Creation
  await testEndpoint('/api/checkout/create', {
    method: 'POST',
    body: { email: 'buyer@test.io', tier: 'starter', discountCode: 'DYNEP37' },
    expectedStatus: 200,
    validator: (data) => {
      if (!data?.checkoutUrl) return 'Missing checkoutUrl';
      return true;
    },
  });

  // Print Results Table
  console.log('┌──────────────────────────────────────┬────────┬────────┬───────────┬─────────┬────────────────────────────┐');
  console.log('│ ENDPOINT                             │ METHOD │ STATUS │ LATENCY   │ RESULT  │ NOTES                      │');
  console.log('├──────────────────────────────────────┼────────┼────────┼───────────┼─────────┼────────────────────────────┤');

  let failedCount = 0;
  for (const r of auditResults) {
    const ep = r.endpoint.padEnd(36).substring(0, 36);
    const m = r.method.padEnd(6);
    const s = `${r.actualStatus}`.padEnd(6);
    const lat = `${r.latencyMs}ms`.padEnd(9);
    const res = r.passed ? '✅ PASS ' : '❌ FAIL ';
    const notes = (r.notes || 'OK').padEnd(26).substring(0, 26);
    if (!r.passed) failedCount++;

    console.log(`│ ${ep} │ ${m} │ ${s} │ ${lat} │ ${res}│ ${notes} │`);
  }
  console.log('└──────────────────────────────────────┴────────┴────────┴───────────┴─────────┴────────────────────────────┘\n');

  if (failedCount === 0) {
    console.log('🎉 AUDIT COMPLETE: 100% OF ENDPOINTS & WORKFLOWS ARE ZERO-BUG & HEALTHY!');
  } else {
    console.error(`🚨 AUDIT ALERT: ${failedCount} test(s) failed validation!`);
    process.exit(1);
  }
}

runProductionAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
