/**
 * Dynep Documentation, Legal & OpenAPI Pages for Cloudflare Workers Edge
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'DYNEP DGX-31 Institutional AI Cloud GPU Spot Intelligence API',
    version: '2.0.0',
    description:
      'Global, sub-millisecond real-time market data feed for AI compute arbitrage, spot GPU tracking, and automated cluster deployment across 31+ providers.',
    contact: {
      name: 'Dynep Global Intelligence Desk',
      email: 'keys@dynep.com',
      url: 'https://data.dynep.com',
    },
  },
  servers: [{ url: 'https://data.dynep.com', description: 'Global Serverless Edge Gateway' }],
  paths: {
    '/health': {
      get: {
        summary: 'Edge Node Health & Database Connectivity',
        responses: { '200': { description: 'Edge cluster healthy' } },
      },
    },
    '/v1/spot/summary': {
      get: {
        summary: 'Zero-Auth Institutional Spot Index Benchmark',
        description: 'Instant edge-cached composite benchmark comparing H100, H200, B200, and RTX 4090 spot rates against AWS EC2 On-Demand baselines.',
        responses: { '200': { description: 'Real-time spot index' } },
      },
    },
    '/v1/data': {
      get: {
        summary: 'Authenticated Real-Time GPU Spot Market Query',
        description: 'Filters live GPU spot instances across 31 providers with keyset cursor pagination.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Hardware or provider filter (e.g. H100, RunPod)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 250 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated list of normalized GPU instances' }, '401': { description: 'Missing or invalid API key' } },
      },
    },
    '/v1/feed.csv': {
      get: {
        summary: 'RFC 4180 Flattened CSV Stream Export',
        description: 'High-frequency streaming CSV export for pandas, Excel, and automated quant trading pipelines.',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'RFC 4180 compliant CSV file' } },
      },
    },
    '/v1/agent/mcp': {
      post: {
        summary: 'Model Context Protocol (MCP) JSON-RPC 2.0',
        description: 'Native tool protocol for Cursor IDE, Claude Desktop, and autonomous LLM orchestration agents.',
        responses: { '200': { description: 'JSON-RPC response' } },
      },
    },
    '/api/keys/free': {
      post: {
        summary: 'Claim Free Instant Developer Key',
        description: 'Issues a free evaluation API key with 100 requests/month quota in 5 seconds without credit card.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { '201': { description: 'API key provisioned' } },
      },
    },
    '/api/checkout/create': {
      post: {
        summary: 'Create Polar.sh Paid Subscription Checkout',
        description: 'Generates an institutional Stripe Express checkout session with DYNEP37 promotional discount.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'tier'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  tier: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Checkout session created' } },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Provide your secret API Key prefixed with `sk_live_` in the `Authorization: Bearer <key>` header or `x-api-key`.',
      },
    },
  },
};

export const docsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DYNEP Micro-DaaS API Reference — Real-Time Cloud GPU Intelligence</title>
  <meta name="description" content="Interactive developer documentation and live API explorer for Dynep Cloud GPU spot rates across 31 clouds." />
  <link rel="icon" type="image/svg+xml" href="/logo-icon.svg">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #020617;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .custom-header {
      background-color: #070a13;
      border-bottom: 1px solid #1e293b;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 16px;
      color: #fff;
      text-decoration: none;
    }
    .badge {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
      font-family: monospace;
    }
    .links {
      display: flex;
      gap: 18px;
      font-size: 13px;
      font-family: monospace;
    }
    .links a {
      color: #94a3b8;
      text-decoration: none;
      transition: color 0.2s;
    }
    .links a:hover {
      color: #34d399;
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <a href="/" class="brand">
      <img src="/logo-icon.svg" width="24" height="24" alt="Dynep Logo" style="border-radius: 4px;" />
      <span>DYNEP Spot Intelligence</span>
      <span class="badge">v2.0 Production Edge</span>
    </a>
    <div class="links">
      <a href="/openapi.json" target="_blank">OpenAPI 3.1 Spec</a>
      <a href="/portal">Customer Portal ↗</a>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="/">← Live Terminal</a>
    </div>
  </div>

  <script
    id="api-reference"
    data-url="/openapi.json"
    data-configuration='{
      "theme": "deepSpace",
      "darkMode": true,
      "metaData": {
        "title": "DYNEP GPU Spot API Reference"
      },
      "hideDownloadButton": false,
      "servers": [
        { "url": "https://data.dynep.com", "description": "Production Edge (Global Cloudflare Workers)" }
      ]
    }'
    src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
  ></script>
</body>
</html>`;

export const termsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service & Disclaimer — Dynep Real-Time GPU Intelligence</title>
  <link rel="icon" type="image/svg+xml" href="/logo-icon.svg">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 font-sans min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl">
    <a href="/" class="text-emerald-400 hover:text-emerald-300 text-sm font-semibold mb-6 inline-block font-mono">← Back to Dynep Live Terminal</a>
    <h1 class="text-3xl font-black text-white mb-2 tracking-tight">Terms of Service & Disclaimer</h1>
    <p class="text-slate-400 text-sm mb-8 font-mono">Effective Date: September 26, 2026 | Last Updated: October 2026</p>

    <div class="space-y-6 text-sm text-slate-300 leading-relaxed">
      <section>
        <h2 class="text-lg font-bold text-white mb-2">1. Agreement to Terms</h2>
        <p>By accessing or using data.dynep.com ("Service", "Platform", or "API"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.</p>
      </section>

      <section class="bg-slate-950 p-5 rounded-xl border border-amber-900/40">
        <h2 class="text-lg font-bold text-amber-400 mb-2">2. Third-Party Spot Data Disclaimer ("AS-IS")</h2>
        <p class="mb-2">Dynep aggregates, normalizes, and publishes real-time public cloud GPU pricing from external third-party infrastructure providers (including but not limited to Lambda Labs, Vast.ai, RunPod, LeaderGPU, AWS, and others). All data is provided strictly on an <strong>"AS-IS" AND "AS-AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND</strong>.</p>
        <p class="mb-2">Dynep does not own, operate, lease, or guarantee the underlying hardware accelerators. Spot market pricing, server availability, preemption likelihood, hardware health, and geographical network latency are governed solely by third-party cloud vendors.</p>
        <p>Dynep expressly disclaims any liability for financial losses, compute overruns, missed arbitrage opportunities, benchmark discrepancies, or training interruptions caused by vendor price volatility or data feed latency.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">3. Subscription, Quotas & Polar.sh Billing</h2>
        <p class="mb-2">Subscriptions and commercial API licenses are billed monthly via Polar.sh (acting as Merchant of Record). Subscriptions automatically renew each billing cycle unless cancelled prior to the renewal date via the Customer Billing Portal (<a href="/portal" class="text-emerald-400 underline">data.dynep.com/portal</a>).</p>
        <p>Each subscription tier includes a defined monthly request quota and rate limits. Unused request quotas expire at the end of each billing cycle and do not roll over.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">4. 14-Day Full Refund Policy & Cancellations</h2>
        <p>Subscribers are entitled to a full, unconditional refund within fourteen (14) calendar days of their initial payment. You may cancel your subscription instantly at any time via the billing portal. Upon cancellation, your access remains active until the end of your prepaid period.</p>
      </section>

      <section class="bg-slate-950 p-5 rounded-xl border border-rose-900/40">
        <h2 class="text-lg font-bold text-rose-400 mb-2">5. Strict Limitation of Liability</h2>
        <p class="mb-2">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL DYNEP, ITS FOUNDERS, OPERATORS, AFFILIATES, OFFICERS, DIRECTORS, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF REVENUE, LOSS OF PROFITS, DATA LOSS, COMPUTE OVERRUNS, SYSTEM PREEMPTION, HARDWARE FAILURE, DOWNTIME, OR BUSINESS INTERRUPTION.</p>
        <p>IN ANY EVENT, THE MAXIMUM AGGREGATE LIABILITY OF DYNEP UNDER THESE TERMS SHALL BE STRICTLY AND ABSOLUTELY CAPPED AT THE LESSER OF: (A) THE TOTAL AMOUNT ACTUALLY PAID BY YOU IN THE ONE (1) MONTH IMMEDIATELY PRECEDING THE CLAIM, OR (B) $50.00 USD.</p>
      </section>

      <section class="bg-slate-950 p-5 rounded-xl border border-emerald-900/40">
        <h2 class="text-lg font-bold text-emerald-400 mb-2">6. Comprehensive Indemnification</h2>
        <p>You agree to defend, indemnify, and hold harmless Dynep, its operators, parent entities, affiliates, and contractors from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) resulting from: (a) your use of the Service or API data; (b) any cluster deployment or compute expenditure made in reliance on data provided by Dynep; or (c) your violation of these Terms.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">7. Acceptable Use Policy</h2>
        <p>You agree not to: (a) circumvent, tamper with, or bypass rate limits, authentication tokens, or quota controls; (b) initiate Denial of Service (DoS/DDoS) attacks against our edge network; (c) redistribute, sublicense, or resell raw API feeds to third parties without an explicit Enterprise License; or (d) deploy automated bots to aggressively reverse engineer Dynep's internal extractors.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">8. Contact Information</h2>
        <p>For legal inquiries, enterprise agreements, or questions regarding these terms, contact: <a href="mailto:keys@dynep.com" class="text-emerald-400 underline font-mono">keys@dynep.com</a>.</p>
      </section>
    </div>

    <div class="mt-10 pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-500 font-mono">
      <span>© 2026 Dynep Intelligence. All rights reserved.</span>
      <div class="space-x-4">
        <a href="/privacy" class="text-slate-400 hover:text-white">Privacy Policy</a>
        <a href="/portal" class="text-slate-400 hover:text-white">Customer Portal</a>
        <a href="/" class="text-slate-400 hover:text-white">Live Terminal</a>
      </div>
    </div>
  </div>
</body>
</html>`;

export const privacyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Dynep Real-Time GPU Intelligence</title>
  <link rel="icon" type="image/svg+xml" href="/logo-icon.svg">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 font-sans min-h-screen py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 shadow-2xl">
    <a href="/" class="text-emerald-400 hover:text-emerald-300 text-sm font-semibold mb-6 inline-block font-mono">← Back to Dynep Live Terminal</a>
    <h1 class="text-3xl font-black text-white mb-2 tracking-tight">Privacy Policy</h1>
    <p class="text-slate-400 text-sm mb-8 font-mono">Effective Date: September 26, 2026 | Compliant with GDPR & CCPA</p>

    <div class="space-y-6 text-sm text-slate-300 leading-relaxed">
      <section>
        <h2 class="text-lg font-bold text-white mb-2">1. Overview</h2>
        <p>Dynep ("we", "our", or "us") respects your privacy. This policy explains how information is collected, processed, and safeguarded when using data.dynep.com and associated API endpoints.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">2. Information We Collect</h2>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Contact Information:</strong> Your email address when registering for an evaluation API key or purchasing a subscription.</li>
          <li><strong>API Telemetry:</strong> Request counts, HTTP methods, queried endpoints, timestamps, and IP addresses strictly for abuse prevention, quota metering, and rate limiting.</li>
          <li><strong>Payment Information:</strong> We do NOT store credit cards or banking details. All transactions are securely processed directly by Polar.sh and Stripe.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">3. How Information Is Used</h2>
        <p>Your data is used solely to: (a) generate and deliver API keys via transactional email (Resend); (b) meter subscription quotas; (c) prevent malicious traffic and DDoS attacks; and (d) send critical operational updates.</p>
        <p class="mt-2 text-emerald-400 font-semibold">We never sell, rent, or trade your personal information to third parties, brokers, or advertisers.</p>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">4. Third-Party Service Providers</h2>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Polar.sh:</strong> Merchant of Record for payments and subscription management.</li>
          <li><strong>Resend:</strong> Secure transactional email delivery for API keys.</li>
          <li><strong>Cloudflare:</strong> Edge routing, DDoS mitigation, and privacy-preserving analytics.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-bold text-white mb-2">5. Data Retention & Erasure (GDPR / CCPA)</h2>
        <p>You have the right to request deletion of your account and email records at any time. Simply email <a href="mailto:keys@dynep.com" class="text-emerald-400 underline font-mono">keys@dynep.com</a> and we will delete your record within 48 hours.</p>
      </section>
    </div>

    <div class="mt-10 pt-6 border-t border-slate-800 flex justify-between text-xs text-slate-500 font-mono">
      <span>© 2026 Dynep Intelligence. All rights reserved.</span>
      <div class="space-x-4">
        <a href="/terms" class="text-slate-400 hover:text-white">Terms of Service</a>
        <a href="/portal" class="text-slate-400 hover:text-white">Customer Portal</a>
        <a href="/" class="text-slate-400 hover:text-white">Live Terminal</a>
      </div>
    </div>
  </div>
</body>
</html>`;
