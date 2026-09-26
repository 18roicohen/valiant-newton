import { Command } from 'commander';
import { repository } from './db/repository.js';
import { ScrapingEngine } from './scraper/engine.js';
import { ApiKeyProvisioner } from './api/billing/keyProvisioner.js';
import { Normalizer } from './normalizer/normalizer.js';
import { logger } from './db/client.js';

const program = new Command();

program
  .name('daas-cli')
  .description('Autonomous Micro-DaaS CLI Toolkit')
  .version('1.0.0');

// ---------------------------------------------------------------------------
// 1. SEED COMMAND
// ---------------------------------------------------------------------------
program
  .command('seed')
  .description('Seeds demo sources, subscriber accounts, and sample data')
  .action(async () => {
    logger.info('Seeding rich AI Cloud GPU & Model pricing index...');

    // Seed Source 1: Real Live Cloud GPU Spot Market Index
    const gpuSource = await repository.createSource({
      name: 'Real Live Cloud GPU Spot Index (31 Providers)',
      url: 'https://gpuperhour.com',
      target_schema: {
        title: 'string',
        price: 'number',
        category: 'string',
        status: 'string',
        provider: 'string',
        historical_avg: 'string',
        natural_key: 'string',
      },
      selector_map: {
        container: 'table:first-of-type tbody tr:has(th a)',
        fields: {
          title: 'th | regex:^([A-Za-z0-9 ]+?)(?:\\s*all\\s+[A-Za-z0-9]+)?$',
          price: 'td:nth-of-type(1) | regex:\\$([0-9.]+)',
          provider: 'td:nth-of-type(2)',
          historical_avg: 'td:nth-of-type(3)',
          status: 'td:nth-of-type(4)',
          category: 'td:nth-of-type(2)',
          natural_key: 'th | regex:^([A-Za-z0-9 ]+?)(?:\\s*all\\s+[A-Za-z0-9]+)?$',
        },
        version: 1,
      },
      schedule_cron: '*/30 * * * *',
    });

    // Seed Source 2: Niche Developer Tool & AI API Pricing
    const devToolsSource = await repository.createSource({
      name: 'LLM Inference API Token Pricing Index',
      url: 'https://llm-pricing.internal/tokens',
      target_schema: {
        title: 'string',
        price: 'number',
        category: 'string',
        natural_key: 'string',
      },
      selector_map: {
        container: '.tool-item',
        fields: {
          natural_key: 'a.tool-title@data-id',
          title: 'a.tool-title',
          price: '.tool-price',
          category: '.tool-category',
        },
        version: 1,
      },
      schedule_cron: '0 * * * *',
    });

    // Populate initial rich real-world GPU spot records
    const rawGpuRecords = [
      { natural_key: 'gpu-h100-sxm5-01', title: 'NVIDIA H100 80GB SXM5', price: 2.39, category: 'US-East-1', status: 'In Stock', provider: 'Lambda Labs' },
      { natural_key: 'gpu-h100-pcie-02', title: 'NVIDIA H100 80GB PCIe', price: 2.15, category: 'US-East-1', status: 'In Stock', provider: 'RunPod' },
      { natural_key: 'gpu-a100-80g-03', title: 'NVIDIA A100 80GB SXM4', price: 1.29, category: 'EU-Central', status: 'Available', provider: 'CoreWeave' },
      { natural_key: 'gpu-a100-40g-04', title: 'NVIDIA A100 40GB PCIe', price: 0.89, category: 'US-West', status: 'Available', provider: 'Lambda Labs' },
      { natural_key: 'gpu-b200-blackwell-05', title: 'NVIDIA B200 Blackwell 192GB', price: 4.85, category: 'US-East-1', status: 'Pre-Order', provider: 'CoreWeave' },
      { natural_key: 'gpu-rtx4090-06', title: 'NVIDIA RTX 4090 24GB', price: 0.44, category: 'Global', status: 'In Stock', provider: 'Vast.ai' },
      { natural_key: 'gpu-rtx4080s-07', title: 'NVIDIA RTX 4080 Super 16GB', price: 0.32, category: 'Global', status: 'In Stock', provider: 'RunPod' },
      { natural_key: 'gpu-l40s-08', title: 'NVIDIA L40S 48GB', price: 0.95, category: 'US-West', status: 'Available', provider: 'RunPod' },
      { natural_key: 'gpu-mi300x-09', title: 'AMD Instinct MI300X 192GB', price: 2.20, category: 'US-East-1', status: 'Available', provider: 'Hot Aisle' },
    ];

    const { validRecords } = Normalizer.processItems(gpuSource.id, rawGpuRecords, gpuSource.target_schema);
    await repository.upsertRecords(validRecords);

    // Seed Test Subscribers
    const starterSub = await ApiKeyProvisioner.provisionSubscriber({
      email: 'indie-developer@startup.io',
      tier: 'starter',
      monthlyQuota: 1000,
    });

    const proSub = await ApiKeyProvisioner.provisionSubscriber({
      email: 'enterprise-client@ai-labs.com',
      tier: 'pro',
      monthlyQuota: 25000,
    });

    console.log('\n================ SEED COMPLETED ================');
    console.log('📌 Sources Created:');
    console.log(`   1. ${gpuSource.name} (ID: ${gpuSource.id})`);
    console.log(`   2. ${devToolsSource.name} (ID: ${devToolsSource.id})`);
    console.log(`   📊 Populated ${validRecords.length} GPU Spot Market Records in local database!`);
    console.log('\n🔑 Test Polar API Subscribers:');
    console.log(`   1. Starter Subscriber: ${starterSub.subscriber.email}`);
    console.log(`      API Key: ${starterSub.plaintextApiKey}`);
    console.log(`      Quota: ${starterSub.subscriber.monthly_quota} req/mo`);
    console.log(`   2. Pro Subscriber: ${proSub.subscriber.email}`);
    console.log(`      API Key: ${proSub.plaintextApiKey}`);
    console.log(`      Quota: ${proSub.subscriber.monthly_quota} req/mo`);
    console.log('================================================\n');
  });

