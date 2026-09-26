import { describe, it, expect } from 'vitest';
import { repository } from '../src/db/repository.js';
import { ScrapingEngine } from '../src/scraper/engine.js';
import { buildServer } from '../src/api/server.js';
import { ApiKeyProvisioner } from '../src/api/billing/keyProvisioner.js';

describe('Autonomous End-to-End Pipeline & API Lifecycle', () => {
  it('executes full cycle: Fast-Path -> Drift -> Self-Healing -> Patch -> Storage -> API Consumption', async () => {
    // 1. Setup Source
    const source = await repository.createSource({
      name: 'E2E Test Tech Deals',
      url: 'https://test-site.internal/deals',
      target_schema: {
        title: 'string',
        price: 'number',
        category: 'string',
        status: 'string',
        natural_key: 'string',
      },
      selector_map: {
        container: '.legacy-card',
        fields: {
          natural_key: '.legacy-id@data-id',
          title: 'h2.legacy-title',
          price: 'span.legacy-price',
          category: 'span.legacy-tag',
          status: 'span.legacy-avail',
        },
        version: 1,
      },
    });

    const v1Html = `
      <html>
        <body>
          <div class="legacy-card">
            <span class="legacy-id" data-id="item-e2e-101"></span>
            <h2 class="legacy-title">Fast SSD 2TB</h2>
            <span class="legacy-price">$149.99</span>
            <span class="legacy-tag">Storage</span>
            <span class="legacy-avail">In Stock</span>
          </div>
        </body>
      </html>
    `;

    // 2. Run 1: Fast-Path
    const run1 = await ScrapingEngine.scrapeSource(source, v1Html);
    expect(run1.status).toBe('SUCCESS');
    expect(run1.recordsExtracted).toBe(1);
    expect(run1.tokensUsed).toBe(0);

    // 3. Drift HTML Layout
    const v2Html = `
      <html>
        <head><script>noisy()</script></head>
        <body>
          <div class="deal-card" data-id="item-e2e-101">
            <h3 class="deal-title">Fast SSD 2TB NVMe Gen4</h3>
            <span class="deal-price">$139.99</span>
            <span class="deal-category">Storage</span>
            <span class="deal-status">In Stock</span>
          </div>
          <div class="deal-card" data-id="item-e2e-102">
            <h3 class="deal-title">DDR5 RAM 64GB</h3>
            <span class="deal-price">$199.99</span>
            <span class="deal-category">Memory</span>
            <span class="deal-status">Available</span>
          </div>
        </body>
      </html>
    `;

    // 4. Run 2: Drift triggers Self-Healing & Auto-Patch
    const run2 = await ScrapingEngine.scrapeSource(source.id, v2Html);
    expect(run2.status).toBe('DRIFT_REPAIRED');
    expect(run2.driftDetected).toBe(true);
    expect(run2.recordsExtracted).toBe(2);
    expect(run2.tokensUsed).toBeGreaterThan(0);

    // 5. Run 3: Subsequent run on new layout executes via fast-path at zero LLM cost!
    const run3 = await ScrapingEngine.scrapeSource(source.id, v2Html);
    expect(run3.status).toBe('SUCCESS');
    expect(run3.tokensUsed).toBe(0);
    expect(run3.recordsExtracted).toBe(2);

    // 6. Test Public API Access to newly scraped and normalized records
    const app = await buildServer();
    const subscriber = await ApiKeyProvisioner.provisionSubscriber({
      email: 'consumer@daas.io',
      tier: 'pro',
    });

    const apiRes = await app.inject({
      method: 'GET',
      url: `/v1/data?source_id=${source.id}`,
      headers: { Authorization: `Bearer ${subscriber.plaintextApiKey}` },
    });

    expect(apiRes.statusCode).toBe(200);
    const json = apiRes.json();
    expect(json.data.length).toBe(2);
    expect(json.data[0].data.natural_key).toBeDefined();
    expect(typeof json.data[0].data.price).toBe('number');
  });
});
