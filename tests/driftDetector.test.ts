import { describe, it, expect } from 'vitest';
import { DriftDetector } from '../src/scraper/driftDetector.js';
import { TargetSchemaDefinition } from '../src/db/schema.js';

describe('DriftDetector', () => {
  const schema: TargetSchemaDefinition = {
    title: 'string',
    price: 'number',
    category: 'string',
    natural_key: 'string',
  };

  it('detects EMPTY_RESULT when 0 items are extracted', () => {
    const result = DriftDetector.evaluate([], schema);
    expect(result.hasDrift).toBe(true);
    expect(result.reason).toBe('EMPTY_RESULT');
  });

  it('detects MISSING_PRIMARY_KEY when natural keys are missing', () => {
    const items = [
      { title: 'Item 1', price: 10, category: 'A', natural_key: null },
      { title: 'Item 2', price: 20, category: 'B', natural_key: null },
    ];
    const result = DriftDetector.evaluate(items, schema);
    expect(result.hasDrift).toBe(true);
    expect(result.reason).toBe('MISSING_PRIMARY_KEY');
  });

  it('detects HIGH_NULL_RATIO when most fields are null', () => {
    const items = [
      { natural_key: 'k1', title: null, price: null, category: null },
      { natural_key: 'k2', title: null, price: null, category: null },
    ];
    const result = DriftDetector.evaluate(items, schema, { maxAllowedNullRatio: 0.5 });
    expect(result.hasDrift).toBe(true);
    expect(result.reason).toBe('HIGH_NULL_RATIO');
  });

  it('detects ANOMALOUS_COUNT drop compared to historical baseline', () => {
    const items = [{ natural_key: 'k1', title: 'Item 1', price: 10, category: 'Tech' }];
    const result = DriftDetector.evaluate(items, schema, { expectedPreviousCount: 10 });
    expect(result.hasDrift).toBe(true);
    expect(result.reason).toBe('ANOMALOUS_COUNT');
  });

  it('returns hasDrift = false for healthy extracted items', () => {
    const items = [
      { natural_key: 'k1', title: 'Product 1', price: 29.99, category: 'Hardware' },
      { natural_key: 'k2', title: 'Product 2', price: 49.99, category: 'Hardware' },
    ];
    const result = DriftDetector.evaluate(items, schema);
    expect(result.hasDrift).toBe(false);
  });
});
