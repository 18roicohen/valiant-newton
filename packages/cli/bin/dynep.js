#!/usr/bin/env node

/**
 * dynep-spot CLI
 * Real-time AI Cloud GPU Spot Market Terminal (DGX-31)
 * Usage:
 *   npx dynep-spot
 *   npx dynep-spot --gpu H100
 *   npx dynep-spot --claim user@domain.com
 *   npx dynep-spot --json
 */

const BASE_URL = process.env.DYNEP_API_URL || 'https://data.dynep.com';

const HELP_TEXT = `
  ⚡ DYNEP // Global AI Cloud GPU Spot Market Terminal (DGX-31)
  Live composite spot index across 31 cloud providers (AWS, Lambda, RunPod, Vast.ai, etc.)

  Usage:
    npx dynep-spot [options]
    dynep spot [options]

  Options:
    --gpu <model>      Filter spot rates by GPU model (e.g. H100, 4090, A100, B200)
    --json             Output raw JSON data for pipeline / jq consumption
    --claim <email>    Claim complimentary 100 req/mo Developer API Key
    --help             Show this help screen

  Examples:
    npx dynep-spot
    npx dynep-spot --gpu H100
    npx dynep-spot --claim dev@startup.ai
`;

async function fetchSpotSummary() {
  const res = await fetch(`${BASE_URL}/v1/spot/summary`);
  if (!res.ok) {
    throw new Error(`Failed to fetch live spot data: HTTP ${res.status}`);
  }
  return res.json();
}

async function claimApiKey(email) {
  const res = await fetch(`${BASE_URL}/api/keys/free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Claim failed: HTTP ${res.status}`);
  }
  return data;
}

function renderTable(items) {
  console.log('\n┌──────────────────────────────────────┬─────────────┬─────────────────┬───────────┬──────────────┐');
  console.log('│ GPU MODEL                            │ BEST SPOT   │ CHEAPEST HOST   │ AWS RATE  │ COST SAVINGS │');
  console.log('├──────────────────────────────────────┼─────────────┼─────────────────┼───────────┼──────────────┤');

  for (const item of items) {
    const model = (item.gpu_model || '').padEnd(36).substring(0, 36);
    const price = (`$${Number(item.spot_rate_hourly_usd).toFixed(2)}/h`).padEnd(11);
    const provider = (item.best_provider || '').padEnd(15).substring(0, 15);
    const aws = (`$${Number(item.aws_equivalent_rate_usd).toFixed(2)}/h`).padEnd(9);
    const savings = (`-${item.cost_savings_vs_aws_percent || '0%'}`).padEnd(12);

    console.log(`│ ${model} │ ${price} │ ${provider} │ ${aws} │ ${savings} │`);
  }

  console.log('└──────────────────────────────────────┴─────────────┴─────────────────┴───────────┴──────────────┘\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  // Handle Free Key Claim
  const claimIndex = args.indexOf('--claim');
  if (claimIndex !== -1) {
    const email = args[claimIndex + 1];
    if (!email || !email.includes('@')) {
      console.error('\n❌ Please provide a valid email address: npx dynep-spot --claim dev@domain.com\n');
      process.exit(1);
    }

    console.log(`\n🔑 Provisioning complimentary 100 req/mo Developer API Key for: ${email}...`);
    try {
      const result = await claimApiKey(email);
      console.log('\n======================================================');
      console.log('🎉 YOUR DYNEP DEVELOPER EVALUATION KEY IS READY:');
      console.log('======================================================');
      console.log(`API Key:  ${result.api_key || 'Already issued to this email'}`);
      console.log(`Quota:    ${result.monthly_quota || 100} requests / month`);
      console.log(`Tier:     ${(result.tier || 'free').toUpperCase()}`);
      console.log('\nTest your key right now:');
      console.log(`  curl -H "Authorization: Bearer ${result.api_key}" "${BASE_URL}/v1/data?limit=5"\n`);
      return;
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}\n`);
      process.exit(1);
    }
  }

  // Fetch Live Rates
  try {
    const data = await fetchSpotSummary();

    if (args.includes('--json')) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    let items = data.benchmark_summary || [];

    // Optional GPU filter
    const gpuFilterIndex = args.indexOf('--gpu');
    if (gpuFilterIndex !== -1 && args[gpuFilterIndex + 1]) {
      const filter = args[gpuFilterIndex + 1].toLowerCase();
      items = items.filter((i) => i.gpu_model.toLowerCase().includes(filter));
    }

    console.log('\n========================================================================================');
    console.log('⚡ DYNEP // GLOBAL AI CLOUD GPU SPOT MARKET INDEX (DGX-31)');
    console.log(`📡 Monitored Providers: 31 Cloud Hosts • Updated: ${new Date(data.timestamp).toLocaleTimeString()}`);
    console.log('========================================================================================');

    if (items.length === 0) {
      console.log('\nNo matching GPU instances found for your filter.');
    } else {
      renderTable(items);
    }

    console.log('💡 Quick Actions:');
    console.log('   - Filter GPU:   npx dynep-spot --gpu H100');
    console.log('   - Raw JSON:     npx dynep-spot --json');
    console.log('   - Free API Key: npx dynep-spot --claim you@domain.com');
    console.log('   - Web Terminal: https://data.dynep.com\n');

  } catch (err) {
    console.error(`\n❌ Could not connect to Dynep spot feed: ${err.message}\n`);
    process.exit(1);
  }
}

main();
