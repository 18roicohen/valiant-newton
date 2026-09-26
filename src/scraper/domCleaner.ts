import * as cheerio from 'cheerio';

export interface CleanerOptions {
  maxCharacters?: number;
  preserveAttributes?: string[];
  stripComments?: boolean;
}

export class DomCleaner {
  private static readonly NOISY_TAGS = [
    'script',
    'style',
    'svg',
    'noscript',
    'iframe',
    'template',
    'meta',
    'link',
    'audio',
    'video',
    'canvas',
    'source',
    'track',
    'map',
    'object',
    'embed',
  ];

  private static readonly JUNK_ATTRIBUTES = [
    'style',
    'onclick',
    'onload',
    'onerror',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'data-tracker',
    'data-analytics',
    'data-gtm',
    'data-ga',
    'data-reactid',
    'data-v-',
  ];

  /**
   * Cleans a raw HTML document down to a semantic, minimal representation
   * for cost-effective LLM processing.
   */
  static clean(rawHtml: string, options: CleanerOptions = {}): string {
    const {
      maxCharacters = 30000,
      preserveAttributes = ['id', 'class', 'data-id', 'data-sku', 'data-testid', 'href', 'src', 'title', 'alt'],
      stripComments = true,
    } = options;

    if (!rawHtml || typeof rawHtml !== 'string') {
      return '';
    }

    const $ = cheerio.load(rawHtml);

    // 1. Remove non-semantic and noisy tags
    for (const tag of this.NOISY_TAGS) {
      $(tag).remove();
    }

    // 2. Remove comments if requested
    if (stripComments) {
      $('*')
        .contents()
        .filter(function () {
          return this.type === 'comment';
        })
        .remove();
    }

    // 3. Remove base64 image blobs to conserve massive tokens
    $('img[src^="data:"]').attr('src', '[base64-image]');

    // 4. Strip noisy attributes from all elements
    $('*').each((_, el) => {
      if (el.type === 'tag') {
        const attribs = el.attribs || {};
        for (const attrName of Object.keys(attribs)) {
          // If attribute is explicitly junk or starts with data-v-, remove it
          if (
            this.JUNK_ATTRIBUTES.some((junk) => attrName.toLowerCase().startsWith(junk)) ||
            (!preserveAttributes.includes(attrName) && !attrName.startsWith('data-'))
          ) {
            $(el).removeAttr(attrName);
          }
        }
      }
    });

    // 5. Look for semantic body or main content wrapper
    let targetHtml = $('main').html();
    if (!targetHtml) {
      targetHtml = $('#main, #content, .main-content, .container, .products, .catalog, .content').first().html() || null;
    }
    if (!targetHtml) {
      targetHtml = $('body').html() || null;
    }
    if (!targetHtml) {
      targetHtml = $.root().html() || '';
    }

    let cleanedHtml = targetHtml || '';

    // 6. Compress excessive whitespace and line breaks
    cleanedHtml = cleanedHtml
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // 7. Enforce max token / character budget
    if (cleanedHtml.length > maxCharacters) {
      cleanedHtml = cleanedHtml.substring(0, maxCharacters) + '\n<!-- [TRUNCATED FOR TOKEN LIMIT] -->';
    }

    return cleanedHtml;
  }
}
