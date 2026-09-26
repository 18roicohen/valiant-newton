import { describe, it, expect } from 'vitest';
import { Normalizer } from '../src/normalizer/normalizer.js';
import { generateEntityId } from '../src/normalizer/entityId.js';
import { generateContentHash, canonicalJsonStringify } from '../src/normalizer/hash.js';
import { TargetSchemaDefinition } from '../src/db/schema.js';

describe('Normalizer & Entity Identifiers', () => {
  const sourceId = '4b1b369c-9c98-4c8d-8a21-42008681d89b';

  it('generates deterministic SHA-256 entity_id for idempotent storage', () => {
    const id1 = generateEntityId(sourceId, 'item-sku-12345');
    const id2 = generateEntityId(sourceId, 'item-sku-12345');
    const id3 = generateEntityId(sourceId, 'item-sku-99999');

    expect(id1).toHaveLength(64);
    expect(id1).toEqual(id2);
    expect(id1).not.toEqual(id3);
  });

  it('generates canonical content hash invariant to key ordering', () => {
    const data1 = { b: 2, a: 1, c: { y: 'bar', x: 'foo' } };
    const data2 = { c: { x: 'foo', y: 'bar' }, a: 1, b: 2 };

    const hash1 = generateContentHash(data1);
    const hash2 = generateContentHash(data2);

    expect(hash1).toEqual(hash2);
  });

  it('enforces zero hallucination: parses numbers, booleans, and maps missing values to null', () => {
    const targetSchema: TargetSchemaDefinition = {
      title: 'string',
      price: 'number',
      in_stock: 'boolean',
      category: 'string',
      notes: 'string',
      natural_key: 'string',
    };

    const rawItems = [
      {
        natural_key: 'SKU-001',
        title: '  Super Gaming PC  ',
        price: ' $1,899.99 USD ',
        in_stock: 'In Stock',
        category: 'Computers',
        notes: '', // empty string should become null
      },
      {
        id: 'SKU-002', // falls back to id
        title: 'Mechanical Keyboard',
        price: 'not a number', // invalid number should become null
        in_stock: 'No',
        category: null,
      },
    ];

    const { validRecords, discardedCount } = Normalizer.processItems(sourceId, rawItems, targetSchema);

    expect(discardedCount).toBe(0);
    expect(validRecords).toHaveLength(2);

    expect(validRecords[0].data).toEqual({
      natural_key: 'SKU-001',
      title: 'Super Gaming PC',
      price: 1899.99,
      in_stock: true,
      category: 'Computers',
      notes: null, // Zero hallucination null preservation
    });

    expect(validRecords[1].data).toEqual({
      natural_key: 'SKU-002',
      title: 'Mechanical Keyboard',
      price: null,
      in_stock: false,
      category: null,
      notes: null,
    });
  });
});
