import { TargetSchemaDefinition, SelectorMap, RepairOutputSchema, RepairOutput } from '../db/schema.js';
import { DomCleaner } from '../scraper/domCleaner.js';
import { FastPathParser } from '../scraper/parser.js';
import { buildSelfHealingPrompt } from './prompts.js';
import { LLMClient } from './llmClient.js';
import { logger } from '../db/client.js';

export interface SelfHealingResult {
  success: boolean;
  repairedRecords: Record<string, any>[];
  repairedSelectorMap: SelectorMap;
  confidenceScore: number;
  tokensUsed: number;
  repairNotes?: string;
  errorMessage?: string;
}

export class SelfHealingEngine {
  /**
   * Orchestrates the self-healing workflow:
   * 1. Sanitizes DOM
   * 2. Prompts LLM for schema extraction & selector synthesis
   * 3. Validates structure with Zod
   * 4. Benchmarks & verifies proposed selector map against DOM
   */
  static async heal(
    rawHtml: string,
    targetSchema: TargetSchemaDefinition,
    currentSelectorMap: SelectorMap,
    driftReason?: string
  ): Promise<SelfHealingResult> {
    logger.info('Starting Self-Healing pipeline');

    // 1. Sanitize DOM into minimal semantic HTML
    const sanitizedHtml = DomCleaner.clean(rawHtml, { maxCharacters: 35000 });

    if (!sanitizedHtml || sanitizedHtml.length < 50) {
      return {
        success: false,
        repairedRecords: [],
        repairedSelectorMap: currentSelectorMap,
        confidenceScore: 0,
        tokensUsed: 0,
        errorMessage: 'Sanitized HTML is empty or too small to parse',
      };
    }

    // 2. Build structured prompt
    const { system, user } = buildSelfHealingPrompt(
      sanitizedHtml,
      targetSchema,
      currentSelectorMap,
      driftReason
    );

    try {
      // 3. Request repair from LLM client
      const llmResult = await LLMClient.repairExtraction({
        systemPrompt: system,
        userPrompt: user,
        sanitizedHtml,
        targetSchema,
        brokenSelectorMap: currentSelectorMap,
      });

      // 4. Validate output shape with Zod
      const parseResult = RepairOutputSchema.safeParse(llmResult.parsed);
      if (!parseResult.success) {
        logger.error({ errors: parseResult.error.format() }, 'LLM returned invalid repair payload structure');
        return {
          success: false,
          repairedRecords: [],
          repairedSelectorMap: currentSelectorMap,
          confidenceScore: 0,
          tokensUsed: llmResult.tokensUsed,
          errorMessage: 'LLM repair output failed schema validation',
        };
      }

      const repairData: RepairOutput = parseResult.data;

      // 5. Build proposed SelectorMap
      const proposedSelectorMap: SelectorMap = {
        container: repairData.suggested_patch.container,
        fields: repairData.suggested_patch.fields,
        pagination: currentSelectorMap.pagination,
        version: (currentSelectorMap.version || 1) + 1,
      };

      // 6. Verification: Test the proposed selector map directly against the DOM
      const verifiedItems = FastPathParser.parse(rawHtml, proposedSelectorMap);

      let confidence = repairData.suggested_patch.confidence_score;
      if (verifiedItems.length > 0) {
        confidence = Math.max(confidence, 0.9);
        logger.info(
          { count: verifiedItems.length, container: proposedSelectorMap.container },
          'Proposed selector map verified successfully against DOM'
        );
      } else {
        logger.warn('Proposed selectors yielded 0 items on verification, using direct LLM extracted items');
      }

      const finalRecords = verifiedItems.length > 0 ? verifiedItems : repairData.extracted_items;

      return {
        success: true,
        repairedRecords: finalRecords,
        repairedSelectorMap: proposedSelectorMap,
        confidenceScore: confidence,
        tokensUsed: llmResult.tokensUsed,
        repairNotes: repairData.suggested_patch.repair_notes,
      };
    } catch (err: any) {
      logger.error({ error: err.message }, 'Self-Healing pipeline failed with error');
      return {
        success: false,
        repairedRecords: [],
        repairedSelectorMap: currentSelectorMap,
        confidenceScore: 0,
        tokensUsed: 0,
        errorMessage: err.message,
      };
    }
  }
}
