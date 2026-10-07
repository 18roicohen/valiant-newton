import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface RawItem {
  title: string;
  provider: string;
  price: number;
  category: string;
  vram: string;
  host_specs: string;
  status: string;
}

const NEW_INSTANCE_ITEMS: RawItem[] = [
  {
    title: 'NVIDIA H100 80GB SXM5',
    provider: 'Nebius AI',
    price: 2.49,
    category: 'EU-North-1',
    vram: '80GB',
    host_specs: '8x SXM5 3.2Tbps InfiniBand',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA H200 141GB SXM5',
    provider: 'Nebius AI',
    price: 3.79,
    category: 'EU-North-1',
    vram: '141GB',
    host_specs: '8x SXM 400Gbps InfiniBand',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA RTX 4090 24GB',
    provider: 'TensorDock',
    price: 0.42,
    category: 'US-Central',
    vram: '24GB',
    host_specs: 'Ryzen 9 7950X, 64GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA A100 80GB PCIe',
    provider: 'TensorDock',
    price: 1.15,
    category: 'US-West',
    vram: '80GB',
    host_specs: 'EPYC 7763, 128GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA A100 80GB SXM4',
    provider: 'DataCrunch',
    price: 1.05,
    category: 'EU-West (Helsinki)',
    vram: '80GB',
    host_specs: '100% Renewable Hydro, NVLink',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA L40S 48GB',
    provider: 'DataCrunch',
    price: 0.95,
    category: 'EU-West (Helsinki)',
    vram: '48GB',
    host_specs: 'AMD EPYC, Gen4 PCIe',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA L4 24GB',
    provider: 'Scaleway',
    price: 0.62,
    category: 'fr-par-2',
    vram: '24GB',
    host_specs: '16 vCPU, 64GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA H100 80GB PCIe',
    provider: 'Scaleway',
    price: 2.65,
    category: 'fr-par-2',
    vram: '80GB',
    host_specs: '32 vCPU, 128GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA RTX A6000 48GB',
    provider: 'Paperspace',
    price: 0.78,
    category: 'US-East (NY)',
    vram: '48GB',
    host_specs: '8 vCPU, 45GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA A100 80GB SXM',
    provider: 'Paperspace',
    price: 1.49,
    category: 'US-East (NY)',
    vram: '80GB',
    host_specs: '12 vCPU, 90GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA L40S 48GB Kubernetes',
    provider: 'Civo',
    price: 0.99,
    category: 'lon1',
    vram: '48GB',
    host_specs: 'Kubernetes Native GPU Node',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA RTX 4090 24GB Spot',
    provider: 'JarvisLabs',
    price: 0.49,
    category: 'in-south-1',
    vram: '24GB',
    host_specs: 'PyTorch 2.4 Ready, Fast NVMe',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA RTX 3090 24GB',
    provider: 'Genesis Cloud',
    price: 0.32,
    category: 'is-kef-1',
    vram: '24GB',
    host_specs: '100% Geothermal Energy, 32GB RAM',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA A100 80GB Cloud',
    provider: 'OVHcloud',
    price: 1.55,
    category: 'GRA-11 (France)',
    vram: '80GB',
    host_specs: 'Dedicated vCPU, High SLI',
    status: 'In Stock',
  },
  {
    title: 'NVIDIA H100 SXM Multi-Cloud',
    provider: 'Shadeform',
    price: 2.55,
    category: 'Global Arbitrage',
    vram: '80GB',
    host_specs: 'Unified API Mesh Deployment',
    status: 'In Stock',
  },
];

function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify((obj as any)[k])}`);
  return '{' + pairs.join(',') + '}';
}

function generateContentHash(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalJsonStringify(data)).digest('hex');
}

function generateEntityId(sourceId: string, naturalKey: string): string {
  return crypto.createHash('sha256').update(`${sourceId.trim()}::${String(naturalKey).trim()}`).digest('hex');
}

async function run() {
  const dbPath = path.resolve('data/db.json');
  const rawDb = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(rawDb);

  const sourceId = '275f3912-f552-4f87-a490-716e5f4ceed9'; // Live Cloud GPU Server Instance Catalog
  const now = new Date().toISOString();

  let addedCount = 0;
  for (const item of NEW_INSTANCE_ITEMS) {
    const naturalKey = `${item.provider}-${item.title}-${item.category}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const entityId = generateEntityId(sourceId, naturalKey);

    // Check if record already exists
    const existingIndex = db.records.findIndex((r: any) => r.entity_id === entityId);
    const dataPayload: Record<string, any> = {
      title: item.title,
      provider: item.provider,
      price: item.price,
      category: item.category,
      vram: item.vram,
      host_specs: item.host_specs,
      status: item.status,
      natural_key: naturalKey,
    };
    const contentHash = generateContentHash(dataPayload);

    if (existingIndex >= 0) {
      db.records[existingIndex].data = dataPayload;
      db.records[existingIndex].hash = contentHash;
      db.records[existingIndex].updated_at = now;
    } else {
      db.records.push({
        entity_id: entityId,
        source_id: sourceId,
        natural_key: naturalKey,
        data: dataPayload,
        hash: contentHash,
        version: 1,
        first_seen_at: now,
        updated_at: now,
      });
      addedCount++;
    }
  }

  db.updated_at = now;

  // Atomic write to data/db.json
  const tmpPath = `${dbPath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  const fd = fs.openSync(tmpPath, 'r+');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmpPath, dbPath);

  console.log(`[Success] Added ${addedCount} new provider records to data/db.json.`);
  console.log(`Total records in db: ${db.records.length}`);
}

run().catch((err) => {
  console.error('[Error]', err);
  process.exit(1);
});
