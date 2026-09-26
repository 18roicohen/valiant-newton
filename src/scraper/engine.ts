import { repository } from '../db/repository.js';
import { Source, ExtractionStatus } from '../db/schema.js';
import { ResilientFetcher } from './fetcher.js';
import { FastPathParser } from './parser.js';
import { DriftDetector } from './driftDetector.js';
import { SelfHealingEngine } from '../selfHealing/healer.js';
import { SourcePatcher } from '../selfHealing/patcher.js';
import { Normalizer } from '../normalizer/normalizer.js';
import { WebhookNotifier } from '../alerts/webhookNotifier.js';
import { logger } from '../db/client.js';

export interface ScrapeExecutionResult {
  sourceId: string;
  sourceName: string;
  status: ExtractionStatus;
  recordsExtracted: number;
  recordsUpserted: number;
  durationMs: number;
  tokensUsed: number;
  driftDetected: boolean;
  repairedVersion?: number;
  errorMessage?: string;
}

export class ScrapingEngine {
  /**
   * Scrapes all active sources sequentially or concurrently
   */
  static async scrapeAll(): Promise<ScrapeExecutionResult[]> {
    const sources = await repository.getActiveSources();
    logger.info({ count: sources.length }, 'Triggering scrape for all active sources');

    const results: ScrapeExecutionResult[] = [];
    for (const source of sources) {
      try {
        const result = await this.scrapeSource(source);
        results.push(result);
      } catch (err: any) {
        logger.error({ sourceId: source.id, error: err.message }, 'Fatal scrape failure for source');
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'FAILED',
          recordsExtracted: 0,
          recordsUpserted: 0,
          durationMs: 0,
          tokensUsed: 0,
          driftDetected: false,
          errorMessage: err.message,
        });
      }
    }
    return results;
  }

  /**
   * Executes the full end-to-end extraction pipeline for a single target source:
   * Target Resolver -> Fast-Path Extraction -> Drift Detection -> Self-Healing -> Normalization -> Storage -> Audit Log
   */
  static async scrapeSource(sourceOrId: Source | string, rawHtmlOverride?: string): Promise<ScrapeExecutionResult> {
    const startTime = Date.now();
    let source: Source | null = null;

    if (typeof sourceOrId === 'string') {
      source = await repository.getSourceById(sourceOrId);
      if (!source) throw new Error(`Source with ID ${sourceOrId} not found`);
    } else {
      source = sourceOrId;
    }

    logger.info({ sourceId: source.id, name: source.name, url: source.url }, 'Executing scraping pipeline');

    let html = '';
    let fetchDurationMs = 0;

    // 1. Fetch HTML or use mock override (for deterministic simulation/testing)
    if (rawHtmlOverride) {
      html = rawHtmlOverride;
    } else {
      const fetchResult = await ResilientFetcher.fetchHtml(source.url, {
        headers: source.headers,
      });
      html = fetchResult.html;
      fetchDurationMs = fetchResult.durationMs;
    }

    // 2. Fast-Path Extraction using cached CSS/XPath selector map
    let rawItems = FastPathParser.parse(html, source.selector_map);
    let status: ExtractionStatus = 'SUCCESS';
    let driftDetected = false;
    let tokensUsed = 0;
    let repairedVersion: number | undefined;

    // 3. Drift Detection
    const driftCheck = DriftDetector.evaluate(rawItems, source.target_schema);

    // 4. LLM Self-Healing Layer (Triggers ONLY when drift is detected)
    if (driftCheck.hasDrift) {
      driftDetected = true;
      logger.warn(
        { sourceId: source.id, reason: driftCheck.reason, message: driftCheck.message },
        'Drift detected! Activating LLM Self-Healing service'
      );

      const healResult = await SelfHealingEngine.heal(
        html,
        source.target_schema,
        source.selector_map,
        driftCheck.message
      );

      tokensUsed = healResult.tokensUsed;

      if (healResult.success && healResult.repairedRecords.length > 0) {
        rawItems = healResult.repairedRecords;
        status = 'DRIFT_REPAIRED';
        repairedVersion = healResult.repairedSelectorMap.version;

        // Auto-patch the source in the database for subsequent fast-path runs
        await SourcePatcher.applyPatch(
          source.id,
          healResult.repairedSelectorMap,
          healResult.repairNotes
        );

        // Update local source object
        source.selector_map = healResult.repairedSelectorMap;

        // Dispatch alert notification
        await WebhookNotifier.sendAlert({
          title: 'Selector Drift Self-Healed',
          sourceName: source.name,
          sourceId: source.id,
          status: 'DRIFT_REPAIRED',
          message: `Pipeline automatically repaired broken selectors. Repaired ${rawItems.length} records.`,
          details: {
            tokensUsed,
            newVersion: repairedVersion,
            newContainer: healResult.repairedSelectorMap.container,
          },
        });
      } else {
        status = 'FAILED';
        const errMessage = healResult.errorMessage || 'Self-healing failed to repair selectors';
        logger.error({ sourceId: source.id, error: errMessage }, 'Self-healing failed');

        await repository.updateSourceStatus(source.id, 'DRIFT_DETECTED', new Date().toISOString());

        const durationMs = Date.now() - startTime;
        await repository.createLog({
          source_id: source.id,
          status: 'FAILED',
          records_count: 0,
          duration_ms: durationMs,
          tokens_used: tokensUsed,
          drift_detected: true,
          error_message: errMessage,
          metadata: { driftReason: driftCheck.reason },
        });

        await WebhookNotifier.sendAlert({
          title: 'Scraper Pipeline Fatal Failure',
          sourceName: source.name,
          sourceId: source.id,
          status: 'FAILED',
          message: `Extraction failed and self-healing could not recover: ${errMessage}`,
        });

        return {
          sourceId: source.id,
          sourceName: source.name,
          status: 'FAILED',
          recordsExtracted: 0,
          recordsUpserted: 0,
          durationMs,
          tokensUsed,
          driftDetected: true,
          errorMessage: errMessage,
        };
      }
    }

    // 5. Normalization & Storage Layer
    const { validRecords, discardedCount } = Normalizer.processItems(
      source.id,
      rawItems,
      source.target_schema
    );

    const { inserted, updated } = await repository.upsertRecords(validRecords);
    const totalUpserted = inserted + updated;

    const totalDurationMs = Date.now() - startTime;

    // 6. Audit Logging
    await repository.createLog({
      source_id: source.id,
      status,
      records_count: validRecords.length,
      duration_ms: totalDurationMs,
      tokens_used: tokensUsed,
      drift_detected: driftDetected,
      error_message: null,
      metadata: {
        discardedCount,
        inserted,
        updated,
        fetchDurationMs,
        repairedVersion,
      },
    });

    await repository.updateSourceStatus(source.id, 'ACTIVE', new Date().toISOString());

    logger.info(
      {
        sourceId: source.id,
        status,
        extracted: rawItems.length,
        valid: validRecords.length,
        upserted: totalUpserted,
        durationMs: totalDurationMs,
        tokensUsed,
      },
      'Extraction run completed successfully'
    );

    return {
      sourceId: source.id,
      sourceName: source.name,
      status,
      recordsExtracted: rawItems.length,
      recordsUpserted: totalUpserted,
      durationMs: totalDurationMs,
      tokensUsed,
      driftDetected,
      repairedVersion,
    };
  }
}
