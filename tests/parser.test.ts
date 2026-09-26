import { describe, it, expect } from 'vitest';
import { FastPathParser } from '../src/scraper/parser.js';
import { SelectorMap } from '../src/db/schema.js';

describe('FastPathParser', () => {
  const sampleHtml = `
    <div class="catalog">
      <div class="product-item" data-sku="SKU-1001">
        <h2 class="title">MacBook Pro M3 Max</h2>
        <span class="price">$3,499.00 USD</span>
        <a class="buy-link" href="/buy/macbook-pro">Buy Now</a>
        <span class="status in-stock">In Stock</span>
      </div>
      <div class="product-item" data-sku="SKU-1002">
        <h2 class="title">Dell XPS 16</h2>
        <span class="price">$2,299.00 USD</span>
        <a class="buy-link" href="/buy/dell-xps">Buy Now</a>
        <span class="status out-of-stock">Backorder</span>
      </div>
    </div>
  `;

  it('extracts text, attributes, and regex fields accurately', () => {
    const selectorMap: SelectorMap = {
      container: '.product-item',
      fields: {
        natural_key: '.@data-sku',
        title: 'h2.title',
        price: 'span.price | regex:\\$([0-9,.]+)',
        url: 'a.buy-link@href',
        status: 'span.status',
      },
      version: 1,
    };

    const results = FastPathParser.parse(sampleHtml, selectorMap);
    expect(results).toHaveLength(2);

    expect(results[0]).toEqual({
      natural_key: 'SKU-1001',
      title: 'MacBook Pro M3 Max',
      price: '3,499.00',
      url: '/buy/macbook-pro',
      status: 'In Stock',
    });

    expect(results[1]).toEqual({
      natural_key: 'SKU-1002',
      title: 'Dell XPS 16',
      price: '2,299.00',
      url: '/buy/dell-xps',
      status: 'Backorder',
    });
  });

  it('returns null for missing fields without throwing errors', () => {
    const selectorMap: SelectorMap = {
      container: '.product-item',
      fields: {
        title: 'h2.title',
        nonExistentField: '.non-existent-class',
      },
      version: 1,
    };

    const results = FastPathParser.parse(sampleHtml, selectorMap);
    expect(results).toHaveLength(2);
    expect(results[0].nonExistentField).toBeNull();
  });
});
