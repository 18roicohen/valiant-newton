import { TargetSchemaDefinition, ExtractedRecord } from '../db/schema.js';
import { generateEntityId } from './entityId.js';
import { generateContentHash } from './hash.js';

export interface RawExtractedItem {
  natural_key?: string | number | null;
  [key: string]: unknown;
}

export class Normalizer {
  /**
   * Normalizes a raw item according to the target schema definition.
   * Enforces Zero-Hallucination: Missing or unparseable fields are explicitly set to null.
   */
  static normalizeField(value: unknown, targetType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'): unknown {
    if (value === undefined || value === null) {
      return null;
    }

    switch (targetType) {
      case 'string': {
        const str = String(value).trim();
        return str.length > 0 ? str : null;
      }

      case 'number': {
        if (typeof value === 'number') {
          return Number.isFinite(value) ? value : null;
        }
        // Clean currency signs, commas, and trailing characters
        const cleaned = String(value).replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return Number.isFinite(num) ? num : null;
      }

      case 'boolean': {
        if (typeof value === 'boolean') return value;
        const lower = String(value).trim().toLowerCase();
        if (['true', '1', 'yes', 'in stock', 'active', 'available', 'y'].includes(lower)) {
          return true;
        }
        if (['false', '0', 'no', 'out of stock', 'inactive', 'unavailable', 'n'].includes(lower)) {
          return false;
        }
        return null;
      }

      case 'date': {
        if (value instanceof Date) {
          return !isNaN(value.getTime()) ? value.toISOString() : null;
        }
        const parsed = Date.parse(String(value));
        return !isNaN(parsed) ? new Date(parsed).toISOString() : null;
      }

      case 'array': {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
          return parts.length > 0 ? parts : null;
        }
        return null;
      }

      case 'object': {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return value;
        }
        return null;
      }

      default:
        return value ?? null;
    }
  }

  /**
   * Transforms a collection of raw scraped items into strictly validated ExtractedRecords
   */
  static processItems(
    sourceId: string,
    rawItems: RawExtractedItem[],
    targetSchema: TargetSchemaDefinition
  ): { validRecords: ExtractedRecord[]; discardedCount: number } {
    const validRecords: ExtractedRecord[] = [];
    let discardedCount = 0;

    for (const raw of rawItems) {
      const naturalKeyRaw = raw.natural_key ?? raw.id ?? raw.slug ?? raw.title ?? raw.sku;
      if (!naturalKeyRaw) {
        discardedCount++;
        continue;
      }

      const naturalKey = String(naturalKeyRaw).trim();
      if (!naturalKey) {
        discardedCount++;
        continue;
      }

      const normalizedData: Record<string, unknown> = {};

      // Normalize all expected fields according to schema
      for (const [fieldName, fieldType] of Object.entries(targetSchema)) {
        normalizedData[fieldName] = this.normalizeField(raw[fieldName], fieldType);
      }

      // Ensure natural_key is present in normalized payload
      normalizedData.natural_key = naturalKey;

      const entityId = generateEntityId(sourceId, naturalKey);
      const contentHash = generateContentHash(normalizedData);

      validRecords.push({
        entity_id: entityId,
        source_id: sourceId,
        natural_key: naturalKey,
        data: normalizedData,
        hash: contentHash,
        version: 1,
      });
    }

    return { validRecords, discardedCount };
  }
}
