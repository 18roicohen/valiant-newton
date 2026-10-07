import fs from 'fs';
import path from 'path';

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  const dbPath = path.resolve('data/db.json');
  const raw = fs.readFileSync(dbPath, 'utf-8');
  const db = JSON.parse(raw);

  const lines: string[] = [];

  // 1. Sources
  if (Array.isArray(db.sources)) {
    for (const s of db.sources) {
      lines.push(
        `INSERT OR REPLACE INTO sources (id, name, url, target_schema, selector_map, schedule_cron, headers, status, last_run_at, created_at, updated_at) VALUES (` +
        `${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.url)}, ${escapeSql(s.target_schema)}, ${escapeSql(s.selector_map)}, ${escapeSql(s.schedule_cron)}, ${escapeSql(s.headers)}, ${escapeSql(s.status)}, ${escapeSql(s.last_run_at)}, ${escapeSql(s.created_at)}, ${escapeSql(s.updated_at)});`
      );
    }
  }

  // 2. Subscribers
  if (Array.isArray(db.subscribers)) {
    for (const sub of db.subscribers) {
      lines.push(
        `INSERT OR REPLACE INTO subscribers (id, customer_id, email, api_key_hash, api_key_prefix, tier, monthly_quota, current_usage, rate_limit_rpm, is_active, created_at, updated_at) VALUES (` +
        `${escapeSql(sub.id)}, ${escapeSql(sub.customer_id)}, ${escapeSql(sub.email)}, ${escapeSql(sub.api_key_hash)}, ${escapeSql(sub.api_key_prefix)}, ${escapeSql(sub.tier)}, ${escapeSql(sub.monthly_quota)}, ${escapeSql(sub.current_usage)}, ${escapeSql(sub.rate_limit_rpm)}, ${escapeSql(sub.is_active)}, ${escapeSql(sub.created_at)}, ${escapeSql(sub.updated_at)});`
      );
    }
  }

  // 3. Alerts
  if (Array.isArray(db.alerts)) {
    for (const a of db.alerts) {
      lines.push(
        `INSERT OR REPLACE INTO alerts (id, email, gpu_model, target_price_usd, channel, webhook_url, is_active, last_notified_at, last_notified_price, created_at, updated_at) VALUES (` +
        `${escapeSql(a.id)}, ${escapeSql(a.email)}, ${escapeSql(a.gpu_model)}, ${escapeSql(a.target_price_usd)}, ${escapeSql(a.channel)}, ${escapeSql(a.webhook_url)}, ${escapeSql(a.is_active)}, ${escapeSql(a.last_notified_at)}, ${escapeSql(a.last_notified_price)}, ${escapeSql(a.created_at)}, ${escapeSql(a.created_at)});`
      );
    }
  }

  // 4. Records
  if (Array.isArray(db.records)) {
    for (const r of db.records) {
      lines.push(
        `INSERT OR REPLACE INTO records (entity_id, source_id, natural_key, data, hash, version, first_seen_at, updated_at) VALUES (` +
        `${escapeSql(r.entity_id)}, ${escapeSql(r.source_id)}, ${escapeSql(r.natural_key)}, ${escapeSql(r.data)}, ${escapeSql(r.hash)}, ${escapeSql(r.version)}, ${escapeSql(r.first_seen_at)}, ${escapeSql(r.updated_at)});`
      );
    }
  }


  const outPath = path.resolve('worker/seed.sql');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`Exported ${lines.length} SQL statements to ${outPath}`);
}

main().catch(console.error);
