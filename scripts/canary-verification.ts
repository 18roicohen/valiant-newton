/**
 * Dynep Phase 2 Canary Verification Script
 * Validates full lifecycle: Key claim -> Authenticated consumption -> Metering -> Funnel telemetry
 */

async function runCanary() {
  const baseUrl = 'https://data.dynep.com';
  const testEmail = `canary-p2-${Date.now()}@dynep.com`;

  console.log(`[Canary] 1. Baseline Funnel Telemetry check...`);
  const initialFunnelRes = await fetch(`${baseUrl}/v1/metrics/funnel`);
  const initialFunnel = await initialFunnelRes.json();
  const initialMeteredQueries = initialFunnel.funnel_overview.total_metered_queries;
  const initialRegistered = initialFunnel.funnel_overview.total_accounts_registered;
  console.log(`[Canary]    Initial registered: ${initialRegistered}, Initial metered queries: ${initialMeteredQueries}`);

  console.log(`[Canary] 2. Claiming Free Trial Key for ${testEmail}...`);
  const claimRes = await fetch(`${baseUrl}/api/keys/free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });
  const claimData = await claimRes.json();
  if (!claimData.api_key) {
    throw new Error(`Failed to claim key: ${JSON.stringify(claimData)}`);
  }
  const apiKey = claimData.api_key;
  console.log(`[Canary]    Success! Issued API Key: ${apiKey.substring(0, 16)}...`);
  console.log(`[Canary]    Tier: ${claimData.tier}, Quota: ${claimData.monthly_quota}`);

  console.log(`[Canary] 3. Executing Authenticated Query against /v1/data...`);
  const queryRes = await fetch(`${baseUrl}/v1/data?search=H100&limit=2`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!queryRes.ok) {
    throw new Error(`Query failed with status ${queryRes.status}`);
  }
  const queryData = await queryRes.json();
  console.log(`[Canary]    Query succeeded! Retrieved ${queryData.data?.length} records.`);
  if (queryData.data?.[0]) {
    const topGpu = queryData.data[0];
    console.log(`[Canary]    Top GPU: ${topGpu.data?.title} at $${topGpu.data?.price}/hr on ${topGpu.data?.provider}`);
  }

  console.log(`[Canary] 4. Executing second query to verify metering counter increment...`);
  await fetch(`${baseUrl}/v1/data?search=4090&limit=1`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  console.log(`[Canary] 5. Verifying Funnel Telemetry update...`);
  const updatedFunnelRes = await fetch(`${baseUrl}/v1/metrics/funnel`);
  const updatedFunnel = await updatedFunnelRes.json();
  const updatedMeteredQueries = updatedFunnel.funnel_overview.total_metered_queries;
  const updatedRegistered = updatedFunnel.funnel_overview.total_accounts_registered;
  console.log(`[Canary]    Updated registered: ${updatedRegistered} (Delta: +${updatedRegistered - initialRegistered})`);
  console.log(`[Canary]    Updated metered queries: ${updatedMeteredQueries} (Delta: +${updatedMeteredQueries - initialMeteredQueries})`);

  if (updatedMeteredQueries > initialMeteredQueries && updatedRegistered > initialRegistered) {
    console.log(`\n🎉 [CANARY VERIFICATION PASSED] All systems verified end-to-end!`);
  } else {
    console.warn(`[Canary] Warning: Telemetry counters did not increment as expected.`);
  }
}

runCanary().catch((err) => {
  console.error(`[Canary Error]`, err);
  process.exit(1);
});
