import { AffiliateService } from './affiliates.js';

export interface GpuSeoProfile {
  slug: string;
  aliases: string[];
  gpuFamily: string;
  fullName: string;
  vramGb: number;
  architecture: string;
  fp16Tflops: number;
  memoryBandwidth: string;
  cheapestProvider: string;
  defaultSpotPrice: number;
  awsBaselinePrice: number;
  awsInstanceType: string;
  primaryUseCases: string[];
  metaDescription: string;
}

export const GPU_SEO_PROFILES: GpuSeoProfile[] = [
  {
    slug: 'h100-lowest-price',
    aliases: ['h100', 'h100-sxm5', 'h100-spot-rates', 'nvidia-h100'],
    gpuFamily: 'H100',
    fullName: 'NVIDIA H100 SXM5 (80GB HBM3)',
    vramGb: 80,
    architecture: 'Hopper 4nm',
    fp16Tflops: 1979,
    memoryBandwidth: '3.35 TB/s',
    cheapestProvider: 'LeaderGPU',
    defaultSpotPrice: 1.99,
    awsBaselinePrice: 4.50,
    awsInstanceType: 'AWS EC2 p5.48xlarge ($4.50/GPU-hr)',
    primaryUseCases: ['LLM Pre-training', '70B Fine-tuning (LoRA / QLoRA)', 'Distributed High-Throughput Inference (vLLM)'],
    metaDescription: 'Find the lowest verified spot price for NVIDIA H100 SXM5 GPUs ($1.99/hr vs $4.50 on AWS). Real-time spot arbitrage across 31 cloud providers.',
  },
  {
    slug: 'h200-spot-rates',
    aliases: ['h200', 'nvidia-h200', 'h200-spot-price'],
    gpuFamily: 'H200',
    fullName: 'NVIDIA H200 (141GB HBM3e)',
    vramGb: 141,
    architecture: 'Hopper Enhanced',
    fp16Tflops: 1979,
    memoryBandwidth: '4.8 TB/s',
    cheapestProvider: 'Lambda Labs',
    defaultSpotPrice: 3.49,
    awsBaselinePrice: 5.80,
    awsInstanceType: 'AWS EC2 p5e.48xlarge ($5.80/GPU-hr)',
    primaryUseCases: ['Large Context 128k+ LLMs', 'Single-Node Llama 3.3 70B Full Inference', 'Memory-Bound Deep Learning'],
    metaDescription: 'Real-time NVIDIA H200 (141GB HBM3e) spot pricing index. Compare hourly rates from $3.49/hr across Lambda, RunPod, and AWS.',
  },
  {
    slug: 'b200-spot-price',
    aliases: ['b200', 'nvidia-b200', 'blackwell-b200', 'b200-spot-rates'],
    gpuFamily: 'B200',
    fullName: 'NVIDIA B200 Blackwell (192GB HBM3e)',
    vramGb: 192,
    architecture: 'Blackwell 4NP',
    fp16Tflops: 4500,
    memoryBandwidth: '8.0 TB/s',
    cheapestProvider: 'RunPod',
    defaultSpotPrice: 4.85,
    awsBaselinePrice: 7.20,
    awsInstanceType: 'AWS EC2 p6.48xlarge Projected ($7.20/GPU-hr)',
    primaryUseCases: ['FP4 / FP8 Next-Gen Training', 'Trillion-Parameter MoE Inference', 'Maximum VRAM Density Clusters'],
    metaDescription: 'Track NVIDIA B200 Blackwell cloud GPU spot prices, pre-orders, and cluster inventory across 31 verified providers.',
  },
  {
    slug: 'a100-lowest-price',
    aliases: ['a100', 'a100-80gb', 'nvidia-a100', 'a100-spot-rates'],
    gpuFamily: 'A100',
    fullName: 'NVIDIA A100 SXM4 (80GB HBM2e)',
    vramGb: 80,
    architecture: 'Ampere 7nm',
    fp16Tflops: 312,
    memoryBandwidth: '2.0 TB/s',
    cheapestProvider: 'LeaderGPU',
    defaultSpotPrice: 0.68,
    awsBaselinePrice: 3.06,
    awsInstanceType: 'AWS EC2 p4d.24xlarge ($3.06/GPU-hr)',
    primaryUseCases: ['Cost-Effective Fine-Tuning', 'Production Embedding Models', 'Medium-Scale Batch Inference'],
    metaDescription: 'Lowest NVIDIA A100 SXM4 80GB spot pricing from $0.68/hr. Save up to 78% compared to AWS EC2 on-demand instances.',
  },
  {
    slug: 'rtx-4090-spot-rates',
    aliases: ['rtx-4090', '4090', 'rtx4090', 'rtx-4090-lowest-price'],
    gpuFamily: 'RTX 4090',
    fullName: 'NVIDIA GeForce RTX 4090 (24GB GDDR6X)',
    vramGb: 24,
    architecture: 'Ada Lovelace 4N',
    fp16Tflops: 165,
    memoryBandwidth: '1.0 TB/s',
    cheapestProvider: 'Vast.ai',
    defaultSpotPrice: 0.34,
    awsBaselinePrice: 1.10,
    awsInstanceType: 'AWS EC2 g5.12xlarge Equivalent ($1.10/hr)',
    primaryUseCases: ['Quantized 8B/14B Local LLM Serving', 'SDXL & Flux Video Generation', 'Prototyping & CI/CD Pipelines'],
    metaDescription: 'Cheapest NVIDIA RTX 4090 cloud rentals from $0.34/hr. Real-time spot pricing across Vast.ai, RunPod, and TensorDock.',
  },
  {
    slug: 'rtx-5090-spot-rates',
    aliases: ['rtx-5090', '5090', 'rtx5090'],
    gpuFamily: 'RTX 5090',
    fullName: 'NVIDIA GeForce RTX 5090 (32GB GDDR7)',
    vramGb: 32,
    architecture: 'Blackwell Consumer',
    fp16Tflops: 300,
    memoryBandwidth: '1.79 TB/s',
    cheapestProvider: 'TensorDock',
    defaultSpotPrice: 0.79,
    awsBaselinePrice: 2.40,
    awsInstanceType: 'AWS EC2 g6e Baseline ($2.40/hr)',
    primaryUseCases: ['High-Throughput 32GB Diffusion Models', '32GB Quantized 32B Model Serving', 'Next-Gen CUDA Acceleration'],
    metaDescription: 'NVIDIA RTX 5090 cloud spot pricing index. Discover early availability, 32GB VRAM spot rates, and cluster rentals.',
  },
  {
    slug: 'l40s-spot-rates',
    aliases: ['l40s', 'nvidia-l40s', 'l40s-lowest-price'],
    gpuFamily: 'L40S',
    fullName: 'NVIDIA L40S (48GB GDDR6 ECC)',
    vramGb: 48,
    architecture: 'Ada Lovelace Enterprise',
    fp16Tflops: 366,
    memoryBandwidth: '864 GB/s',
    cheapestProvider: 'FluidStack',
    defaultSpotPrice: 0.85,
    awsBaselinePrice: 2.15,
    awsInstanceType: 'AWS EC2 g6e.12xlarge ($2.15/GPU-hr)',
    primaryUseCases: ['Multi-Tenant LLM Serving', '3D Gaussian Splatting & Omniverse', 'Cost-Optimized Generative AI'],
    metaDescription: 'Compare NVIDIA L40S (48GB) cloud spot rates from $0.85/hr. Slash compute costs by 60% vs AWS hyperscalers.',
  },
  {
    slug: 'rtx-a6000-lowest-price',
    aliases: ['rtx-a6000', 'a6000', 'rtx-a6000-spot-rates'],
    gpuFamily: 'RTX A6000',
    fullName: 'NVIDIA RTX A6000 (48GB GDDR6)',
    vramGb: 48,
    architecture: 'Ampere Professional',
    fp16Tflops: 154,
    memoryBandwidth: '768 GB/s',
    cheapestProvider: 'RunPod',
    defaultSpotPrice: 0.55,
    awsBaselinePrice: 1.85,
    awsInstanceType: 'AWS EC2 g5.8xlarge ($1.85/hr)',
    primaryUseCases: ['48GB VRAM Inference', 'Workstation CAD & Rendering', 'LoRA Fine-Tuning'],
    metaDescription: 'Find NVIDIA RTX A6000 (48GB) cloud spot instances from $0.55/hr across RunPod, Vast.ai, and LeaderGPU.',
  },
  {
    slug: 'rtx-4000-ada-spot-rates',
    aliases: ['rtx-4000-ada', 'rtx-4000', 'rtx4000ada'],
    gpuFamily: 'RTX 4000 Ada',
    fullName: 'NVIDIA RTX 4000 Ada Generation (20GB)',
    vramGb: 20,
    architecture: 'Ada Lovelace SFF',
    fp16Tflops: 106,
    memoryBandwidth: '360 GB/s',
    cheapestProvider: 'DataCrunch',
    defaultSpotPrice: 0.28,
    awsBaselinePrice: 0.95,
    awsInstanceType: 'AWS EC2 g5.4xlarge ($0.95/hr)',
    primaryUseCases: ['Lightweight Microservice Serving', 'Small LLM Inference (1B-7B)', 'Embeddings'],
    metaDescription: 'NVIDIA RTX 4000 Ada Generation spot pricing index from $0.28/hr across leading European and US AI cloud hosts.',
  },
  {
    slug: 'nvidia-a16-spot-rates',
    aliases: ['nvidia-a16', 'a16', 'a16-lowest-price'],
    gpuFamily: 'NVIDIA A16',
    fullName: 'NVIDIA A16 Quad-GPU (64GB Total / 16GB per GPU)',
    vramGb: 64,
    architecture: 'Ampere Multi-GPU',
    fp16Tflops: 180,
    memoryBandwidth: '200 GB/s per engine',
    cheapestProvider: 'LeaderGPU',
    defaultSpotPrice: 0.42,
    awsBaselinePrice: 1.45,
    awsInstanceType: 'AWS EC2 g4ad.8xlarge ($1.45/hr)',
    primaryUseCases: ['High-Concurrency Low-VRAM Inference', 'Video Transcoding & VDI', 'Streaming Agents'],
    metaDescription: 'NVIDIA A16 cloud GPU spot prices and multi-instance rental rates from $0.42/hr. Monitored real-time across 31 clouds.',
  },
  {
    slug: 'rtx-5060-ti-spot-rates',
    aliases: ['rtx-5060-ti', '5060-ti', 'rtx5060ti'],
    gpuFamily: 'RTX 5060 Ti',
    fullName: 'NVIDIA GeForce RTX 5060 Ti (16GB)',
    vramGb: 16,
    architecture: 'Blackwell Budget',
    fp16Tflops: 95,
    memoryBandwidth: '448 GB/s',
    cheapestProvider: 'Vast.ai',
    defaultSpotPrice: 0.18,
    awsBaselinePrice: 0.65,
    awsInstanceType: 'AWS EC2 g4dn.2xlarge ($0.65/hr)',
    primaryUseCases: ['Ultra-Budget AI Inference', 'Synthetic Data Batch Scraping', 'Autonomous Agent Testing'],
    metaDescription: 'Budget AI cloud compute: NVIDIA RTX 5060 Ti spot rates from $0.18/hr. Instant deploy links with zero minimum commitment.',
  },
];

