import crypto from 'crypto';

/**
 * Creates a deterministic SHA-256 hash of a normalized JSON payload.
 * Sorts object keys recursively to ensure canonical serialization.
 */
export function generateContentHash(data: Record<string, unknown>): string {
  const canonicalString = canonicalJsonStringify(data);
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Deterministic JSON stringifier that sorts object keys recursively
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return `${JSON.stringify(key)}:${canonicalJsonStringify(val)}`;
  });
  return '{' + pairs.join(',') + '}';
}