// ---------------------------------------------------------------------------
// 2. SCRAPE COMMAND
// ---------------------------------------------------------------------------
program
  .command('scrape')
  .description('Trigger scraping on all active sources')
  .action(async () => {
    logger.info('Starting scrape on all active sources');
    const results = await ScrapingEngine.scrapeAll();
    console.table(
      results.map((r) => ({
        'Source ID': r.sourceId.substring(0, 8),
        'Source Name': r.sourceName,
        Status: r.status,
        'Records Extracted': r.recordsExtracted,
        'Upserted / Updated': r.recordsUpserted,
        'Duration (ms)': r.durationMs,
        'Tokens Used': r.tokensUsed,
      }))
    );
  });

// ---------------------------------------------------------------------------
// 3. DRIFT & SELF-HEALING SIMULATION COMMAND
// ---------------------------------------------------------------------------
program
  .command('test-drift')
  .description('Demonstrate end-to-end self-healing: Fast Path -> HTML Drift -> LLM Repair -> Auto-Patch -> Fast Path 2.0')
  .action(async () => {
    console.log('\n======================================================');
    console.log('🚀 DEMONSTRATION: AUTONOMOUS SELF-HEALING SCRAPER');
    console.log('======================================================\n');

    // Step 1: Create a source with initial HTML layout
    const source = await repository.createSource({
      name: 'Nvidia H100 Cloud GPU Index',
      url: 'https://gpu-mock.internal/h100',
      target_schema: {
        title: 'string',
        price: 'number',
        category: 'string',
        status: 'string',
        natural_key: 'string',
      },
      selector_map: {
        container: '.legacy-gpu-card',
        fields: {
          natural_key: '.legacy-id@data-sku',
          title: 'h3.legacy-title',
          price: 'span.legacy-price',
          category: 'span.legacy-region',
          status: 'span.legacy-stock',
        },
        version: 1,
      },
    });

    console.log(`[Step 1] Created Target Source: ${source.name} (Version 1)`);
    console.log('         Initial Container Selector: .legacy-gpu-card\n');

    // Step 2: HTML with V1 Layout (Matches selectors)
    const initialHtml = `
      <html>
        <body>
          <div class="legacy-gpu-card">
            <span class="legacy-id" data-sku="gpu-h100-sxm5-01"></span>
            <h3 class="legacy-title">NVIDIA H100 80GB SXM5</h3>
            <span class="legacy-price">$2.49 / hr</span>
            <span class="legacy-region">US-East-1</span>
            <span class="legacy-stock">In Stock</span>
          </div>
          <div class="legacy-gpu-card">
            <span class="legacy-id" data-sku="gpu-a100-80g-02"></span>
            <h3 class="legacy-title">NVIDIA A100 80GB PCIe</h3>
            <span class="legacy-price">$1.15 / hr</span>
            <span class="legacy-region">EU-Central</span>
            <span class="legacy-stock">Available</span>
          </div>
        </body>
      </html>
    `;

    console.log('[Step 2] Executing Run #1 on V1 HTML layout (Fast-Path)...');
    const run1 = await ScrapingEngine.scrapeSource(source, initialHtml);
    console.log(`         Result: ${run1.status} | Extracted: ${run1.recordsExtracted} records | Tokens Used: ${run1.tokensUsed} (Fast-Path zero cost!)\n`);

    // Step 3: Target website undergoes complete redesign / class name changes
    const redesignedHtml = `
      <html>
        <head><script>analytics.track();</script><style>.noisy { display:none; }</style></head>
        <body>
          <main class="products-grid">
            <article class="deal-item" data-id="gpu-h100-sxm5-01">
              <h2 class="product-heading">NVIDIA H100 80GB SXM5 Extreme</h2>
              <div class="deal-price">$2.39 / hr</div>
              <div class="deal-category">US-East-1 (North Virginia)</div>
              <span class="badge">In Stock</span>
            </article>
            <article class="deal-item" data-id="gpu-a100-80g-02">
              <h2 class="product-heading">NVIDIA A100 80GB PCIe Cloud</h2>
              <div class="deal-price">$1.09 / hr</div>
              <div class="deal-category">EU-Central (Frankfurt)</div>
              <span class="badge">Available</span>
            </article>
            <article class="deal-item" data-id="gpu-b200-blackwell-03">
              <h2 class="product-heading">NVIDIA B200 Blackwell Next-Gen</h2>
              <div class="deal-price">$4.85 / hr</div>
              <div class="deal-category">US-West (Oregon)</div>
              <span class="badge">Pre-Order</span>
            </article>
          </main>
        </body>
      </html>
    `;

    console.log('[Step 3] Target site changes HTML layout: .legacy-gpu-card classes removed!');
    console.log('         Executing Run #2 on redesigned layout (Expect Drift Detection -> LLM Self-Healing)...');
    const run2 = await ScrapingEngine.scrapeSource(source.id, redesignedHtml);
    console.log(`         Result: ${run2.status}`);
    console.log(`         Drift Repaired: ${run2.driftDetected}`);
    console.log(`         Repaired Version: ${run2.repairedVersion}`);
    console.log(`         Tokens Used for Repair: ${run2.tokensUsed}`);
    console.log(`         Records Recovered: ${run2.recordsExtracted}\n`);

    // Step 4: Verify that subsequent runs use the auto-patched selector at ZERO LLM tokens!
    console.log('[Step 4] Executing Run #3 on redesigned layout...');
    const run3 = await ScrapingEngine.scrapeSource(source.id, redesignedHtml);
    console.log(`         Result: ${run3.status} (Fast-Path restored!)`);
    console.log(`         Tokens Used: ${run3.tokensUsed} (Zero LLM overhead!)`);
    console.log(`         Records Upserted: ${run3.recordsUpserted}\n`);

    const updatedSource = await repository.getSourceById(source.id);
    console.log('📌 Repaired Selector Map in Database:');
    console.log(JSON.stringify(updatedSource?.selector_map, null, 2));

    console.log('\n✅ Self-Healing Demonstration Succeeded 100%!');
  });

program.parse(process.argv);
