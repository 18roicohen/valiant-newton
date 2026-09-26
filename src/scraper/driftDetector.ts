import { RawExtractedItem } from '../normalizer/normalizer.js';
import { TargetSchemaDefinition } from '../db/schema.js';

export type DriftReason =
  | 'EMPTY_RESULT'
  | 'MISSING_PRIMARY_KEY'
  | 'HIGH_NULL_RATIO'
  | 'ANOMALOUS_COUNT';

export interface DriftCheckResult {
  hasDrift: boolean;
  reason?: DriftReason;
  message?: string;
  nullRatio: number;
  extractedCount: number;
}

export class DriftDetector {
  /**
   * Evaluates extracted raw items against expected schema and historical thresholds
   */
  static evaluate(
    items: RawExtractedItem[],
    targetSchema: TargetSchemaDefinition,
    options: {
      minExpectedRecords?: number;
      maxAllowedNullRatio?: number;
      expectedPreviousCount?: number;
    } = {}
  ): DriftCheckResult {
    const {
      minExpectedRecords = 1,
      maxAllowedNullRatio = 0.5, // >50% null fields indicates selector drift
      expectedPreviousCount,
    } = options;

    const extractedCount = items.length;

    // 1. Check for empty extraction result
    if (extractedCount < minExpectedRecords) {
      return {
        hasDrift: true,
        reason: 'EMPTY_RESULT',
        message: `Fast-path extraction returned ${extractedCount} items (expected at least ${minExpectedRecords})`,
        nullRatio: 1.0,
        extractedCount,
      };
    }

    // 2. Check for anomalous count drop if previous baseline is known
    if (expectedPreviousCount && expectedPreviousCount >= 5) {
      const dropRatio = (expectedPreviousCount - extractedCount) / expectedPreviousCount;
      if (dropRatio >= 0.7) {
        // >70% drop in records
        return {
          hasDrift: true,
          reason: 'ANOMALOUS_COUNT',
          message: `Record count dropped from previous ${expectedPreviousCount} down to ${extractedCount} (${Math.round(dropRatio * 100)}% drop)`,
          nullRatio: 0,
          extractedCount,
        };
      }
    }

    // 3. Check for missing natural key / primary identifiers
    let missingKeyCount = 0;
    const expectsNaturalKey = Boolean(targetSchema.natural_key);

    for (const item of items) {
      const key = expectsNaturalKey
        ? item.natural_key
        : (item.natural_key ?? item.id ?? item.slug ?? item.sku);

      if (key === undefined || key === null || String(key).trim() === '') {
        missingKeyCount++;
      }
    }

    if (missingKeyCount / extractedCount > 0.3) {
      return {
        hasDrift: true,
        reason: 'MISSING_PRIMARY_KEY',
        message: `${missingKeyCount} of ${extractedCount} items lack primary keys/natural_keys`,
        nullRatio: missingKeyCount / extractedCount,
        extractedCount,
      };
    }

    // 4. Calculate null ratio across all expected fields
    const schemaFields = Object.keys(targetSchema);
    let totalFieldSlots = extractedCount * schemaFields.length;
    let nullFieldSlots = 0;

    for (const item of items) {
      for (const field of schemaFields) {
        const val = item[field];
        if (val === undefined || val === null || val === '') {
          nullFieldSlots++;
        }
      }
    }

    const nullRatio = totalFieldSlots > 0 ? nullFieldSlots / totalFieldSlots : 0;

    if (nullRatio > maxAllowedNullRatio) {
      return {
        hasDrift: true,
        reason: 'HIGH_NULL_RATIO',
        message: `Null field ratio is ${(nullRatio * 100).toFixed(1)}%, exceeding allowed threshold of ${(maxAllowedNullRatio * 100).toFixed(1)}%`,
        nullRatio,
        extractedCount,
      };
    }

    return {
      hasDrift: false,
      nullRatio,
      extractedCount,
    };
  }
}
