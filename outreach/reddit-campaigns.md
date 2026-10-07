# Reddit Developer Recruitment Campaigns

---

## 1. r/LocalLLaMA (~280k AI Developers & Fine-Tuners)

* **Target URL:** https://www.reddit.com/r/LocalLLaMA/submit
* **Flair:** `Project / Resource`
* **Title:** `I built a free real-time GPU spot price API tracking 31 clouds (H100, A100, RTX 4090) so you never overpay for fine-tuning`

### Post Body:

Hey everyone,

Like many of you fine-tuning 70B models or serving vLLM / Ollama instances, I was constantly jumping between RunPod, Lambda Labs, Vast.ai, LeaderGPU, and half a dozen provider dashboards just to see who had available spot VRAM at reasonable rates.

To solve this, I built an edge indexer and API tracking 31 cloud GPU providers in real-time: **https://data.dynep.com**

### Current Spot Benchmark (Live Sample):
| Hardware Accelerator | Cheapest Host | Dynep Spot Rate | AWS EC2 Baseline | Arbitrage Savings |
| :--- | :--- | :--- | :--- | :--- |
| **NVIDIA H100 SXM5 80GB** | LeaderGPU | **$1.99 / hr** | $4.50 / hr | **-56%** |
| **NVIDIA H200 141GB** | Lambda Labs | **$3.49 / hr** | $5.80 / hr | **-40%** |
| **NVIDIA B200 Blackwell** | RunPod | **$4.85 / hr** | $7.20 / hr | **-33%** |
| **NVIDIA A100 SXM4 80GB** | LeaderGPU | **$0.68 / hr** | $3.06 / hr | **-78%** |
| **NVIDIA RTX 4090 24GB** | Vast.ai | **$0.34 / hr** | $1.10 / hr | **-69%** |
| **NVIDIA L40S 48GB** | FluidStack | **$0.85 / hr** | $2.15 / hr | **-60%** |

### Test it in 1 second in your terminal (No Auth, No Key):
```bash
curl -s https://data.dynep.com/v1/spot/summary
```

### 1-Line CLI Terminal:
```bash
# Inspect live market depth for RTX 4090 or H100:
npx dynep-spot --gpu 4090
```

### Official Python SDK:
```bash
pip install dynep
```
```python
from dynep import DynepClient

client = DynepClient()
quote = client.get_cheapest_spot("H100")
print(f"Deploy on {quote.best_provider} for ${quote.spot_rate_hourly_usd}/hr (-{quote.cost_savings_vs_aws_percent} vs AWS)")
print(f"Direct deploy URL: {quote.deploy_url}")
```

### Model Context Protocol (MCP) for Cursor / Claude Desktop:
You can also run Dynep as an MCP server so your local coding agent can find compute:
```json
{
  "mcpServers": {
    "dynep-spot": {
      "command": "npx",
      "args": ["-y", "dynep-spot", "--mcp"]
    }
  }
}
```

### Free Tier:
There is an instant 100 req/mo evaluation tier on the homepage (1 click, zero card or sign-up friction). You can also set up free real-time price drop alerts to Discord/Slack/Email via `POST /api/alerts/subscribe`.

Would love feedback on:
1. What additional niche providers or bare-metal clouds should be indexed next?
2. What hardware filters (e.g. PCIe vs SXM5, InfiniBand vs Ethernet) are most critical for your pipelines?

---

## 2. r/dataengineering (~180k Data Architects & Infrastructure Engineers)

* **Target URL:** https://www.reddit.com/r/dataengineering/submit
* **Flair:** `Data Architecture`
* **Title:** `How we track & normalize spot pricing across 31 GPU clouds on Cloudflare Workers + D1 for <$5/mo`

### Post Body:

Hi r/dataengineering,

Aggregating real-time pricing data across 31 independent cloud GPU providers (AWS, RunPod, Vast.ai, Lambda Labs, LeaderGPU, Vultr, etc.) turned out to be an interesting edge engineering challenge. Every provider has different pricing semantics (per-GPU vs per-server, varying currencies, community vs secure cloud, and missing standard APIs).

We built **Dynep** (https://data.dynep.com) to solve this: an edge-native data pipeline running globally on Cloudflare Workers and Cloudflare D1 (distributed SQLite).

### Architecture Breakdown:
1. **Hybrid Ingestion Engine:** Direct API ingestion for providers with public endpoints (Vast.ai REST, RunPod GraphQL, Lambda Labs instance catalog) + C++ streaming `HTMLRewriter` parsing for HTML catalogs. This avoids running heavy headless browsers like Chromium at the edge.
2. **Atomic Write Batching in D1:** Crawlers run on 15-minute Edge Cron triggers. To prevent SQLite write locking and network round-trips, updates are written in atomic transactions via `db.batch()`.
3. **Sub-15ms Global Edge Serving:** Responses for the zero-auth public summary (`/v1/spot/summary`) are cached via the Cloudflare Edge Cache API (`s-maxage=60, stale-while-revalidate=300`), delivering sub-15ms response times worldwide.

Test the public benchmark without auth:
```bash
curl -s https://data.dynep.com/v1/spot/summary
```

Curious to hear how other teams handle edge data aggregation and SQLite write concurrency at scale. Feedback and architecture roasts welcome!
