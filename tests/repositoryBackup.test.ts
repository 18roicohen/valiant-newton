import { describe, it, expect } from 'vitest';
import { repository } from '../src/db/repository.js';
import fs from 'fs';
import path from 'path';

describe('Atomic Storage & Backup Snapshots', () => {
  it('creates an automated rotating local backup snapshot', async () => {
    const snapshot = await repository.createBackupSnapshot();

    expect(snapshot.filename).toMatch(/^db-\d{4}-\d{2}-\d{2}-\d{2}\.json$/);
    expect(snapshot.sizeBytes).toBeGreaterThan(0);
    expect(fs.existsSync(snapshot.path)).toBe(true);

    const content = JSON.parse(fs.readFileSync(snapshot.path, 'utf-8'));
    expect(content.sources).toBeDefined();
    expect(content.records).toBeDefined();
    expect(content.subscribers).toBeDefined();
    expect(content.snapshot_at).toBeDefined();
  });

  it('purges backups older than retention cutoff', async () => {
    const backupsDir = path.resolve(process.cwd(), 'data', 'backups');
    const oldFilename = 'db-2020-01-01-00.json';
    const oldPath = path.join(backupsDir, oldFilename);

    // Create artificial expired backup
    fs.writeFileSync(oldPath, JSON.stringify({ old: true }), 'utf-8');
    const pastTime = new Date('2020-01-01T00:00:00Z');
    fs.utimesSync(oldPath, pastTime, pastTime);

    expect(fs.existsSync(oldPath)).toBe(true);

    const purged = await repository.purgeOldBackups(14);
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(oldPath)).toBe(false);
  });
});
