# 🚀 Dynep Micro-DaaS Launch & Distribution Execution Checklist

## 1. Package Publishing (Open-Source Distribution)

### A. Python SDK (`dynep`) to PyPI
The wheel and source distribution are already built and verified in `packages/python-sdk/dist/`:
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
The package is pre-bundled and packaged in `packages/cli/`:
- `packages/cli/dynep-spot-1.0.0.tgz`

**Publish Command:**
```bash
cd packages/cli
npm login
npm publish --access public
```
*Verification:*
```bash
npx dynep-spot --gpu H100
npx dynep-spot --claim dev-test@startup.ai
```

---

## 2. B2B Outreach Sniper Execution Trigger

Run the automated B2B outreach engine to convert high-spend AI startups and fine-tuning labs:

```bash
# 1. Preview pitches & generate fresh API keys without emailing:
npx tsx scripts/outreach-sniper.ts --dry-run --export-csv=outreach_leads.csv

# 2. Live email dispatch via Resend API (keys@dynep.com):
npx tsx scripts/outreach-sniper.ts --send
```

**Key Accounts Targeted:**
1. **Nous Research** (`compute@nousresearch.com`): 8x H100 Hermes cluster training -> $14,457/mo savings
2. **Unsloth AI** (`team@unsloth.ai`): Llama-3/Gemma-2 fine-tuning benchmark compute
3. **OpenPipe** (`infra@openpipe.ai`): Model distillation pipelines -> $13,708/mo savings on A100s
4. **Predibase** (`platform@predibase.com`): Multi-adapter LoRAX clusters
5. **Phind AI** (`infra@phind.com`): Sub-second search & inference clusters
6. **Luma AI** (`infra@lumalabs.ai`): Video generative diffusion clusters
7. **Cursor / Anysphere** (`infra@anysphere.co`): Speculative decoding clusters
8. **Modular** (`infra@modular.com`): Heterogeneous AI compiler benchmarks
9. **Stanford CRFM** (`infra@crfm.stanford.edu`): Academic foundation model evaluations
10. **Fine-Tuning Labs** (`finetuning-lead@opencompute-scale.dev`): RTX 4090 cluster arbitrage

---

## 3. Community Launch Triggers

### A. Show HN (Hacker News)
- **File:** `outreach/show-hn.md`
- **Submission URL:** https://news.ycombinator.com/submit
- **Optimal Time:** Tuesday or Wednesday, 06:30 - 08:00 AM PT (13:30 - 15:00 UTC)
- **Title:** `Show HN: Real-time GPU spot price and arbitrage API across 31 clouds`
- **URL:** `https://data.dynep.com`
- **First Comment:** Paste immediate first comment from `outreach/show-hn.md` within 60 seconds.

### B. Reddit r/LocalLLaMA (~250k AI Developers)
- **File:** `outreach/reddit-campaigns.md`
- **Submission URL:** https://www.reddit.com/r/LocalLLaMA/submit
- **Flair:** `Project`
- **Title:** `I built a free real-time GPU spot price API tracking 31 clouds (H100, A100, RTX 4090) so you never overpay for fine-tuning`
- **Copy:** Copy verbatim from Section 1 in `outreach/reddit-campaigns.md`.

### C. Reddit r/MLOps (~80k Cloud Infrastructure Engineers)
- **Submission URL:** https://www.reddit.com/r/MLOps/submit
- **Flair:** `Self-Promotion`
- **Title:** `How we track spot prices across 31 cloud GPU providers in real-time (and built an API for dynamic spot arbitrage) — architecture roast welcome`
- **Copy:** Copy verbatim from Section 2 in `outreach/reddit-campaigns.md`.

### D. High-Impact AI Discord Channels
Post in `#tools` / `#infrastructure` / `#gpu-compute` in:
- **CUDA MODE Discord** (50k+ GPU engineers)
- **Nous Research Discord**
- **Unsloth Discord**
- **EleutherAI Discord**
- **Latent Space Discord**

*Pitch Hook:*
> "Hey everyone, built an autonomous indexer tracking real-time GPU spot prices across 31 clouds (LeaderGPU, RunPod, Vast.ai, Lambda Labs, AWS). You can run `npx dynep-spot --gpu H100` or `curl -s https://data.dynep.com/v1/spot/summary` for sub-300ms rates without registration. Python SDK is also on PyPI: `pip install dynep`. Would love any feedback!"

---

## 4. Hardware Affiliate & Subscription Cash Flow Engines

1. **Hardware Rental Commissions (3% - 10% Recurring):**
   - Clickable "Deploy ↗" buttons live on https://data.dynep.com
   - Embedded referral links in automated GPU Spot Price Drop alert emails
   - Structured `deploy_url` columns in JSON and RFC 4180 CSV feeds
   - Arbitrage Cluster Calculator instant deployment links
   - *Unit Economics:* One 8x H100 cluster rented on LeaderGPU earns ~$1,146/mo in recurring cash kickbacks.

2. **Polar.sh Subscriptions & Stripe Express Payouts:**
   - Starter ($29/mo), Pro ($99/mo), Enterprise ($299/mo)
   - Active 37% coupon: `DYNEP37`
   - Single opt-in instant free tier (100 req/mo): `POST /api/keys/free`
