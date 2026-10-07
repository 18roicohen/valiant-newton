// Type declarations for Cloudflare Workers edge environment

declare global {
  interface CacheStorage {
    default: Cache;
  }

  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run<T = unknown>(): Promise<D1Response>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
  }

  interface D1Response {
    success: boolean;
    meta: Record<string, any>;
    error?: string;
  }

  interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    meta: Record<string, any>;
    error?: string;
  }

  interface D1ExecResult {
    count: number;
    duration: number;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }

  interface ScheduledEvent {
    cron: string;
    type: string;
    scheduledTime: number;
  }

  interface Fetcher {
    fetch(request: Request | string, requestInit?: RequestInit): Promise<Response>;
  }

  interface RequestInitCfProperties {
    colo?: string;
    country?: string;
    city?: string;
    continent?: string;
    latitude?: string;
    longitude?: string;
    postalCode?: string;
    metroCode?: string;
    region?: string;
    regionCode?: string;
    timezone?: string;
  }

  interface Request {
    cf?: RequestInitCfProperties;
  }
}

export {};
