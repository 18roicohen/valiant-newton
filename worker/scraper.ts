import { AffiliateService } from './affiliates.js';

export interface ScrapedGpuItem {
  natural_key: string;
  gpu_model: string;
  provider: string;
  price_hourly: number;
  vram_gb: number;
  region: string;
  status: string;
  source_id: string;
}

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class EdgeScraperEngine {
  /**
   * Fetches real-time instances from Lambda Labs public catalog
   */
  static async fetchLambdaLabs(): Promise<ScrapedGpuItem[]> {
    try {
      const res = await fetch('https://cloud.lambdalabs.com/api/v1/instance-types', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return [];

      const json: any = await res.json();
      const data = json.data || {};
      const items: ScrapedGpuItem[] = [];

      for (const [key, details] of Object.entries<any>(data)) {
        const inst = details.instance_type;
        if (!inst) continue;
        const name = inst.description || key;
        const pricePerHour = (inst.price_cents_per_hour || 0) / 100;
        const vram = inst.specs?.vram_gb || (name.includes('80GB') ? 80 : name.includes('24GB') ? 24 : 0);
        const available = details.regions_with_capacity_available?.length > 0;

        items.push({
          natural_key: `lambdalabs-${key}`,
          gpu_model: name,
          provider: 'Lambda Labs',
          price_hourly: pricePerHour,
          vram_gb: vram,
          region: details.regions_with_capacity_available?.[0]?.name || 'Global',
          status: available ? 'In Stock' : 'Sold Out',
          source_id: 'src-lambda-api',
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * Fetches real-time spot offers from Vast.ai open bundles API
   */
  static async fetchVastAi(): Promise<ScrapedGpuItem[]> {
    try {
      const res = await fetch('https://console.vast.ai/api/v0/bundles/?q=%7B%22verified%22%3A%7B%22eq%22%3Atrue%7D%7D', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return [];

      const json: any = await res.json();
      const offers = json.offers || [];
      const items: ScrapedGpuItem[] = [];
      const seen = new Set<string>();

      for (const o of offers.slice(0, 40)) {
        const gpuName = o.gpu_name || 'GPU';
        const numGpus = o.num_gpus || 1;
        const dph = parseFloat(o.dph_total || '0') / numGpus;
        if (dph <= 0.05 || dph > 20) continue;

        const key = `vastai-${gpuName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${numGpus}x`;
        if (seen.has(key)) continue;
        seen.add(key);

        items.push({
          natural_key: key,
          gpu_model: `${gpuName} (${numGpus}x)`,
          provider: 'Vast.ai',
          price_hourly: Math.round(dph * 100) / 100,
          vram_gb: Math.round((o.gpu_ram || 0) / 1024),
          region: o.geolocation || 'Global',
          status: 'In Stock',
          source_id: 'src-vast-api',
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * Streaming HTMLRewriter extractor for catalog pages
   */
  static async extractFromHtmlCatalog(url = 'https://gpuperhour.com'): Promise<ScrapedGpuItem[]> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DYNEP-Spot-Ingest/2.0' },
      });
      if (!res.ok) return [];

      const text = await res.text();
      const items: ScrapedGpuItem[] = [];

      // Fast streaming regex matching for standardized table rows
      const rowRegex = /<tr[^>]*>[\s\S]*?<th[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/th>[\s\S]*?<td>\$([0-9.]+)<\/td>[\s\S]*?<td>([^<]+)<\/td>[\s\S]*?<\/tr>/gi;
      let match;

      while ((match = rowRegex.exec(text)) !== null) {
        const title = match[1]?.trim() || '';
        const price = parseFloat(match[2] || '0');
        const provider = match[3]?.trim() || 'LeaderGPU';

        if (title && price > 0.05) {
          items.push({
            natural_key: `gph-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${provider.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            gpu_model: title,
            provider,
            price_hourly: price,
            vram_gb: title.includes('80GB') ? 80 : title.includes('24GB') ? 24 : title.includes('141GB') ? 141 : 0,
            region: 'Global',
            status: 'Available',
            source_id: 'src-html-catalog',
          });
        }
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * Executes multi-cloud crawl and batches atomic updates into D1 SQLite
   */
  static async runFullCrawl(db: D1Database): Promise<{ count: number; durationMs: number }> {
    const start = Date.now();
    const [lambdaItems, vastItems, catalogItems] = await Promise.all([
      this.fetchLambdaLabs(),
      this.fetchVastAi(),
      this.extractFromHtmlCatalog(),
    ]);

    const combined = [...lambdaItems, ...vastItems, ...catalogItems];
    if (combined.length === 0) {
      return { count: 0, durationMs: Date.now() - start };
    }

    const statements: D1PreparedStatement[] = [];

    for (const item of combined) {
      const entityId = await sha256(`${item.natural_key}:${item.provider}`);
      const deployUrl = AffiliateService.getDeployUrl(item.provider, item.gpu_model);
      const commissionRate = `${AffiliateService.getCommissionPercent(item.provider)}%`;

      const dataObj = {
        title: item.gpu_model,
        provider: item.provider,
        price: item.price_hourly,
        vram: item.vram_gb ? `${item.vram_gb}GB` : undefined,
        category: item.region,
        status: item.status,
        deploy_url: deployUrl,
        affiliate_commission_rate: commissionRate,
        natural_key: item.natural_key,
      };

      const dataStr = JSON.stringify(dataObj);
      const hash = await sha256(dataStr);

      statements.push(
        db.prepare(`
          INSERT INTO records (entity_id, source_id, natural_key, gpu_model, provider, price_hourly, vram_gb, region, deploy_url, data, hash, version, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
          ON CONFLICT(entity_id) DO UPDATE SET
            price_hourly = excluded.price_hourly,
            status = excluded.status,
            deploy_url = excluded.deploy_url,
            data = excluded.data,
            hash = excluded.hash,
            version = records.version + 1,
            updated_at = datetime('now')
        `).bind(
          entityId,
          item.source_id,
          item.natural_key,
          item.gpu_model,
          item.provider,
          item.price_hourly,
          item.vram_gb,
          item.region,
          deployUrl,
          dataStr,
          hash
        )
      );
    }

    // Execute in batches of 50 to adhere to D1 transaction batch size limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const slice = statements.slice(i, i + BATCH_SIZE);
      await db.batch(slice);
    }

    // Update sources table
    await db.prepare('UPDATE sources SET last_run_at = datetime("now"), updated_at = datetime("now")').run();

    const durationMs = Date.now() - start;

    // Log the run
    const logId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO logs (id, source_id, status, records_count, duration_ms, created_at)
      VALUES (?, 'global_multi_cloud_crawler', 'SUCCESS', ?, ?, datetime('now'))
    `).bind(logId, combined.length, durationMs).run();

    return { count: combined.length, durationMs };
  }
}
