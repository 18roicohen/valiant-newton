import { FastifyPluginAsync } from 'fastify';

export const openApiSpec: Record<string, any> = {
  openapi: '3.1.0',
  info: {
    title: 'Dynep Micro-DaaS Engine API',
    version: '1.0.0',
    description:
      'Real-Time Autonomous AI Cloud GPU & Model Spot Intelligence API. High-throughput structured feeds covering 31 cloud providers (Lambda Labs, Vast.ai, RunPod, Vultr, LeaderGPU) with continuous self-healing scraping and sub-millisecond in-memory cached responses.',
    termsOfService: 'https://data.dynep.com/terms',
    contact: {
      name: 'Dynep Intelligence Support',
      url: 'https://data.dynep.com',
      email: 'keys@dynep.com',
    },
    license: {
      name: 'Proprietary / Commercial DaaS License',
      url: 'https://data.dynep.com/terms',
    },
  },
  servers: [
    {
      url: 'https://data.dynep.com',
      description: 'Production Global Edge Gateway (Cloudflare Tunnel)',
    },
    {
      url: 'https://micro-daas-engine.onrender.com',
      description: 'Secondary Cloud Backup Mirror (Render)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'System Liveness & Health Probe',
        description: 'Returns server operational status, system uptime in seconds, database connection state, and current engine version.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Engine is healthy and operational',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime_seconds: { type: 'integer', example: 3600 },
                    database: { type: 'string', example: 'in_memory_active' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v1/metrics': {
      get: {
        summary: 'Aggregated Pipeline & Crawler Metrics',
        description: 'Returns real-time scraping statistics, total records indexed, active sources, drift repairs, and LLM token usage.',
        operationId: 'getMetrics',
        responses: {
          '200': {
            description: 'Crawler metrics summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string', format: 'date-time' },
                    metrics: {
                      type: 'object',
                      properties: {
                        totalRecords: { type: 'integer', example: 64 },
                        activeSources: { type: 'integer', example: 14 },
                        activeSubscribers: { type: 'integer', example: 12 },
                        totalExtractions: { type: 'integer', example: 50 },
                        driftRepairs: { type: 'integer', example: 3 },
                        failedExtractions: { type: 'integer', example: 0 },
                        totalTokensUsed: { type: 'integer', example: 1050 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v1/data': {
      get: {
        summary: 'Query Structured GPU Spot Intelligence',
        description: 'Paginated, filterable high-precision AI cloud GPU hourly rate records with quota verification headers.',
        operationId: 'getDataRecords',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number for pagination',
            required: false,
            schema: { type: 'integer', default: 1, minimum: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum records per page (up to 100)',
            required: false,
            schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 },
          },
          {
            name: 'source_id',
            in: 'query',
            description: 'Filter records by UUID of the originating scraper source',
            required: false,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'sort_by',
            in: 'query',
            description: 'Record sorting column',
            required: false,
            schema: { type: 'string', default: 'updated_at', enum: ['updated_at', 'first_seen_at', 'natural_key'] },
          },
          {
            name: 'sort_dir',
            in: 'query',
            description: 'Sorting direction',
            required: false,
            schema: { type: 'string', default: 'desc', enum: ['asc', 'desc'] },
          },
          {
            name: 'since',
            in: 'query',
            description: 'ISO-8601 timestamp filter returning only records updated after this time',
            required: false,
            schema: { type: 'string', format: 'date-time' },
          },
        ],
        responses: {
          '200': {
            description: 'Filtered records collection with pagination metadata',
            headers: {
              'X-Quota-Limit': { schema: { type: 'integer' }, description: 'Subscriber monthly quota limit' },
              'X-Quota-Remaining': { schema: { type: 'integer' }, description: 'Subscriber remaining monthly requests' },
              'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Requests allowed per minute (RPM)' },
              'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Remaining requests in current minute window' },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          entity_id: { type: 'string', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
                          source_id: { type: 'string', format: 'uuid' },
                          natural_key: { type: 'string', example: 'NVIDIA H100 80GB SXM5' },
                          data: {
                            type: 'object',
                            properties: {
                              title: { type: 'string', example: 'NVIDIA H100 SXM5' },
                              price: { type: 'number', example: 2.39 },
                              provider: { type: 'string', example: 'Lambda Labs' },
                              region: { type: 'string', example: 'us-east-1' },
                              status: { type: 'string', example: 'available' },
                            },
                          },
                          hash: { type: 'string' },
                          version: { type: 'integer', example: 1 },
                          first_seen_at: { type: 'string', format: 'date-time' },
                          updated_at: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 50 },
                        total_records: { type: 'integer', example: 64 },
                        total_pages: { type: 'integer', example: 2 },
                        has_more: { type: 'boolean', example: true },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or malformed Authorization header' },
          '403': { description: 'Invalid API Key or Inactive Subscription' },
          '429': { description: 'Rate Limit (RPM) or Monthly Quota Exceeded' },
        },
      },
    },
    '/v1/data/{id}': {
      get: {
        summary: 'Lookup Single Entity by SHA-256 ID',
        description: 'Fetch complete metadata and snapshot for a specific unique hardware instance or model record.',
        operationId: 'getRecordById',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'SHA-256 natural entity identifier',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Detailed entity record',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        entity_id: { type: 'string' },
                        source_id: { type: 'string', format: 'uuid' },
                        natural_key: { type: 'string' },
                        data: { type: 'object' },
                        version: { type: 'integer' },
                        updated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': { description: 'Entity ID not found' },
        },
      },
    },
    '/v1/feed.json': {
      get: {
        summary: 'High-Throughput JSON Stream Feed',
        description: 'Batch-optimized JSON export designed for direct database ingestion pipelines, ETL tools, and quant models.',
        operationId: 'getFeedJson',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'source_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 1000, maximum: 5000 } },
        ],
        responses: {
          '200': {
            description: 'Batch array of records',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer', example: 64 },
                    generated_at: { type: 'string', format: 'date-time' },
                    feed: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v1/feed.csv': {
      get: {
        summary: 'RFC 4180 Flattened CSV Feed',
        description: 'Dynamically column-flattened CSV export compatible with pandas, Excel, and automated data pipelines.',
        operationId: 'getFeedCsv',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'source_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 1000, maximum: 5000 } },
        ],
        responses: {
          '200': {
            description: 'Flattened RFC 4180 CSV file stream',
            content: {
              'text/csv': {
                schema: { type: 'string', example: 'entity_id,natural_key,price,provider,region,updated_at' },
              },
            },
          },
        },
      },
    },
    '/api/keys/free': {
      post: {
        summary: 'Generate Instant Free Tier API Key',
        description: 'Captures user email and issues an active free trial API key with 50-100 requests/month quota.',
        operationId: 'createFreeApiKey',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'developer@example.com' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Free trial API key issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    api_key: { type: 'string', example: 'sk_live_a1b2c3d4e5f6...' },
                    email: { type: 'string' },
                    tier: { type: 'string', example: 'free' },
                    monthly_quota: { type: 'integer', example: 100 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/checkout/create': {
      post: {
        summary: 'Initiate Polar.sh Paid Subscription Checkout',
        description: 'Creates a Polar checkout session with pre-applied promotional coupons (e.g. DYNEP37 for 37% off).',
        operationId: 'createCheckoutSession',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'tier'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'pro-user@domain.com' },
                  tier: { type: 'string', enum: ['starter', 'pro', 'enterprise'], default: 'starter' },
                  discountCode: { type: 'string', default: 'DYNEP37', example: 'DYNEP37' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Checkout session URL generated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    checkoutUrl: { type: 'string', format: 'uri' },
                    product: { type: 'string' },
                    price: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Provide your secret API Key prefixed with `sk_live_` in the `Authorization: Bearer <key>` header.',
      },
    },
  },
};

export const docsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /openapi.json
   * Comprehensive OpenAPI 3.1 specification for RapidAPI Hub and Postman
   */
  fastify.get('/openapi.json', async (_request, reply) => {
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Access-Control-Allow-Origin', '*');
    return openApiSpec;
  });

  /**
   * GET /docs
   * Modern, interactive Scalar API documentation UI
   */
  fastify.get('/docs', async (_request, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dynep Micro-DaaS API Reference — Real-Time Cloud GPU Intelligence</title>
  <meta name="description" content="Interactive developer documentation and live API explorer for Dynep Cloud GPU spot rates." />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #020617;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .custom-header {
      background-color: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 12px 24px;
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
    }
    .links {
      display: flex;
      gap: 16px;
      font-size: 13px;
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
      <span>⚡ Dynep Data Engine</span>
      <span class="badge">v1.0 Production</span>
    </a>
    <div class="links">
      <a href="/openapi.json" target="_blank">Raw OpenAPI Spec</a>
      <a href="/terms">Terms of Service</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/">Portal Home</a>
    </div>
  </div>

  <script
    id="api-reference"
    data-url="/openapi.json"
    data-configuration='{
      "theme": "deepSpace",
      "darkMode": true,
      "metaData": {
        "title": "Dynep Micro-DaaS Engine API Reference"
      },
      "hideDownloadButton": false,
      "servers": [
        { "url": "https://data.dynep.com", "description": "Production Edge" }
      ]
    }'
    src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
  ></script>
</body>
</html>`;
  });
};
