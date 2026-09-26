import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. SELECTOR MAP SCHEMA
// Maps container selectors and field extraction rules
// ---------------------------------------------------------------------------
export const FieldExtractionRuleSchema = z.union([
  z.string(), // e.g. "h3.title", "a.link@href", "span.price | regex:(\$?\d+(\.\d+)?)"
  z.object({
    selector: z.string(),
    attribute: z.string().optional(), // e.g. "href", "src", "data-id"
    regex: z.string().optional(),
    transform: z.enum(['text', 'number', 'boolean', 'date', 'array', 'json']).default('text'),
    default: z.any().optional(),
  }),
]);

export type FieldExtractionRule = z.infer<typeof FieldExtractionRuleSchema>;

export const SelectorMapSchema = z.object({
  container: z.string().min(1, 'Container selector is required'), // e.g. ".product-card" or "//div[@class='item']"
  fields: z.record(z.string(), FieldExtractionRuleSchema),
  pagination: z.object({
    nextPageSelector: z.string().optional(),
    maxPages: z.number().int().positive().default(1),
  }).optional(),
  version: z.number().int().default(1),
});

export type SelectorMap = z.infer<typeof SelectorMapSchema>;

// ---------------------------------------------------------------------------
// 2. TARGET SCHEMA SPECIFICATION
// Defines the expected output entity shape
// ---------------------------------------------------------------------------
export const TargetSchemaDefinitionSchema = z.record(
  z.string(),
  z.enum(['string', 'number', 'boolean', 'date', 'array', 'object'])
);

export type TargetSchemaDefinition = z.infer<typeof TargetSchemaDefinitionSchema>;

// ---------------------------------------------------------------------------
// 3. SOURCE SCHEMA
// ---------------------------------------------------------------------------
export const SourceStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'DRIFT_DETECTED', 'ERROR']);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const SourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url(),
  target_schema: TargetSchemaDefinitionSchema.default({
    title: 'string',
    price: 'number',
    category: 'string',
    natural_key: 'string',
  }),
  selector_map: SelectorMapSchema,
  schedule_cron: z.string().default('0 * * * *'),
  headers: z.record(z.string(), z.string()).default({}),
  status: SourceStatusSchema.default('ACTIVE'),
  last_run_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

// ---------------------------------------------------------------------------
// 4. EXTRACTED RECORD SCHEMA
// ---------------------------------------------------------------------------
export const ExtractedRecordSchema = z.object({
  entity_id: z.string().length(64), // SHA-256
  source_id: z.string().uuid(),
  natural_key: z.string().min(1),
  data: z.record(z.string(), z.any()),
  hash: z.string().length(64),
  version: z.number().int().default(1),
  first_seen_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ExtractedRecord = z.infer<typeof ExtractedRecordSchema>;

// ---------------------------------------------------------------------------
// 5. API SUBSCRIBER SCHEMA
// ---------------------------------------------------------------------------
export const SubscriberTierSchema = z.enum(['free', 'starter', 'pro', 'enterprise']);
export type SubscriberTier = z.infer<typeof SubscriberTierSchema>;

export const ApiSubscriberSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().nullable().optional(),
  email: z.string().email(),
  api_key_hash: z.string().length(64),
  api_key_prefix: z.string(),
  tier: SubscriberTierSchema.default('starter'),
  monthly_quota: z.number().int().positive().default(1000),
  current_usage: z.number().int().nonnegative().default(0),
  rate_limit_rpm: z.number().int().positive().default(60),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ApiSubscriber = z.infer<typeof ApiSubscriberSchema>;

// ---------------------------------------------------------------------------
// 6. EXTRACTION LOG SCHEMA
// ---------------------------------------------------------------------------
export const ExtractionStatusSchema = z.enum(['SUCCESS', 'DRIFT_REPAIRED', 'FAILED']);
export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

export const ExtractionLogSchema = z.object({
  id: z.string().uuid().optional(),
  source_id: z.string().uuid(),
  status: ExtractionStatusSchema,
  records_count: z.number().int().nonnegative().default(0),
  duration_ms: z.number().int().nonnegative().default(0),
  tokens_used: z.number().int().nonnegative().default(0),
  drift_detected: z.boolean().default(false),
  error_message: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  created_at: z.string().datetime().optional(),
});

export type ExtractionLog = z.infer<typeof ExtractionLogSchema>;

// ---------------------------------------------------------------------------
// 7. SELF-HEALING & REPAIR SCHEMAS
// ---------------------------------------------------------------------------
export const RepairOutputSchema = z.object({
  extracted_items: z.array(z.record(z.string(), z.any())),
  suggested_patch: z.object({
    container: z.string(),
    fields: z.record(z.string(), z.string()),
    confidence_score: z.number().min(0).max(1),
    repair_notes: z.string().optional(),
  }),
});

export type RepairOutput = z.infer<typeof RepairOutputSchema>;

// ---------------------------------------------------------------------------
// 8. API QUERY & FILTER SCHEMAS
// ---------------------------------------------------------------------------
export const DataQueryFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(250).default(50),
  source_id: z.string().uuid().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  since: z.string().datetime().optional(),
  sort_by: z.enum(['updated_at', 'first_seen_at', 'version']).default('updated_at'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
});

export type DataQueryFilter = z.infer<typeof DataQueryFilterSchema>;
