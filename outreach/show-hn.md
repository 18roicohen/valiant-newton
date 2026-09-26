# Show HN Launch Package for Hacker News

**Target URL:** https://news.ycombinator.com/submit
**Best Submission Window:** Tuesday - Thursday between 06:00 - 08:30 AM US Pacific Time (13:00 - 15:30 UTC).

---

### Submission Form
* **Title:** `Show HN: Real-time GPU spot price and arbitrage API across 31 clouds`
* **URL:** `https://data.dynep.com`
* **Text:** *(Leave completely empty on link submissions)*

---

### Immediate First Comment (Post within 60 seconds of submitting):

Hey HN,

Over the past months of deploying inference and fine-tuning clusters, the single most frustrating bottleneck was the extreme pricing fragmentation in the GPU cloud market. 

An NVIDIA H100 SXM or RTX 4090 can vary by over 3x between hyperscalers (AWS, Azure, GCP) and alternative cloud providers or spot marketplaces (LeaderGPU, RunPod, Lambda Labs, Vast.ai, TensorDock, Nebius, Hyperstack, etc.). On any given hour, one provider has available H100s for $1.99/hr while others charge $4.50/hr on-demand.

To solve this for our own pipelines, we built Dynep (https://data.dynep.com): an autonomous indexer tracking real-time spot prices, hardware specs, and availability across 31 global cloud GPU providers.

What it provides:
1. **Public Zero-Auth Summary:** `curl -s https://data.dynep.com/v1/spot/summary` gives instant spot rates and AWS spreads in under 300ms.
2. **Sub-millisecond Feed:** Filterable JSON and CSV endpoints (`/v1/data`, `/v1/feed.csv`) normalizing VRAM, interconnects, regions, and pricing units.
3. **Cluster Arbitrage Calculator:** Interactive cost delta analysis for 8x H100/A100 training clusters.
4. **Developer Free Tier:** 100 requests/mo complimentary evaluation keys issued instantly in 1-click on the landing page (no credit card required).

Stack: TypeScript, Fastify, Pino, Cloudflare Tunnel, and automated self-healing scrapers that dynamically repair selector drift when cloud provider pricing dashboards change their DOM structure.

We'd love your feedback on the schema, API latency, and which additional providers or metrics you'd like to see indexed next!
