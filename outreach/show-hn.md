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
1. **Public Zero-Auth Summary:** `curl -s https://data.dynep.com/v1/spot/summary` gives instant spot rates, lowest providers, and AWS spreads in under 300ms.
2. **Instant Terminal CLI:** Run `npx dynep-spot --gpu H100` to inspect live market depth and cheapest hosts directly from your terminal.
3. **Official Python SDK:** `pip install dynep` — query lowest spot quotes in 2 lines:
   ```python
   from dynep import DynepClient
   best = DynepClient().get_cheapest_spot("H100")
   print(f"Deploy on {best.best_provider} for ${best.spot_rate_hourly_usd}/hr (-{best.cost_savings_vs_aws_percent} vs AWS)")
   ```
4. **Sub-millisecond Streaming Feed:** Filterable JSON and CSV endpoints (`/v1/data`, `/v1/feed.csv`) normalizing VRAM, interconnects, regions, direct deploy links, and pricing units.
5. **Real-Time Spot Drop Alerts:** `POST /api/alerts/subscribe` pushes real-time email, Discord, and Slack alerts the instant H100 or RTX 4090 rates fall below your threshold.
6. **Cluster Arbitrage Calculator:** Interactive cost delta analysis for 8x H100/A100 training clusters with 1-click provisioning links.
7. **Developer Free Tier:** 100 requests/mo complimentary evaluation keys issued instantly in 1-click on the landing page (no credit card required).

Stack: Node.js Fastify + TypeScript backend, Cloudflare Tunnel edge, Resend transactional engine, Polar.sh billing, and autonomous self-healing scrapers that use an LLM pipeline to dynamically repair selector drift whenever cloud provider dashboards change their DOM structure.

We'd love your feedback on the schema, API latency, and which additional providers or metrics you'd like to see indexed next! Use code `DYNEP37` for 37% off paid subscription tiers.

