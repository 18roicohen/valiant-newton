import fs from 'fs';
import path from 'path';
import { getSupabaseClient, logger } from './client.js';
import {
  Source,
  ExtractedRecord,
  ApiSubscriber,
  ExtractionLog,
  DataQueryFilter,
  SelectorMap,
  SourceStatus,
  TargetSchemaDefinition,
} from './schema.js';

export interface CreateSourceInput {
  id?: string;
  name: string;
  url: string;
  selector_map: SelectorMap;
  target_schema?: TargetSchemaDefinition;
  schedule_cron?: string;
  headers?: Record<string, string>;
  status?: SourceStatus;
  last_run_at?: string | null;
}

export interface IRepository {
  // Source operations
  getActiveSources(): Promise<Source[]>;
  getAllSources(): Promise<Source[]>;
  getSourceById(id: string): Promise<Source | null>;
  createSource(source: CreateSourceInput): Promise<Source>;
  updateSourceSelectorMap(id: string, selectorMap: SelectorMap): Promise<void>;
  updateSourceStatus(id: string, status: SourceStatus, lastRunAt?: string): Promise<void>;

  // Extracted Records operations
  upsertRecords(records: ExtractedRecord[]): Promise<{ inserted: number; updated: number }>;
  getRecords(filter: DataQueryFilter): Promise<{ data: ExtractedRecord[]; total: number }>;
  getRecordById(entityId: string): Promise<ExtractedRecord | null>;
  getAllRecordsForFeed(sourceId?: string, since?: string): Promise<ExtractedRecord[]>;

  // Subscriber operations
  getSubscriberByApiKeyHash(hash: string): Promise<ApiSubscriber | null>;
  getSubscriberByEmail(email: string): Promise<ApiSubscriber | null>;
  createSubscriber(subscriber: ApiSubscriber): Promise<ApiSubscriber>;
  incrementSubscriberUsage(id: string, count?: number): Promise<ApiSubscriber | null>;
  getAllSubscribers(): Promise<ApiSubscriber[]>;

  // Extraction Logs
  createLog(log: Omit<ExtractionLog, 'id' | 'created_at'>): Promise<ExtractionLog>;
  getRecentLogs(limit?: number, sourceId?: string): Promise<ExtractionLog[]>;
  getMetricsSummary(): Promise<{
    totalRecords: number;
    activeSources: number;
    activeSubscribers: number;
    totalExtractions: number;
    driftRepairs: number;
    failedExtractions: number;
    totalTokensUsed: number;
  }>;
}

