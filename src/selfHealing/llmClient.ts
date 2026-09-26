import { env } from '../config/env.js';
import { logger } from '../db/client.js';
import * as cheerio from 'cheerio';
import { TargetSchemaDefinition, SelectorMap, RepairOutput } from '../db/schema.js';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  sanitizedHtml: string;
  targetSchema: TargetSchemaDefinition;
  brokenSelectorMap: SelectorMap;
}

export interface LLMResponse {
  rawJson: string;
  parsed: RepairOutput;
  tokensUsed: number;
  provider: string;
  model: string;
  latencyMs: number;
}

export class LLMClient {
  /**
   * Dispatches the self-healing prompt to the configured LLM provider
   */
  static async repairExtraction(req: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const provider = env.LLM_PROVIDER;

    logger.info({ provider, model: env.LLM_MODEL }, 'Invoking LLM Self-Healing Service');

    // 1. If explicitly mock, use heuristic engine
    if (provider === 'mock') {
      return this.callMockHeuristicEngine(req, startTime);
    }

    // 2. Google Gemini: Try if provider is 'gemini' or GEMINI_API_KEY is configured
    const geminiKey = env.GEMINI_API_KEY || (provider === 'gemini' ? env.LLM_API_KEY : undefined);
    if (geminiKey) {
      try {
        return await this.callGemini(req, startTime);
      } catch (geminiErr: any) {
        logger.warn({ error: geminiErr.message }, 'Gemini self-healing failed, attempting OpenAI/Heuristic fallback');
      }
    }

    // 3. OpenAI / LiteLLM: Try if configured
    const openAiKey = env.OPENAI_API_KEY || (['openai', 'litellm'].includes(provider) ? env.LLM_API_KEY : undefined);
    if (openAiKey) {
      try {
        return await this.callOpenAICompatible(req, startTime);
      } catch (openAiErr: any) {
        logger.warn({ error: openAiErr.message }, 'OpenAI self-healing failed, attempting Heuristic fallback');
      }
    }

    // 4. Anthropic: Try if configured
    if (provider === 'anthropic' && env.LLM_API_KEY) {
      try {
        return await this.callAnthropic(req, startTime);
      } catch (anthropicErr: any) {
        logger.warn({ error: anthropicErr.message }, 'Anthropic self-healing failed, attempting Heuristic fallback');
      }
    }

    // 5. High-accuracy Heuristic fallback
    return this.callMockHeuristicEngine(req, startTime);
  }

