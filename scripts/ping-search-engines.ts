/**
 * Automated Search Engine & IndexNow Notifier
 * Programmatically notifies search engines (Bing, Yandex, Seznam, Naver) of all landing pages
 * Zero manual posting required.
 */

const INDEXNOW_KEY = 'dynep-indexnow-7b4c8e192f6a';
const HOST = 'data.dynep.com';

const URLS_TO_INDEX = [
  'https://data.dynep.com/',
  'https://data.dynep.com/v1/spot/summary',
  'https://data.dynep.com/gpu/h100-lowest-price',
  'https://data.dynep.com/gpu/h200-spot-rates',
  'https://data.dynep.com/gpu/b200-spot-price',
  'https://data.dynep.com/gpu/a100-lowest-price',
  'https://data.dynep.com/gpu/rtx-4090-spot-rates',
  'https://data.dynep.com/gpu/rtx-5090-spot-rates',
  'https://data.dynep.com/gpu/rtx-a6000-lowest-price',
  'https://data.dynep.com/gpu/rtx-4000-ada-spot-rates',
  'https://data.dynep.com/gpu/nvidia-a16-spot-rates',
  'https://data.dynep.com/gpu/rtx-5060-ti-spot-rates',
  'https://data.dynep.com/compare/aws-vs-spot',
  'https://data.dynep.com/.well-known/mcp.json',
];

export async function pingSearchEngines() {
  console.log('========================================================');
  console.log('🌐 AUTONOMOUS SEARCH ENGINE INDEXING & INDEXNOW ENGINE');
  console.log('========================================================\n');

  console.log(`Submitting ${URLS_TO_INDEX.length} programmatic pages to IndexNow API...`);

  try {
    const payload = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/dynep-indexnow-key.txt`,
      urlList: URLS_TO_INDEX,
    };

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (response.status === 200 || response.status === 202) {
      console.log(`✅ IndexNow successfully accepted payload (HTTP ${response.status})!`);
      console.log('   Bing, Yandex, Seznam, and partner engines notified of new live GPU pages.');
    } else {
      const errText = await response.text();
      console.warn(`⚠️ IndexNow returned HTTP ${response.status}: ${errText}`);
    }
  } catch (err: any) {
    console.error('❌ Failed connecting to IndexNow:', err.message);
  }

  console.log('\n📡 Verifying sitemap accessibility...');
  try {
    const sitemapRes = await fetch(`https://${HOST}/sitemap.xml`);
    console.log(`   Sitemap status: HTTP ${sitemapRes.status} (Length: ${sitemapRes.headers.get('content-length') || 'dynamic'} bytes)`);
  } catch (err: any) {
    console.error('   Sitemap check error:', err.message);
  }

  console.log('\n🚀 Autonomous indexing complete. Crawlers will index pages organically.');
}

if (process.argv[1]?.endsWith('ping-search-engines.ts')) {
  pingSearchEngines().catch(console.error);
}
