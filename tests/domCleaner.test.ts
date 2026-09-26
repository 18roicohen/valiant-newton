import { describe, it, expect } from 'vitest';
import { DomCleaner } from '../src/scraper/domCleaner.js';

describe('DomCleaner', () => {
  it('strips <script>, <style>, and <svg> tags completely', () => {
    const dirtyHtml = `
      <div>
        <script>console.log("tracking");</script>
        <style>.bad { color: red; }</style>
        <svg><circle cx="50" cy="50" r="40" /></svg>
        <p class="content">Clean Title</p>
      </div>
    `;
    const cleaned = DomCleaner.clean(dirtyHtml);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<style>');
    expect(cleaned).not.toContain('<svg>');
    expect(cleaned).toContain('Clean Title');
  });

  it('removes noisy inline event handlers and styles', () => {
    const dirtyHtml = `
      <div style="margin: 20px; display: flex;" onclick="doTrack()" data-analytics="1234">
        <span class="price">$99.99</span>
      </div>
    `;
    const cleaned = DomCleaner.clean(dirtyHtml);
    expect(cleaned).not.toContain('style=');
    expect(cleaned).not.toContain('onclick=');
    expect(cleaned).not.toContain('data-analytics=');
    expect(cleaned).toContain('$99.99');
  });

  it('replaces base64 image blobs to conserve token budget', () => {
    const dirtyHtml = `
      <div>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
      </div>
    `;
    const cleaned = DomCleaner.clean(dirtyHtml);
    expect(cleaned).toContain('src="[base64-image]"');
    expect(cleaned).not.toContain('iVBORw0KGgo');
  });

  it('respects character and token budget limits', () => {
    const largeHtml = '<div>' + '<p>Long repetitive content</p>'.repeat(500) + '</div>';
    const cleaned = DomCleaner.clean(largeHtml, { maxCharacters: 500 });
    expect(cleaned.length).toBeLessThanOrEqual(600);
    expect(cleaned).toContain('[TRUNCATED FOR TOKEN LIMIT]');
  });
});
