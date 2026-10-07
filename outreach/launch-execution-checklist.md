# 🚀 Dynep Micro-DaaS Launch & Distribution Execution Checklist

## 1. Cloudflare Edge Production Deployment

### A. Deploy Worker & Assets
Deploy the Edge Worker, static frontend, and API routes to Cloudflare's global fleet:
```bash
cmd.exe /c "npx.cmd wrangler deploy"
```

### B. Upload Encrypted Production Secrets
Secure private keys without committing them to Git:
```bash
cmd.exe /c "npx.cmd wrangler secret put RESEND_API_KEY"
cmd.exe /c "npx.cmd wrangler secret put ADMIN_API_KEY"
```

### C. Verify D1 Schema & Edge Ingestion
Execute migrations and trigger an initial crawler run:
```bash
cmd.exe /c "npx.cmd wrangler d1 execute dynep-db --file=worker/schema.sql"

# Trigger immediate crawler run via authenticated edge endpoint:
curl -X POST https://data.dynep.com/api/admin/scrape -H "Authorization: Bearer <ADMIN_API_KEY>"
```

---

## 2. Package Publishing & Client Tooling

### A. Python SDK (`dynep`) to PyPI
The wheel and source distribution are built and verified in `packages/python-sdk/dist/`:
- `packages/python-sdk/dist/dynep-0.1.0-py3-none-any.whl`
- `packages/python-sdk/dist/dynep-0.1.0.tar.gz`

**Publish Command:**
```bash
cd packages/python-sdk
python -m pip install --upgrade twine
twine upload dist/*
# Provide your PyPI API Token (__token__ / pypi-...)
```

*Verification:*
```bash
pip install dynep
python -c "from dynep import DynepClient; print(DynepClient().get_cheapest_spot('H100'))"
```

---

### B. Node.js / CLI (`dynep-spot`) to npm
The package is pre-bundled in `packages/cli/`:
- `packages/cli/dynep-spot-1.0.0.tgz`

**Publish Command:**
```bash
cd packages/cli
npm login
npm publish --access public
```

*Verification:*
```bash
# 1. Live market table query
npx dynep-spot --gpu H100

# 2. Claim free API key
npx dynep-spot --claim dev-test@startup.ai

# 3. Model Context Protocol (MCP) server for Cursor & Claude Desktop
npx dynep-spot --mcp
```

---

## 3. Community Launch Triggers

### A. Show HN (Hacker News)
- **Reference File:** `outreach/show-hn.md`
- **Submission URL:** https://news.ycombinator.com/submit
- **Optimal Time:** Tuesday or Wednesday, 06:30 - 08:30 AM US Eastern Time (10:30 - 12:30 UTC)
- **Title:** `Show HN: DYNEP – Real-time spot pricing across 31 GPU clouds (curl endpoint, no auth)`
- **URL:** `https://data.dynep.com`
- **First Comment:** Paste immediate first comment from `outreach/show-hn.md` within 45 seconds of submitting.

### B. Reddit r/LocalLLaMA (~280k AI Developers)
- **Reference File:** `outreach/reddit-campaigns.md`
- **Submission URL:** https://www.reddit.com/r/LocalLLaMA/submit
- **Flair:** `Project / Resource`
- **Title:** `I built a free real-time GPU spot price API tracking 31 clouds (H100, A100, RTX 4090) so you never overpay for fine-tuning`
- **Copy:** Copy verbatim from Section 1 in `outreach/reddit-campaigns.md`.

### C. Reddit r/dataengineering (~180k Data Architects)
- **Reference File:** `outreach/reddit-campaigns.md`
- **Submission URL:** https://www.reddit.com/r/dataengineering/submit
- **Flair:** `Data Architecture`
- **Title:** `How we track & normalize spot pricing across 31 GPU clouds on Cloudflare Workers + D1 for <$5/mo`
- **Copy:** Copy verbatim from Section 2 in `outreach/reddit-campaigns.md`.

### D. AI Developer & Quant Discords
Post in `#tools` / `#infrastructure` / `#gpu-compute` in:
- **CUDA MODE Discord** (50k+ GPU engineers)
- **Nous Research Discord**
- **Unsloth Discord**
- **EleutherAI Discord**
- **Latent Space Discord**

*Pitch Hook:*
> "Hey everyone, built an edge-native indexer tracking real-time GPU spot rates across 31 clouds (LeaderGPU, RunPod, Vast.ai, Lambda Labs, AWS). You can run `npx dynep-spot --gpu H100` or `curl -s https://data.dynep.com/v1/spot/summary` for sub-50ms rates without registration. Python SDK is also on PyPI: `pip install dynep`. It also acts as an MCP server for Cursor via `npx dynep-spot --mcp`. Feedback welcome!"

---

## 4. Hardware Affiliate & Subscription Cash Flow Engines

1. **Hardware Rental Commissions (3% - 15% Recurring):**
   - Clickable "Deploy ↗" buttons live on https://data.dynep.com
   - Embedded referral links in automated GPU Spot Price Drop alert emails
   - Structured `deploy_url` columns in JSON and RFC 4180 CSV feeds
   - Arbitrage Cluster Calculator instant deployment links
   - *Unit Economics:* One 8x H100 cluster rented on LeaderGPU or Vast.ai earns ~$573 to $1,146/mo in recurring cash kickbacks.

2. **Polar.sh Subscriptions & Stripe Express Payouts:**
   - Starter ($29/mo), Pro ($99/mo), Enterprise ($299/mo)
   - Promotional coupon code: `DYNEP37`
   - Automated subscriber upgrade webhooks: `POST /api/webhooks/polar`
   - Single opt-in instant free tier (100 req/mo): `POST /api/keys/free`