// ---------------------------------------------------------------------------
// Local Persistent Storage Engine (Standalone JSON DB)
// ---------------------------------------------------------------------------
class PersistentFileRepository implements IRepository {
  private sources: Map<string, Source> = new Map();
  private records: Map<string, ExtractedRecord> = new Map();
  private subscribers: Map<string, ApiSubscriber> = new Map();
  private logs: ExtractionLog[] = [];
  private dbFilePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbFilePath = path.join(dataDir, 'db.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (parsed.sources) {
            for (const s of parsed.sources) this.sources.set(s.id, s);
          }
          if (parsed.records) {
            for (const r of parsed.records) this.records.set(r.entity_id, r);
          }
          if (parsed.subscribers) {
            for (const sub of parsed.subscribers) this.subscribers.set(sub.id, sub);
          }
          if (parsed.logs) {
            this.logs = parsed.logs;
          }
          logger.info(
            {
              sources: this.sources.size,
              records: this.records.size,
              subscribers: this.subscribers.size,
            },
            'Loaded database state from local disk'
          );
        }
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to load local DB state, starting fresh');
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const payload = {
          sources: Array.from(this.sources.values()),
          records: Array.from(this.records.values()),
          subscribers: Array.from(this.subscribers.values()),
          logs: this.logs.slice(0, 500),
          updated_at: new Date().toISOString(),
        };
        fs.writeFileSync(this.dbFilePath, JSON.stringify(payload, null, 2), 'utf-8');
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to persist local DB to disk');
      }
    }, 100);
  }

  async getActiveSources(): Promise<Source[]> {
    return Array.from(this.sources.values()).filter((s) => s.status === 'ACTIVE');
  }

  async getAllSources(): Promise<Source[]> {
    return Array.from(this.sources.values());
  }

  async getSourceById(id: string): Promise<Source | null> {
    return this.sources.get(id) || null;
  }

  async createSource(sourceData: CreateSourceInput): Promise<Source> {
    const now = new Date().toISOString();
    const source: Source = {
      id: sourceData.id || crypto.randomUUID(),
      name: sourceData.name,
      url: sourceData.url,
      target_schema: sourceData.target_schema || {
        title: 'string',
        price: 'number',
        category: 'string',
        natural_key: 'string',
      },
      selector_map: sourceData.selector_map,
      schedule_cron: sourceData.schedule_cron || '0 * * * *',
      headers: sourceData.headers || {},
      status: sourceData.status || 'ACTIVE',
      last_run_at: sourceData.last_run_at || null,
      created_at: now,
      updated_at: now,
    };
    this.sources.set(source.id, source);
    this.scheduleSave();
    return source;
  }

  async updateSourceSelectorMap(id: string, selectorMap: SelectorMap): Promise<void> {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Source ${id} not found`);
    source.selector_map = selectorMap;
    source.updated_at = new Date().toISOString();
    this.sources.set(id, source);
    this.scheduleSave();
  }

  async updateSourceStatus(id: string, status: SourceStatus, lastRunAt?: string): Promise<void> {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Source ${id} not found`);
    source.status = status;
    if (lastRunAt) source.last_run_at = lastRunAt;
    source.updated_at = new Date().toISOString();
    this.sources.set(id, source);
    this.scheduleSave();
  }

  async upsertRecords(records: ExtractedRecord[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();

    for (const record of records) {
      const existing = this.records.get(record.entity_id);
      if (existing) {
        const isChanged = existing.hash !== record.hash;
        const updatedRecord: ExtractedRecord = {
          ...record,
          version: isChanged ? existing.version + 1 : existing.version,
          first_seen_at: existing.first_seen_at,
          updated_at: now,
        };
        this.records.set(record.entity_id, updatedRecord);
        updated++;
      } else {
        const newRecord: ExtractedRecord = {
          ...record,
          version: 1,
          first_seen_at: now,
          updated_at: now,
        };
        this.records.set(record.entity_id, newRecord);
        inserted++;
      }
    }
    this.scheduleSave();
    return { inserted, updated };
  }

  async getRecords(filter: DataQueryFilter): Promise<{ data: ExtractedRecord[]; total: number }> {
    let all = Array.from(this.records.values());

    if (filter.source_id) {
      all = all.filter((r) => r.source_id === filter.source_id);
    }
    if (filter.category) {
      all = all.filter((r) => r.data.category === filter.category);
    }
    if (filter.status) {
      all = all.filter((r) => r.data.status === filter.status);
    }
    if (filter.since) {
      const sinceDate = new Date(filter.since).getTime();
      all = all.filter((r) => new Date(r.updated_at || 0).getTime() >= sinceDate);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      all = all.filter((r) => JSON.stringify(r.data).toLowerCase().includes(searchLower));
    }

    // Sorting
    all.sort((a, b) => {
      const fieldA = a[filter.sort_by as keyof ExtractedRecord] ?? '';
      const fieldB = b[filter.sort_by as keyof ExtractedRecord] ?? '';
      const compare = String(fieldA).localeCompare(String(fieldB));
      return filter.sort_dir === 'desc' ? -compare : compare;
    });

    const total = all.length;
    const offset = (filter.page - 1) * filter.limit;
    const paginated = all.slice(offset, offset + filter.limit);

    return { data: paginated, total };
  }

  async getRecordById(entityId: string): Promise<ExtractedRecord | null> {
    return this.records.get(entityId) || null;
  }

  async getAllRecordsForFeed(sourceId?: string, since?: string): Promise<ExtractedRecord[]> {
    let all = Array.from(this.records.values());
    if (sourceId) {
      all = all.filter((r) => r.source_id === sourceId);
    }
    if (since) {
      const sinceDate = new Date(since).getTime();
      all = all.filter((r) => new Date(r.updated_at || 0).getTime() >= sinceDate);
    }
    return all.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  }

  async getSubscriberByApiKeyHash(hash: string): Promise<ApiSubscriber | null> {
    for (const sub of this.subscribers.values()) {
      if (sub.api_key_hash === hash) {
        return sub;
      }
    }
    return null;
  }

  async getSubscriberByEmail(email: string): Promise<ApiSubscriber | null> {
    for (const sub of this.subscribers.values()) {
      if (sub.email.toLowerCase() === email.toLowerCase()) {
        return sub;
      }
    }
    return null;
  }

  async createSubscriber(subscriber: ApiSubscriber): Promise<ApiSubscriber> {
    this.subscribers.set(subscriber.id, subscriber);
    this.scheduleSave();
    return subscriber;
  }

  async incrementSubscriberUsage(id: string, count: number = 1): Promise<ApiSubscriber | null> {
    const sub = this.subscribers.get(id);
    if (!sub) return null;
    sub.current_usage += count;
    sub.updated_at = new Date().toISOString();
    this.subscribers.set(id, sub);
    this.scheduleSave();
    return sub;
  }

  async getAllSubscribers(): Promise<ApiSubscriber[]> {
    return Array.from(this.subscribers.values());
  }

  async createLog(logData: Omit<ExtractionLog, 'id' | 'created_at'>): Promise<ExtractionLog> {
    const log: ExtractionLog = {
      id: crypto.randomUUID(),
      ...logData,
      created_at: new Date().toISOString(),
    };
    this.logs.unshift(log); // newest first
    this.scheduleSave();
    return log;
  }

  async getRecentLogs(limit: number = 50, sourceId?: string): Promise<ExtractionLog[]> {
    let list = this.logs;
    if (sourceId) {
      list = list.filter((l) => l.source_id === sourceId);
    }
    return list.slice(0, limit);
  }

  async getMetricsSummary() {
    const totalRecords = this.records.size;
    const activeSources = Array.from(this.sources.values()).filter((s) => s.status === 'ACTIVE').length;
    const activeSubscribers = Array.from(this.subscribers.values()).filter((s) => s.is_active).length;
    const totalExtractions = this.logs.length;
    const driftRepairs = this.logs.filter((l) => l.status === 'DRIFT_REPAIRED').length;
    const failedExtractions = this.logs.filter((l) => l.status === 'FAILED').length;
    const totalTokensUsed = this.logs.reduce((acc, curr) => acc + (curr.tokens_used || 0), 0);

    return {
      totalRecords,
      activeSources,
      activeSubscribers,
      totalExtractions,
      driftRepairs,
      failedExtractions,
      totalTokensUsed,
    };
  }
}

