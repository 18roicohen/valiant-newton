import { describe, it, expect } from 'vitest';
import { SelfHealingEngine } from '../src/selfHealing/healer.js';
import { SelectorMap, TargetSchemaDefinition } from '../src/db/schema.js';

describe('SelfHealingEngine', () => {
  const targetSchema: TargetSchemaDefinition = {
    title: 'string',
    price: 'number',
    category: 'string',
    natural_key: 'string',
  };

  const brokenSelectorMap: SelectorMap = {
    container: '.deprecated-nonexistent-card',
    fields: {
      natural_key: '.deprecated-id',
      title: 'h1.deprecated-title',
      price: '.deprecated-price',
    },
    version: 1,
  };

  const modernHtml = `
    <html>
      <body>
        <main>
          <div class="product-card" data-id="prod-gpu-4090">
            <h3 class="product-title">NVIDIA RTX 4090 OC</h3>
            <span class="product-price">$1,749.99</span>
            <span class="product-category">Graphics Cards</span>
          </div>
          <div class="product-card" data-id="prod-gpu-4080">
            <h3 class="product-title">NVIDIA RTX 4080 Super</h3>
            <span class="product-price">$999.00</span>
            <span class="product-category">Graphics Cards</span>
          </div>
        </main>
      </body>
    </html>
  `;

  it('synthesizes repaired selectors and extracts valid records from drifted DOM', async () => {
    const result = await SelfHealingEngine.heal(
      modernHtml,
      targetSchema,
      brokenSelectorMap,
      'Selectors returned 0 elements'
    );

    expect(result.success).toBe(true);
    expect(result.repairedRecords.length).toBeGreaterThanOrEqual(2);
    expect(result.repairedSelectorMap.version).toBe(2);
    expect(result.confidenceScore).toBeGreaterThan(0.5);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});
