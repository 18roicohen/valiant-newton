import { repository } from '../db/repository.js';
import { SelectorMap } from '../db/schema.js';
import { logger } from '../db/client.js';

export class SourcePatcher {
  /**
   * Applies an automated selector patch to a source in the database
   */
  static async applyPatch(sourceId: string, patch: SelectorMap, notes?: string): Promise<void> {
    logger.info({ sourceId, version: patch.version, container: patch.container, notes }, 'Applying automated selector map patch');
    
    await repository.updateSourceSelectorMap(sourceId, patch);
    await repository.updateSourceStatus(sourceId, 'ACTIVE', new Date().toISOString());
  }
}
