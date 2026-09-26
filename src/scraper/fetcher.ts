import { logger } from '../db/client.js';

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

export class ResilientFetcher {
  private static getRandomUserAgent(): string {
    const idx = Math.floor(Math.random() * DEFAULT_USER_AGENTS.length);
    return DEFAULT_USER_AGENTS[idx];
  }

  /**
   * Fetches raw HTML from a target URL with retries, timeout, and exponential backoff
   */
  static async fetchHtml(url: string, options: FetchOptions = {}): Promise<{ html: string; status: number; durationMs: number }> {
    const {
      headers = {},
      timeoutMs = 15000,
      retries = 3,
      retryDelayMs = 1000,
    } = options;

    let attempt = 0;
    let lastError: Error | null = null;
    const startTime = Date.now();

    while (attempt <= retries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const requestHeaders: Record<string, string> = {
          'User-Agent': headers['User-Agent'] || this.getRandomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          ...headers,
        };

        const response = await fetch(url, {
          method: 'GET',
          headers: requestHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Retry on 429, 500, 502, 503, 504
          if ([429, 500, 502, 503, 504].includes(response.status) && attempt <= retries) {
            const backoff = retryDelayMs * Math.pow(2, attempt - 1);
            logger.warn({ url, status: response.status, attempt, backoff }, 'Transient HTTP error, backing off');
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
        }

        const html = await response.text();
        const durationMs = Date.now() - startTime;
        return { html, status: response.status, durationMs };
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') {
          logger.warn({ url, attempt }, `Request timed out after ${timeoutMs}ms`);
        } else {
          logger.warn({ url, attempt, error: err.message }, 'Fetch attempt failed');
        }

        if (attempt <= retries) {
          const backoff = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
  }
}