export class SeoEngine {
  static resolveGpuProfile(slugOrAlias: string): GpuSeoProfile | null {
    const clean = slugOrAlias.toLowerCase().replace(/^\/gpu\//, '').replace(/\/$/, '');
    for (const profile of GPU_SEO_PROFILES) {
      if (profile.slug === clean) return profile;
      if (profile.aliases.includes(clean)) return profile;
      if (clean.includes(profile.gpuFamily.toLowerCase().replace(/\s+/g, ''))) return profile;
    }
    return null;
  }

  static renderGpuPage(profile: GpuSeoProfile, liveRate?: number, liveProvider?: string): string {
    const spotPrice = liveRate || profile.defaultSpotPrice;
    const provider = liveProvider || profile.cheapestProvider;
    const awsRate = profile.awsBaselinePrice;
    const hourlySavings = Math.max(0, awsRate - spotPrice);
    const savingsPercent = Math.round((hourlySavings / awsRate) * 100);
    const monthly1x = Math.round(hourlySavings * 720);
    const monthly8x = Math.round(monthly1x * 8);
    const annual8x = Math.round(monthly8x * 12);
    const deployUrl = AffiliateService.getDeployUrl(provider, profile.fullName);

    const schemaJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: profile.fullName,
      description: profile.metaDescription,
      brand: { '@type': 'Brand', name: 'NVIDIA' },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: spotPrice,
        highPrice: awsRate,
        offerCount: 31,
        offers: [
          {
            '@type': 'Offer',
            price: spotPrice,
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: spotPrice,
              priceCurrency: 'USD',
              unitText: 'HOUR',
            },
            seller: { '@type': 'Organization', name: provider },
            url: deployUrl,
            availability: 'https://schema.org/InStock',
          },
        ],
      },
    });

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile.fullName} Spot Pricing: From $${spotPrice.toFixed(2)}/hr | DYNEP</title>
  <meta name="description" content="${profile.metaDescription}">
  <link rel="canonical" href="https://data.dynep.com/gpu/${profile.slug}">
  <link rel="icon" type="image/svg+xml" href="/logo-icon.svg">
  
  <!-- OpenGraph -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${profile.fullName} Spot Pricing from $${spotPrice.toFixed(2)}/hr (${savingsPercent}% vs AWS)">
  <meta property="og:description" content="${profile.metaDescription}">
  <meta property="og:url" content="https://data.dynep.com/gpu/${profile.slug}">
  <meta property="og:site_name" content="DYNEP Spot Intelligence">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${profile.fullName} Cloud Spot Rates: $${spotPrice.toFixed(2)}/hr">
  <meta name="twitter:description" content="Slash compute costs by ${savingsPercent}% on verified ${provider} spot nodes.">
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${schemaJson}</script>
  
  <style>
    body { background-color: #030712; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .glass-panel { background: rgba(11, 15, 25, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); }
    .code-box { background: #030712; border: 1px solid #1e293b; font-family: ui-monospace, SFMono-Regular, monospace; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased selection:bg-emerald-500/25 selection:text-emerald-200">

  <!-- NAVIGATION HEADER -->
  <header class="border-b border-slate-800 bg-[#070a13] sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3">
        <img src="/logo-icon.svg" width="28" height="28" alt="Dynep Logo" class="rounded">
        <span class="font-extrabold text-white text-lg tracking-tight">DYNEP</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">Spot Intelligence</span>
      </a>
      <div class="flex items-center gap-5 text-xs font-mono">
        <a href="/" class="text-slate-300 hover:text-emerald-400 transition hidden sm:inline">Live Terminal</a>
        <a href="/docs" class="text-slate-300 hover:text-emerald-400 transition">API Docs</a>
        <a href="/#pricing" class="text-emerald-400 font-bold hover:underline">Pricing (37% Off)</a>
        <a href="${deployUrl}" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg transition font-mono">Deploy on ${provider} →</a>
      </div>
    </div>
  </header>

  <!-- HERO SECTION -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 flex-grow">
    
    <!-- Breadcrumb & Badge -->
    <div class="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
      <a href="/" class="hover:text-white">Home</a>
      <span>/</span>
      <a href="/v1/spot/summary" class="hover:text-white">Spot Index</a>
      <span>/</span>
      <span class="text-emerald-400 font-bold">${profile.gpuFamily} Spot Pricing</span>
    </div>

    <div class="glass-panel rounded-2xl p-6 sm:p-10 border border-slate-800 relative overflow-hidden">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div class="space-y-4 max-w-3xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400 font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>VERIFIED REAL-TIME SPOT RATE • 31 PROVIDERS INDEXED</span>
          </div>
          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            ${profile.fullName} Spot Pricing
          </h1>
          <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
            Continuously monitored across 31 GPU cloud platforms. The lowest verified spot rate is currently 
            <strong class="text-emerald-400 font-mono text-lg font-bold">$${spotPrice.toFixed(2)} / GPU-hr</strong> on 
            <strong class="text-white">${provider}</strong>, delivering an immediate 
            <strong class="text-emerald-400 font-mono">${savingsPercent}% cost reduction</strong> compared to 
            ${profile.awsInstanceType}.
          </p>
        </div>

        <!-- PRICING CALLOUT CARD -->
        <div class="glass-card rounded-2xl p-6 border border-emerald-500/40 bg-gradient-to-b from-[#0b1324] to-[#070a13] text-center shrink-0 w-full lg:w-80 shadow-2xl">
          <div class="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">Cheapest Spot Instance</div>
          <div class="text-4xl sm:text-5xl font-black text-emerald-400 my-2 font-mono">
            $${spotPrice.toFixed(2)}<span class="text-sm font-normal text-slate-400 font-sans"> / hr</span>
          </div>
          <div class="text-xs text-slate-400 mb-4 font-mono">
            Host: <span class="text-white font-bold">${provider}</span> • <span class="text-emerald-400 font-bold">-${savingsPercent}% vs AWS</span>
          </div>
          <a href="${deployUrl}" class="block w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition font-mono shadow-lg shadow-emerald-500/20 active:scale-95">
            Deploy Now on ${provider} →
          </a>
          <div class="text-[11px] text-slate-500 mt-2 font-mono">Instant 1-Click Provisioning • Zero Waitlist</div>
        </div>
      </div>
    </div>

    <!-- ARBITRAGE DELTA COMPARISON TABLE -->
    <div class="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
      <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
        <span>⚡ Spot Arbitrage Matrix: ${profile.fullName} vs AWS</span>
      </h2>
      
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs font-mono">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400">
              <th class="py-3 px-4">Metric</th>
              <th class="py-3 px-4">AWS On-Demand Baseline</th>
              <th class="py-3 px-4 text-emerald-400 font-bold">Dynep Verified Spot (${provider})</th>
              <th class="py-3 px-4 text-emerald-400">Net Dollar Savings</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-slate-300">
            <tr>
              <td class="py-3 px-4 font-bold text-white">Rate per GPU-hour</td>
              <td class="py-3 px-4 text-rose-400 line-through">$${awsRate.toFixed(2)} / hr</td>
              <td class="py-3 px-4 text-emerald-400 font-bold text-sm">$${spotPrice.toFixed(2)} / hr</td>
              <td class="py-3 px-4 text-emerald-400 font-bold">$${hourlySavings.toFixed(2)} / hr (${savingsPercent}%)</td>
            </tr>
            <tr>
              <td class="py-3 px-4 font-bold text-white">1x GPU Monthly Run (720 hrs)</td>
              <td class="py-3 px-4 text-slate-400">$${Math.round(awsRate * 720).toLocaleString()} / mo</td>
              <td class="py-3 px-4 text-emerald-400 font-bold">$${Math.round(spotPrice * 720).toLocaleString()} / mo</td>
              <td class="py-3 px-4 text-emerald-400 font-bold">+$${monthly1x.toLocaleString()} / mo saved</td>
            </tr>
            <tr class="bg-emerald-500/5">
              <td class="py-3.5 px-4 font-bold text-white">8x Node Monthly Run (720 hrs)</td>
              <td class="py-3.5 px-4 text-rose-400">$${Math.round(awsRate * 720 * 8).toLocaleString()} / mo</td>
              <td class="py-3.5 px-4 text-emerald-400 font-black text-base">$${Math.round(spotPrice * 720 * 8).toLocaleString()} / mo</td>
              <td class="py-3.5 px-4 text-emerald-400 font-black text-base">+$${monthly8x.toLocaleString()} / mo ($${annual8x.toLocaleString()}/yr)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- HARDWARE SPECS & WORKLOADS -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white font-mono flex items-center gap-2">
          <span>🔧 Hardware Specifications</span>
        </h3>
        <dl class="space-y-2 text-xs font-mono">
          <div class="flex justify-between py-1.5 border-b border-slate-800/80"><dt class="text-slate-400">Accelerator:</dt><dd class="text-white font-bold">${profile.fullName}</dd></div>
          <div class="flex justify-between py-1.5 border-b border-slate-800/80"><dt class="text-slate-400">VRAM Capacity:</dt><dd class="text-emerald-400 font-bold">${profile.vramGb} GB</dd></div>
          <div class="flex justify-between py-1.5 border-b border-slate-800/80"><dt class="text-slate-400">Microarchitecture:</dt><dd class="text-white">${profile.architecture}</dd></div>
          <div class="flex justify-between py-1.5 border-b border-slate-800/80"><dt class="text-slate-400">FP16 Tensor TFLOPS:</dt><dd class="text-white">${profile.fp16Tflops.toLocaleString()} TFLOPS</dd></div>
          <div class="flex justify-between py-1.5"><dt class="text-slate-400">Memory Bandwidth:</dt><dd class="text-white">${profile.memoryBandwidth}</dd></div>
        </dl>
      </div>

      <div class="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h3 class="text-base font-bold text-white font-mono flex items-center gap-2">
          <span>🎯 Optimized Workloads</span>
        </h3>
        <ul class="space-y-2.5 text-xs text-slate-300">
          ${profile.primaryUseCases.map((u) => `<li class="flex items-center gap-2"><span class="text-emerald-400 font-bold">✓</span><span>${u}</span></li>`).join('')}
        </ul>
        <div class="pt-4 border-t border-slate-800">
          <a href="${deployUrl}" class="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold">
            <span>Spin up ${profile.gpuFamily} cluster on ${provider}</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </div>

    <!-- DEVELOPER INTEGRATION & INSTANT API ACCESS -->
    <div class="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-white">Automate ${profile.gpuFamily} Spot Provisioning</h3>
          <p class="text-xs text-slate-400">Query live ${profile.gpuFamily} availability programmatically via CLI, Python SDK, or REST API.</p>
        </div>
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-mono border border-emerald-500/30">
          <span>Free Tier: 100 req/mo included</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="code-box rounded-xl p-4 text-xs text-emerald-300">
          <div class="text-slate-500 text-[10px] mb-2 uppercase font-bold">Developer CLI</div>
          <div># Query cheapest ${profile.gpuFamily} spot rate in 1 second:</div>
          <div class="text-white mt-1 select-all font-bold">npx dynep-spot --gpu ${profile.gpuFamily}</div>
        </div>

        <div class="code-box rounded-xl p-4 text-xs text-emerald-300">
          <div class="text-slate-500 text-[10px] mb-2 uppercase font-bold">cURL Live JSON Benchmark</div>
          <div class="text-white select-all font-bold">curl -s "https://data.dynep.com/v1/spot/summary" | jq .</div>
        </div>
      </div>

      <!-- FREE API KEY FORM -->
      <div class="bg-[#030712] border border-slate-800 rounded-xl p-5 max-w-xl">
        <div class="text-xs font-bold text-white mb-2 font-mono">Claim Instant Developer API Key (No Card Required):</div>
        <form onsubmit="event.preventDefault(); claimKey(this);" class="flex gap-2">
          <input type="email" name="email" required placeholder="you@company.com" class="flex-grow bg-[#0b0f19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500">
          <button type="submit" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition font-mono whitespace-nowrap">
            Claim Free Key
          </button>
        </form>
        <div id="key-output" class="hidden mt-3 p-3 bg-slate-900 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-400"></div>
      </div>
    </div>

    <!-- VIRAL README BADGE SNIPPET -->
    <div class="glass-panel rounded-2xl p-6 border border-slate-800 space-y-3">
      <h3 class="text-sm font-bold text-white font-mono">Dynamic GitHub README Badge</h3>
      <p class="text-xs text-slate-400">Embed real-time spot rates into your repository README. Displays live price and auto-refreshes every 5 minutes:</p>
      <div class="code-box rounded-lg p-3 text-xs text-slate-300 select-all">
[![DYNEP ${profile.gpuFamily} Spot](https://data.dynep.com/badge/${profile.gpuFamily.toLowerCase().replace(/\s+/g, '')}.svg)](https://data.dynep.com/gpu/${profile.slug})
      </div>
    </div>

    <!-- ALL GPU SIBLING LINKS -->
    <div class="pt-6 border-t border-slate-800">
      <div class="text-xs font-mono uppercase text-slate-500 mb-3 font-bold">Explore Other AI Accelerator Spot Indices:</div>
      <div class="flex flex-wrap gap-2">
        ${GPU_SEO_PROFILES.map(
          (p) => `<a href="/gpu/${p.slug}" class="px-3 py-1.5 rounded-lg text-xs font-mono ${p.slug === profile.slug ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700 transition'}">${p.gpuFamily} ($${p.defaultSpotPrice}/h)</a>`
        ).join('')}
      </div>
    </div>

  </main>

  <!-- FOOTER -->
  <footer class="border-t border-slate-800 bg-[#070a13] py-8 text-xs text-slate-500 font-mono">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div>© 2026 Dynep Intelligence • Institutional GPU Spot Terminal</div>
      <div class="flex gap-4">
        <a href="/" class="hover:text-emerald-400">Terminal</a>
        <a href="/docs" class="hover:text-emerald-400">Docs</a>
        <a href="/terms" class="hover:text-emerald-400">Terms</a>
        <a href="/privacy" class="hover:text-emerald-400">Privacy</a>
        <a href="/portal" class="hover:text-emerald-400">Customer Portal</a>
      </div>
    </div>
  </footer>

  <script>
    async function claimKey(form) {
      const email = form.email.value;
      const out = document.getElementById('key-output');
      try {
        const res = await fetch('/api/keys/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        out.classList.remove('hidden');
        if (data.api_key) {
          out.innerHTML = '<strong>API Key:</strong> <span class="select-all font-bold">' + data.api_key + '</span> (100 req/mo credited)';
        } else {
          out.textContent = data.message || 'Key already issued or invalid email.';
        }
      } catch (e) {
        out.classList.remove('hidden');
        out.textContent = 'Error requesting key: ' + e.message;
      }
    }
  </script>
</body>
</html>`;
  }

  static renderComparisonPage(slug: string): string | null {
    if (slug === 'aws-vs-spot') {
      return this.renderAwsVsSpotPage();
    }
    return null;
  }

  static renderAwsVsSpotPage(): string {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AWS EC2 vs Cloud GPU Spot Instances: True Price Comparison 2026 | DYNEP</title>
  <meta name="description" content="Compare AWS EC2 p5.48xlarge and p4d on-demand pricing ($4.50/hr) against independent GPU cloud spot rates ($1.99/hr) across 31 providers.">
  <link rel="canonical" href="https://data.dynep.com/compare/aws-vs-spot">
  <link rel="icon" type="image/svg+xml" href="/logo-icon.svg">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#030712] text-slate-200 min-h-screen py-10 px-4 font-sans selection:bg-emerald-500/25 selection:text-emerald-200">
  <div class="max-w-5xl mx-auto space-y-8">
    <a href="/" class="text-xs font-mono text-emerald-400 hover:underline">← Back to Dynep Live Terminal</a>
    <h1 class="text-3xl sm:text-4xl font-extrabold text-white">AWS EC2 vs Independent Cloud GPU Spot Pricing</h1>
    <p class="text-sm text-slate-300 leading-relaxed">
      Hyperscaler clouds charge severe premiums for on-demand GPU capacity. AWS EC2 p5.48xlarge (8x H100) costs $36.00/hour ($4.50/GPU-hr), 
      generating a monthly compute invoice of over $25,920 per node. Verified spot inventory on LeaderGPU, Lambda Labs, and RunPod slashes this to $1.99/GPU-hr.
    </p>

    <div class="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 overflow-x-auto font-mono text-xs">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-slate-800 text-slate-400">
            <th class="py-3 px-3">GPU Model</th>
            <th class="py-3 px-3">AWS EC2 On-Demand</th>
            <th class="py-3 px-3 text-emerald-400">Dynep Verified Spot</th>
            <th class="py-3 px-3">Cheapest Provider</th>
            <th class="py-3 px-3 text-emerald-400">8x Node Monthly Savings</th>
            <th class="py-3 px-3">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          <tr>
            <td class="py-3 px-3 font-bold text-white">H100 SXM5 80GB</td>
            <td class="py-3 px-3 text-rose-400 line-through">$4.50/hr</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$1.99/hr</td>
            <td class="py-3 px-3">LeaderGPU</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$14,457 / mo</td>
            <td class="py-3 px-3"><a href="https://www.leadergpu.com/?ref=dynep&utm_source=dynep&utm_medium=spot_terminal&utm_campaign=arbitrage_deploy&gpu=H100" class="text-emerald-400 underline font-bold">Deploy →</a></td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-bold text-white">H200 141GB</td>
            <td class="py-3 px-3 text-rose-400 line-through">$5.80/hr</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$3.49/hr</td>
            <td class="py-3 px-3">Lambda Labs</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$13,305 / mo</td>
            <td class="py-3 px-3"><a href="https://lambdalabs.com/service/gpu-cloud?ref=dynep&utm_source=dynep&utm_medium=spot_terminal&utm_campaign=arbitrage_deploy&gpu=H200" class="text-emerald-400 underline font-bold">Deploy →</a></td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-bold text-white">A100 SXM4 80GB</td>
            <td class="py-3 px-3 text-rose-400 line-through">$3.06/hr</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$0.68/hr</td>
            <td class="py-3 px-3">LeaderGPU</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$13,708 / mo</td>
            <td class="py-3 px-3"><a href="https://www.leadergpu.com/?ref=dynep&utm_source=dynep&utm_medium=spot_terminal&utm_campaign=arbitrage_deploy&gpu=A100" class="text-emerald-400 underline font-bold">Deploy →</a></td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-bold text-white">RTX 4090 24GB</td>
            <td class="py-3 px-3 text-rose-400 line-through">$1.10/hr</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$0.34/hr</td>
            <td class="py-3 px-3">Vast.ai</td>
            <td class="py-3 px-3 text-emerald-400 font-bold">$4,377 / mo</td>
            <td class="py-3 px-3"><a href="https://cloud.vast.ai/?ref_id=dynep&utm_source=dynep&utm_medium=spot_terminal&utm_campaign=arbitrage_deploy&gpu=RTX%204090" class="text-emerald-400 underline font-bold">Deploy →</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="text-center pt-6">
      <a href="/" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl font-mono text-sm inline-block shadow-lg shadow-emerald-500/20">
        Open Live Terminal & Ticker →
      </a>
    </div>
  </div>
</body>
</html>`;
  }

  static generateSitemapXml(): string {
    const baseUrl = 'https://data.dynep.com';
    const now = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'hourly' },
      { loc: `${baseUrl}/docs`, priority: '0.8', changefreq: 'weekly' },
      { loc: `${baseUrl}/terms`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${baseUrl}/privacy`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${baseUrl}/v1/spot/summary`, priority: '0.9', changefreq: 'hourly' },
      { loc: `${baseUrl}/compare/aws-vs-spot`, priority: '0.8', changefreq: 'daily' },
    ];

    const gpuPages = GPU_SEO_PROFILES.map((p) => ({
      loc: `${baseUrl}/gpu/${p.slug}`,
      priority: '0.9',
      changefreq: 'hourly',
    }));

    const allPages = [...staticPages, ...gpuPages];

    const xmlUrls = allPages
      .map(
        (page) => `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;
  }

  static getMcpManifest(): object {
    return {
      schemaVersion: '1.0.0',
      name: 'dynep-spot-intelligence',
      version: '2.0.0',
      description: 'Real-Time Institutional Cloud GPU Spot Intelligence & Arbitrage MCP Server across 31+ GPU clouds.',
      endpoint: 'https://data.dynep.com/v1/agent/mcp',
      transport: 'http-jsonrpc-2.0',
      capabilities: {
        tools: [
          {
            name: 'get_cheapest_gpu',
            description: 'Finds the lowest real-time spot price, best cloud provider, and direct deploy URL for any AI GPU accelerator.',
            parameters: {
              type: 'object',
              properties: {
                gpu_model: { type: 'string', description: 'Target GPU family (e.g. H100, H200, B200, A100, RTX 4090, L40S)' },
              },
              required: ['gpu_model'],
            },
          },
          {
            name: 'calculate_cluster_arbitrage',
            description: 'Calculates cost delta and monthly dollar savings between AWS EC2 On-Demand and Dynep verified spot clusters.',
            parameters: {
              type: 'object',
              properties: {
                gpu_model: { type: 'string', description: 'Target GPU model (e.g. H100, A100, 4090)' },
                gpu_count: { type: 'number', default: 8, description: 'Number of GPUs in cluster' },
                hours: { type: 'number', default: 720, description: 'Workload hours per month' },
              },
              required: ['gpu_model'],
            },
          },
        ],
      },
      homepage: 'https://data.dynep.com',
      repository: 'https://github.com/dynep-intelligence/dynep-spot',
      author: 'Dynep Global GPU Spot Intelligence Desk',
    };
  }
}
