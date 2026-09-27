# Reddit Developer Recruitment Campaigns

---

## 1. r/LocalLLaMA (~250k AI Developers & Fine-Tuners)

* **Target URL:** https://www.reddit.com/r/LocalLLaMA/submit
* **Flair:** `Project`
* **Title:** `I built a free real-time GPU spot price API tracking 31 clouds (H100, A100, RTX 4090) so you never overpay for fine-tuning`

### Post Body:

Hey everyone,

Like many of you fine-tuning 70B models or serving vLLM / Ollama instances, I was constantly jumping between RunPod, Lambda Labs, Vast.ai, LeaderGPU, and half a dozen provider dashboards just to see who had available spot VRAM at reasonable rates.

To solve this, I built an indexer and API tracking 31 cloud GPU providers in real-time: **https://data.dynep.com**

### What it does:
- Normalizes spot rates, on-demand pricing, VRAM, and region across 31 clouds.
- Computes real-time price spreads vs AWS EC2 standard rates (e.g., today an H100 SXM5 is $1.99/hr on LeaderGPU vs $4.50/hr on AWS EC2 p5 — a 56% spread).
- Zero-auth summary endpoint: test it in 1 second right now in your terminal:
  ```bash
  curl -s https://data.dynep.com/v1/spot/summary
  ```

### 1-Line CLI Terminal:
```bash
# Query live spot depth across all 31 clouds:
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

### Free Tier & Launch Perks:
There is an instant 100 req/mo evaluation tier on the homepage (1 click, zero card or sign-up friction). You can also set up free real-time price drop alerts to Discord/Slack/Email via `POST /api/alerts/subscribe`.

For anyone needing programmatic high-throughput JSON/CSV feeds, use code `DYNEP37` for 37% off subscriptions.

Would love feedback on:
1. What additional niche providers or bare-metal clouds should be indexed?
2. What hardware filters (e.g. PCIe vs SXM5, InfiniBand vs Ethernet) are most critical for your pipelines?

---

## 2. r/MLOps (~80k Cloud Infrastructure Engineers)

* **Target URL:** https://www.reddit.com/r/MLOps/submit
* **Flair:** `Self-Promotion`
* **Title:** `How we track spot prices across 31 cloud GPU providers in real-time (and built an API for dynamic spot arbitrage) — architecture roast welcome`

### Post Body:

Hi r/MLOps,

Multi-cloud spot instance management for training jobs is notoriously annoying because every provider has different pricing APIs, scraper protections, or purely dynamic web dashboards with zero standardized schema.

We built **Dynep** (https://data.dynep.com) to solve this: an autonomous data engine that scrapes, normalizes, and indexes spot compute across 31 providers (AWS, Lambda, RunPod, Vast.ai, LeaderGPU, Vultr, FluidStack, etc.).

### Architecture Highlights:
- **Fast-Path Extraction:** Cheerio DOM parser handles scheduled crawls every 15 minutes.
- **LLM-Powered Self-Healing:** When providers update their frontend DOM and selectors break, the worker catches empty extractions and invokes an LLM to inspect the updated DOM, synthesize new selectors, verify them against schema rules, and hot-patch the repository without service downtime.
- **Delivery Engine:** Fastify API with sub-millisecond in-memory caching and CSV / JSON feeds.

Test the public benchmark without auth:
```bash
curl -s https://data.dynep.com/v1/spot/summary
```

Curious to hear how teams here handle spot preemption across non-hyperscaler clouds and what metrics (e.g. historic preemption probability) would be highest priority for your orchestrators (SkyPilot, Ray, Slurm). Roast away!