// ---------------------------------------------------------------------------
// Supabase Database Repository Adapter (Optional)
// ---------------------------------------------------------------------------
class SupabaseRepository implements IRepository {
  private fallback = new PersistentFileRepository();

  async getActiveSources(): Promise<Source[]> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getActiveSources();

    const { data, error } = await client.from('sources').select('*').eq('status', 'ACTIVE');
    if (error) {
      logger.error({ error }, 'Supabase error fetching active sources');
      return this.fallback.getActiveSources();
    }
    return data as Source[];
  }

  async getAllSources(): Promise<Source[]> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getAllSources();

    const { data, error } = await client.from('sources').select('*');
    if (error) return this.fallback.getAllSources();
    return data as Source[];
  }

  async getSourceById(id: string): Promise<Source | null> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getSourceById(id);

    const { data, error } = await client.from('sources').select('*').eq('id', id).single();
    if (error || !data) return this.fallback.getSourceById(id);
    return data as Source;
  }

  async createSource(sourceData: CreateSourceInput): Promise<Source> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.createSource(sourceData);

    const { data, error } = await client.from('sources').insert(sourceData).select().single();
    if (error) {
      logger.error({ error }, 'Supabase error creating source, falling back to memory');
      return this.fallback.createSource(sourceData);
    }
    return data as Source;
  }

  async updateSourceSelectorMap(id: string, selectorMap: SelectorMap): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.updateSourceSelectorMap(id, selectorMap);

    const { error } = await client
      .from('sources')
      .update({ selector_map: selectorMap, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error({ error }, 'Supabase error updating selector map');
      await this.fallback.updateSourceSelectorMap(id, selectorMap);
    }
  }

  async updateSourceStatus(id: string, status: SourceStatus, lastRunAt?: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.updateSourceStatus(id, status, lastRunAt);

    const updatePayload: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (lastRunAt) updatePayload.last_run_at = lastRunAt;

    const { error } = await client.from('sources').update(updatePayload).eq('id', id);
    if (error) {
      logger.error({ error }, 'Supabase error updating source status');
      await this.fallback.updateSourceStatus(id, status, lastRunAt);
    }
  }

  async upsertRecords(records: ExtractedRecord[]): Promise<{ inserted: number; updated: number }> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.upsertRecords(records);

    if (records.length === 0) return { inserted: 0, updated: 0 };

    const { error } = await client.from('extracted_records').upsert(records, {
      onConflict: 'entity_id',
    });

    if (error) {
      logger.error({ error }, 'Supabase error upserting records');
      return this.fallback.upsertRecords(records);
    }

    return { inserted: records.length, updated: 0 };
  }

  async getRecords(filter: DataQueryFilter): Promise<{ data: ExtractedRecord[]; total: number }> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getRecords(filter);

    let query = client.from('extracted_records').select('*', { count: 'exact' });

    if (filter.source_id) {
      query = query.eq('source_id', filter.source_id);
    }
    if (filter.since) {
      query = query.gte('updated_at', filter.since);
    }

    const from = (filter.page - 1) * filter.limit;
    const to = from + filter.limit - 1;

    const { data, count, error } = await query
      .order(filter.sort_by, { ascending: filter.sort_dir === 'asc' })
      .range(from, to);

    if (error) {
      logger.error({ error }, 'Supabase error fetching records');
      return this.fallback.getRecords(filter);
    }

    return { data: (data as ExtractedRecord[]) || [], total: count || 0 };
  }

  async getRecordById(entityId: string): Promise<ExtractedRecord | null> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getRecordById(entityId);

    const { data, error } = await client.from('extracted_records').select('*').eq('entity_id', entityId).single();
    if (error || !data) return this.fallback.getRecordById(entityId);
    return data as ExtractedRecord;
  }

  async getAllRecordsForFeed(sourceId?: string, since?: string): Promise<ExtractedRecord[]> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getAllRecordsForFeed(sourceId, since);

    let query = client.from('extracted_records').select('*').order('updated_at', { ascending: false });
    if (sourceId) query = query.eq('source_id', sourceId);
    if (since) query = query.gte('updated_at', since);

    const { data, error } = await query;
    if (error) {
      logger.error({ error }, 'Supabase error fetching feed records');
      return this.fallback.getAllRecordsForFeed(sourceId, since);
    }
    return (data as ExtractedRecord[]) || [];
  }

  async getSubscriberByApiKeyHash(hash: string): Promise<ApiSubscriber | null> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getSubscriberByApiKeyHash(hash);

    const { data, error } = await client.from('api_subscribers').select('*').eq('api_key_hash', hash).single();
    if (error || !data) return this.fallback.getSubscriberByApiKeyHash(hash);
    return data as ApiSubscriber;
  }

  async getSubscriberByEmail(email: string): Promise<ApiSubscriber | null> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getSubscriberByEmail(email);

    const { data, error } = await client.from('api_subscribers').select('*').eq('email', email).single();
    if (error || !data) return this.fallback.getSubscriberByEmail(email);
    return data as ApiSubscriber;
  }

  async createSubscriber(subscriber: ApiSubscriber): Promise<ApiSubscriber> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.createSubscriber(subscriber);

    const { data, error } = await client.from('api_subscribers').insert(subscriber).select().single();
    if (error) {
      logger.error({ error }, 'Supabase error creating subscriber');
      return this.fallback.createSubscriber(subscriber);
    }
    return data as ApiSubscriber;
  }

  async incrementSubscriberUsage(id: string, count: number = 1): Promise<ApiSubscriber | null> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.incrementSubscriberUsage(id, count);

    const { data: sub } = await client.from('api_subscribers').select('*').eq('id', id).single();
    if (!sub) return null;

    const newUsage = (sub.current_usage || 0) + count;
    const { data, error } = await client
      .from('api_subscribers')
      .update({ current_usage: newUsage, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return this.fallback.incrementSubscriberUsage(id, count);
    return data as ApiSubscriber;
  }

  async getAllSubscribers(): Promise<ApiSubscriber[]> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getAllSubscribers();
    const { data } = await client.from('api_subscribers').select('*');
    return (data as ApiSubscriber[]) || [];
  }

  async createLog(logData: Omit<ExtractionLog, 'id' | 'created_at'>): Promise<ExtractionLog> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.createLog(logData);

    const { data, error } = await client.from('extraction_logs').insert(logData).select().single();
    if (error) {
      logger.error({ error }, 'Supabase error writing extraction log');
      return this.fallback.createLog(logData);
    }
    return data as ExtractionLog;
  }

  async getRecentLogs(limit: number = 50, sourceId?: string): Promise<ExtractionLog[]> {
    const client = getSupabaseClient();
    if (!client) return this.fallback.getRecentLogs(limit, sourceId);

    let query = client.from('extraction_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    if (sourceId) query = query.eq('source_id', sourceId);

    const { data, error } = await query;
    if (error) return this.fallback.getRecentLogs(limit, sourceId);
    return (data as ExtractionLog[]) || [];
  }

  async getMetricsSummary() {
    return this.fallback.getMetricsSummary();
  }
}

// Export singleton repository (Persistent File storage by default unless SUPABASE_URL is provided)
export const repository: IRepository = getSupabaseClient()
  ? new SupabaseRepository()
  : new PersistentFileRepository();
