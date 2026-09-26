import * as cheerio from 'cheerio';
import { SelectorMap, FieldExtractionRule } from '../db/schema.js';
import { RawExtractedItem } from '../normalizer/normalizer.js';

export interface ParsedFieldConfig {
  selector: string;
  attribute?: string;
  regex?: RegExp;
}

export class FastPathParser {
  /**
   * Helper to parse a field extraction rule string or object
   * Examples:
   *   "h3.title" -> selector: "h3.title"
   *   "a.link@href" -> selector: "a.link", attribute: "href"
   *   "span.price | regex:\\$([0-9.]+)" -> selector: "span.price", regex: /\$([0-9.]+)/
   *   "span.price | ([0-9.]+)" -> selector: "span.price", regex: /([0-9.]+)/
   */
  static parseRule(rule: FieldExtractionRule): ParsedFieldConfig {
    if (typeof rule === 'object' && rule !== null) {
      return {
        selector: rule.selector,
        attribute: rule.attribute,
        regex: rule.regex ? new RegExp(rule.regex) : undefined,
      };
    }

    const str = String(rule).trim();
    let selector = str;
    let attribute: string | undefined;
    let regex: RegExp | undefined;

    // Check for regex pipeline: selector | regex:... or selector | ...
    if (selector.includes('|')) {
      const parts = selector.split('|').map((s) => s.trim());
      selector = parts[0];
      const regexPattern = parts[1].replace(/^regex:/i, '').trim();
      if (regexPattern) {
        try {
          regex = new RegExp(regexPattern);
        } catch {
          // ignore invalid regex string
        }
      }
    }

    // Check for attribute pipeline: selector@attr
    if (selector.includes('@')) {
      const parts = selector.split('@');
      selector = parts[0].trim();
      attribute = parts[1].trim();
    }

    return { selector, attribute, regex };
  }

  /**
   * Extracts value for a single field from a container element
   */
  static extractFieldValue($: cheerio.CheerioAPI, containerEl: cheerio.Cheerio<any>, rule: FieldExtractionRule): unknown {
    const config = this.parseRule(rule);
    
    // Find target element within container (or container itself if selector is "." or empty)
    let targetEl = config.selector === '.' || !config.selector ? containerEl : containerEl.find(config.selector);

    if (targetEl.length === 0) {
      return null;
    }

    let rawValue: string | undefined;

    if (config.attribute) {
      rawValue = targetEl.attr(config.attribute);
    } else {
      rawValue = targetEl.text();
    }

    if (!rawValue) {
      return null;
    }

    rawValue = rawValue.replace(/\s+/g, ' ').trim();

    if (config.regex) {
      const match = rawValue.match(config.regex);
      if (match) {
        rawValue = match[1] !== undefined ? match[1] : match[0];
      }
    }

    return rawValue.length > 0 ? rawValue : null;
  }

  /**
   * Parses an HTML string using the provided selector map
   */
  static parse(html: string, selectorMap: SelectorMap): RawExtractedItem[] {
    const $ = cheerio.load(html);
    const containerSelector = selectorMap.container;
    const containers = $(containerSelector);

    const results: RawExtractedItem[] = [];

    containers.each((_, el) => {
      const item: RawExtractedItem = {};
      const containerEl = $(el);

      for (const [fieldName, rule] of Object.entries(selectorMap.fields)) {
        const val = this.extractFieldValue($, containerEl, rule);
        item[fieldName] = val;
      }

      results.push(item);
    });

    return results;
  }
}
