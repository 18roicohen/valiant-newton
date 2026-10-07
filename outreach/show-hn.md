# Show HN Launch Package for Hacker News

**Target URL:** https://news.ycombinator.com/submit  
**Best Submission Window:** Tuesday - Thursday between 06:30 - 08:30 AM US Eastern Time (10:30 - 12:30 UTC).

---

### Submission Form
* **Title:** `Show HN: DYNEP – Real-time spot pricing across 31 GPU clouds (curl endpoint, no auth)`
* **URL:** `https://data.dynep.com`
* **Text:** *(Leave completely empty on link submissions)*

---

### Immediate First Comment (Post within 45 seconds of submitting):

Hey HN,

Over the past few months of deploying inference pipelines and distributed fine-tuning runs, our #1 operational friction wasn't CUDA kernels or flash attention — it was extreme cloud GPU price fragmentation.

Right now, an NVIDIA H100 SXM or RTX 4090 varies by up to 3.5x depending on whether you provision on hyperscalers (AWS, Azure, GCP) or alternative cloud providers and spot marketplaces (LeaderGPU, RunPod, Lambda Labs, Vast.ai, TensorDock, Nebius, Hyperstack). On any given hour, one provider has available H100s for $1.99/hr while AWS charges $4.50/hr on-demand.

We got tired of checking 10 dashboards manually, so we built Dynep (https://data.dynep.com): an edge-native terminal and API tracking real-time spot rates, cluster availability, and hardware specifications across 31 global cloud GPU providers.

Line 1 — test it immediately in your terminal without an account or API key:
```bash
curl -s https://data.dynep.com/v1/spot/summary
```

What's live:
1. **Zero-Auth Edge Benchmark:** Sub-50ms JSON feed returning current spot rates, lowest providers, and AWS delta percentages.
2. **Instant Terminal CLI:** Run `npx dynep-spot --gpu H100` to inspect live market depth and cheapest hosts directly from your shell.
3. **Official Python SDK:** `pip install dynep` — query lowest spot quotes in 2 lines:
   ```python
   from dynep import DynepClient
   best = DynepClient().get_cheapest_spot("H100")
   print(f"Deploy on {best.best_provider} for ${best.spot_rate_hourly_usd}/hr (-{best.cost_savings_vs_aws_percent} vs AWS)")
   ```
4. **Model Context Protocol (MCP) Server for Cursor & Claude Desktop:**
   Query cheapest GPUs directly inside your coding workflow via `npx dynep-spot --mcp`.
5. **Sub-second Streaming Feeds:** Filterable JSON and RFC 4180 CSV endpoints (`/v1/data`, `/v1/feed.csv`) normalizing VRAM, interconnects, regions, and direct deploy links.
6. **Real-Time Spot Drop Alerts:** `POST /api/alerts/subscribe` pushes real-time email, Discord, and Slack alerts the instant H100 or RTX 4090 rates fall below your threshold.
7. **Cluster Arbitrage Calculator:** Interactive cost delta analysis for 8x H100/A100 training clusters with 1-click provisioning links.
8. **Developer Free Tier:** 100 requests/mo complimentary evaluation keys issued in 1-click on the landing page (no credit card required).

Stack & Architecture:
Global serverless edge deployment on Cloudflare Workers (V8 edge) + Cloudflare D1 (distributed SQLite). Ingestion runs on 15-minute Edge Cron triggers using direct provider API aggregation (Vast.ai, RunPod, Lambda Labs) and streaming C++ HTMLRewriter parsing. Sub-15ms edge cache hit rates worldwide with zero headless browser bloat.

We'd love your feedback on:
- What niche bare-metal or sovereign European/Asian GPU clouds should we index next?
- What hardware metrics (e.g. InfiniBand vs Ethernet interconnects, preemption risk score, disk bandwidth) are most critical for your pipelines?

I'll be hanging out in the comments all day to answer technical questions about the architecture or data normalization!
