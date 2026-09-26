import { TargetSchemaDefinition, SelectorMap } from '../db/schema.js';

export function buildSelfHealingPrompt(
  sanitizedHtml: string,
  targetSchema: TargetSchemaDefinition,
  brokenSelectorMap: SelectorMap,
  driftReason?: string
): { system: string; user: string } {
  const schemaDescription = Object.entries(targetSchema)
    .map(([field, type]) => `  - "${field}": (${type})`)
    .join('\n');

  const system = `You are an Autonomous Web Scraping Repair Specialist and CSS/XPath Selector Engineer.
Your task is to analyze sanitized HTML, identify target entities matching a target schema, extract them accurately with ZERO hallucination, and propose resilient CSS selectors so future runs execute at fast-path speed with zero LLM overhead.

CRITICAL RULES:
1. ZERO HALLUCINATION: Only extract data present in the provided HTML. If a field is not found in the HTML, set its value to null.
2. SELECTOR RESILIENCY: Generate clean, robust CSS selectors for the target schema (e.g., model, provider, hourly_rate, region, specs, price, title).
   - Propose a container selector that matches all item cards/rows (e.g. "article.deal-card", "div.product-item", "tr.item-row", "table tbody tr").
   - Propose field selectors relative to the container (e.g. "h3.title", "span.price", "a.link@href", "div@data-id", "td:nth-child(2)").
   - Use "@attr" syntax to extract HTML attributes like "@href", "@src", "@data-id", "@data-track-gpu".
3. STRICT JSON OUTPUT: Return ONLY a valid JSON object matching this schema:
{
  "extracted_items": [
    {
      "natural_key": "string",
      ...other schema fields
    }
  ],
  "suggested_patch": {
    "container": "string (CSS selector)",
    "fields": {
      "fieldName": "string (relative CSS selector or selector@attr)"
    },
    "confidence_score": number (0.0 to 1.0),
    "repair_notes": "string"
  }
}`;

  const user = `TARGET EXTRACTION SCHEMA:
${schemaDescription}

BROKEN/DRIFTED SELECTOR MAP:
${JSON.stringify(brokenSelectorMap, null, 2)}

DRIFT REASON:
${driftReason || 'Fast-path failed or returned anomalous/empty payload'}

SANITIZED HTML DOM SNAPSHOT:
\`\`\`html
${sanitizedHtml}
\`\`\`

Analyze the HTML snapshot, extract all matching items, and provide the repaired selector map in JSON format:`;

  return { system, user };
}