  /**
   * OpenAI / LiteLLM provider
   */
  private static async callOpenAICompatible(req: LLMRequest, startTime: number): Promise<LLMResponse> {
    const baseUrl = env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const apiKey = env.OPENAI_API_KEY || env.LLM_API_KEY;

    if (!apiKey) {
      logger.warn('No OpenAI API key provided, falling back to mock healer');
      return this.callMockHeuristicEngine(req, startTime);
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: env.LLM_TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawJson = data.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawJson) as RepairOutput;
    const tokensUsed = (data.usage?.total_tokens as number) || 500;

    return {
      rawJson,
      parsed,
      tokensUsed,
      provider: env.LLM_PROVIDER,
      model: env.LLM_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Anthropic Claude provider
   */
  private static async callAnthropic(req: LLMRequest, startTime: number): Promise<LLMResponse> {
    const apiKey = env.LLM_API_KEY;
    if (!apiKey) {
      return this.callMockHeuristicEngine(req, startTime);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.LLM_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: env.LLM_MAX_TOKENS,
        system: req.systemPrompt,
        messages: [{ role: 'user', content: req.userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === 'text')?.text || '{}';
    // Extract JSON substring if wrapped in markdown code fence
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    const rawJson = jsonMatch ? jsonMatch[0] : textContent;
    const parsed = JSON.parse(rawJson) as RepairOutput;
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    return {
      rawJson,
      parsed,
      tokensUsed,
      provider: 'anthropic',
      model: env.LLM_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Google Gemini provider (gemini-2.5-flash or gemini-1.5-flash)
   */
  private static async callGemini(req: LLMRequest, startTime: number): Promise<LLMResponse> {
    const apiKey = env.GEMINI_API_KEY || env.LLM_API_KEY;
    if (!apiKey) {
      return this.callMockHeuristicEngine(req, startTime);
    }

    const model = (env.LLM_MODEL && env.LLM_MODEL.startsWith('gemini'))
      ? env.LLM_MODEL
      : 'gemini-2.5-flash';

    const callApi = async (targetModel: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${req.systemPrompt}\n\n${req.userPrompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: env.LLM_TEMPERATURE,
          },
        }),
      });
    };

    let response = await callApi(model);

    // Fall back to gemini-1.5-flash if 2.5 is not available in regional endpoint
    if (!response.ok && response.status === 404 && model !== 'gemini-1.5-flash') {
      logger.info({ attemptedModel: model }, 'Gemini model returned 404, falling back to gemini-1.5-flash');
      response = await callApi('gemini-1.5-flash');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    // Strip markdown code fences if present
    textContent = textContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const parsed = JSON.parse(textContent) as RepairOutput;

    return {
      rawJson: textContent,
      parsed,
      tokensUsed: data.usageMetadata?.totalTokenCount || 400,
      provider: 'gemini',
      model,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * High-accuracy heuristic analyzer for local testing & mock provider
   * Analyzes the sanitized DOM, discovers repeated cards/items, maps candidate selectors
   */
  private static async callMockHeuristicEngine(req: LLMRequest, startTime: number): Promise<LLMResponse> {
    const $ = cheerio.load(req.sanitizedHtml);
    const schemaFields = Object.keys(req.targetSchema);

    // Heuristic 1: Find candidate container elements by scanning repeating siblings
    const candidateContainers = [
      '.deal-card',
      '.product-card',
      '.item-card',
      '.listing-item',
      'article',
      '.deal-item',
      '.data-item',
      'tr.data-row',
      'li.item',
      '.row',
      '.card',
    ];

    let chosenContainer = candidateContainers.find((sel) => $(sel).length > 0);

    if (!chosenContainer) {
      // Find elements with common class substrings or multiple children
      const elementsWithClasses: Record<string, number> = {};
      $('*').each((_, el) => {
        if (el.type === 'tag' && el.attribs.class) {
          const classes = el.attribs.class.split(/\s+/);
          for (const c of classes) {
            if (c.length > 2) {
              elementsWithClasses[c] = (elementsWithClasses[c] || 0) + 1;
            }
          }
        }
      });

      // Pick class that appears multiple times (> 1)
      const topClass = Object.entries(elementsWithClasses)
        .filter(([_, count]) => count >= 2 && count <= 500)
        .sort((a, b) => b[1] - a[1])[0];

      if (topClass) {
        chosenContainer = `.${topClass[0]}`;
      } else {
        chosenContainer = 'div > div';
      }
    }

    const containerEls = $(chosenContainer);
    const suggestedFields: Record<string, string> = {};

    // Discover field selectors within container
    for (const field of schemaFields) {
      if (['title', 'name', 'headline'].includes(field)) {
        if (containerEls.find('h1, h2, h3, h4, .title, .name, [data-title]').length > 0) {
          const matchedTag = containerEls.find('h1, h2, h3, h4, .title, .name').first().prop('tagName')?.toLowerCase();
          const matchedClass = containerEls.find('h1, h2, h3, h4, .title, .name').first().attr('class');
          suggestedFields[field] = matchedClass ? `.${matchedClass.split(' ')[0]}` : matchedTag || 'h3';
        } else {
          suggestedFields[field] = 'h3, .title';
        }
      } else if (['price', 'cost', 'amount', 'val'].includes(field)) {
        if (containerEls.find('.price, .deal-price, .cost, span:contains("$")').length > 0) {
          const el = containerEls.find('.price, .deal-price, .cost, span:contains("$")').first();
          const cls = el.attr('class');
          suggestedFields[field] = cls ? `.${cls.split(' ')[0]}` : '.price';
        } else {
          suggestedFields[field] = '.price';
        }
      } else if (['category', 'tag', 'type'].includes(field)) {
        if (containerEls.find('.category, .tag, .badge, [data-category]').length > 0) {
          const el = containerEls.find('.category, .tag, .badge, [data-category]').first();
          const cls = el.attr('class');
          suggestedFields[field] = cls ? `.${cls.split(' ')[0]}` : '.category';
        } else {
          suggestedFields[field] = '.category';
        }
      } else if (['natural_key', 'id', 'sku'].includes(field)) {
        if (containerEls.attr('data-id')) {
          suggestedFields[field] = '.@data-id';
        } else if (containerEls.find('[data-id], [data-sku]').length > 0) {
          const el = containerEls.find('[data-id], [data-sku]').first();
          suggestedFields[field] = el.attr('data-id') ? `${el.prop('tagName')?.toLowerCase()}@data-id` : '.@data-id';
        } else {
          suggestedFields[field] = 'h3, .title';
        }
      } else if (['status', 'availability'].includes(field)) {
        suggestedFields[field] = '.status, .badge';
      } else if (['url', 'link', 'source_url'].includes(field)) {
        suggestedFields[field] = 'a@href';
      } else {
        suggestedFields[field] = `.${field}`;
      }
    }

    // Extract sample items
    const extractedItems: Record<string, any>[] = [];
    containerEls.each((i, el) => {
      const item: Record<string, any> = {};
      const container = $(el);

      for (const [field, selector] of Object.entries(suggestedFields)) {
        if (selector.includes('@')) {
          const [sel, attr] = selector.split('@');
          const target = sel === '.' ? container : container.find(sel);
          item[field] = target.attr(attr) || null;
        } else {
          const text = container.find(selector).first().text().trim();
          item[field] = text || null;
        }
      }

      if (!item.natural_key) {
        item.natural_key = item.title || item.name || `item-${i + 1}`;
      }

      extractedItems.push(item);
    });

    const parsed: RepairOutput = {
      extracted_items: extractedItems,
      suggested_patch: {
        container: chosenContainer,
        fields: suggestedFields,
        confidence_score: 0.95,
        repair_notes: 'Heuristically synthesized resilient selectors from DOM topology',
      },
    };

    return {
      rawJson: JSON.stringify(parsed),
      parsed,
      tokensUsed: 350,
      provider: 'mock-engine',
      model: 'heuristic-dom-v1',
      latencyMs: Date.now() - startTime,
    };
  }
}
