import { env } from '../config/env.js';

export interface AffiliatePartner {
  name: string;
  aliases: string[];
  baseUrl: string;
  commissionPercent: number;
  referralParam: string;
  referralCode: string;
  notes: string;
}

export const AFFILIATE_PARTNERS: Record<string, AffiliatePartner> = {
  leadergpu: {
    name: 'LeaderGPU',
    aliases: ['leadergpu', 'leader-gpu', 'leader gpu'],
    baseUrl: 'https://www.leadergpu.com/',
    commissionPercent: 10,
    referralParam: 'ref',
    referralCode: (process.env.LEADERGPU_AFFILIATE_ID || 'dynep'),
    notes: '10% recurring hardware rental kickback on dedicated H100/A100 instances',
  },
  runpod: {
    name: 'RunPod',
    aliases: ['runpod', 'runpod.io'],
    baseUrl: 'https://www.runpod.io/console/gpu-cloud',
    commissionPercent: 5,
    referralParam: 'ref',
    referralCode: (process.env.RUNPOD_AFFILIATE_ID || 'dynep'),
    notes: '5% recurring lifetime compute rental commission',
  },
  vastai: {
    name: 'Vast.ai',
    aliases: ['vast', 'vast.ai', 'vastai'],
    baseUrl: 'https://cloud.vast.ai/',
    commissionPercent: 3,
    referralParam: 'ref_id',
    referralCode: (process.env.VAST_AFFILIATE_ID || 'dynep'),
    notes: '3% recurring hardware arbitrage commission on community & secure cloud',
  },
  lambdalabs: {
    name: 'Lambda Labs',
    aliases: ['lambda', 'lambda labs', 'lambdalabs'],
    baseUrl: 'https://lambdalabs.com/service/gpu-cloud',
    commissionPercent: 5,
    referralParam: 'ref',
    referralCode: (process.env.LAMBDA_AFFILIATE_ID || 'dynep'),
    notes: '5% recurring commission on 1-Click Cluster deployments',
  },
  vultr: {
    name: 'Vultr',
    aliases: ['vultr', 'vultr cloud'],
    baseUrl: 'https://www.vultr.com/products/cloud-gpu/',
    commissionPercent: 15,
    referralParam: 'ref',
    referralCode: (process.env.VULTR_AFFILIATE_ID || 'dynep'),
    notes: 'Up to 20% recurring / $100 CPA for enterprise AI clusters',
  },
  fluidstack: {
    name: 'FluidStack',
    aliases: ['fluidstack', 'fluid stack'],
    baseUrl: 'https://www.fluidstack.io/',
    commissionPercent: 5,
    referralParam: 'ref',
    referralCode: (process.env.FLUIDSTACK_AFFILIATE_ID || 'dynep'),
    notes: '5% recurring enterprise compute referral',
  },
  hyperstack: {
    name: 'Hyperstack',
    aliases: ['hyperstack', 'hyperstack.cloud'],
    baseUrl: 'https://www.hyperstack.cloud/',
    commissionPercent: 5,
    referralParam: 'ref',
    referralCode: (process.env.HYPERSTACK_AFFILIATE_ID || 'dynep'),
    notes: '5% recurring on high-density HGX deployments',
  },
  massedcompute: {
    name: 'Massed Compute',
    aliases: ['massed compute', 'massedcompute'],
    baseUrl: 'https://massedcompute.com/',
    commissionPercent: 7,
    referralParam: 'ref',
    referralCode: (process.env.MASSEDCOMPUTE_AFFILIATE_ID || 'dynep'),
    notes: '7% recurring hardware rental kickback',
  },
  crusoe: {
    name: 'Crusoe',
    aliases: ['crusoe', 'crusoe cloud', 'crusoe.ai'],
    baseUrl: 'https://crusoe.ai/cloud/',
    commissionPercent: 4,
    referralParam: 'utm_source',
    referralCode: 'dynep',
    notes: 'Direct tracked enterprise compute placement',
  },
  coreweave: {
    name: 'CoreWeave',
    aliases: ['coreweave', 'core weave'],
    baseUrl: 'https://www.coreweave.com/',
    commissionPercent: 4,
    referralParam: 'utm_source',
    referralCode: 'dynep',
    notes: 'Direct tracked enterprise placement',
  },
  hotaisle: {
    name: 'Hot Aisle',
    aliases: ['hot aisle', 'hotaisle'],
    baseUrl: 'https://hotaisle.xyz/',
    commissionPercent: 5,
    referralParam: 'ref',
    referralCode: 'dynep',
    notes: '5% on high-frequency AMD / NVIDIA bare metal',
  },
  lyceum: {
    name: 'Lyceum',
    aliases: ['lyceum', 'lyceum cloud'],
    baseUrl: 'https://lyceum.ai/',
    commissionPercent: 5,
    referralParam: 'ref',
    referralCode: 'dynep',
    notes: '5% on managed GPU clusters',
  },
};

export class AffiliateService {
  /**
   * Resolves partner configuration by name or alias
   */
  static resolvePartner(providerName?: string): AffiliatePartner | null {
    if (!providerName) return null;
    const clean = providerName.trim().toLowerCase();

    for (const partner of Object.values(AFFILIATE_PARTNERS)) {
      if (partner.aliases.some((alias) => clean.includes(alias) || alias.includes(clean))) {
        return partner;
      }
    }

    return null;
  }

  /**
   * Generates a fully wrapped, tracked affiliate & referral deploy URL
   */
  static getDeployUrl(providerName?: string, gpuModel?: string): string {
    const partner = this.resolvePartner(providerName);
    const utmTags = 'utm_source=dynep&utm_medium=spot_terminal&utm_campaign=arbitrage_deploy';

    if (partner) {
      const glue = partner.baseUrl.includes('?') ? '&' : '?';
      let url = `${partner.baseUrl}${glue}${partner.referralParam}=${encodeURIComponent(partner.referralCode)}&${utmTags}`;
      if (gpuModel) {
        url += `&gpu=${encodeURIComponent(gpuModel)}`;
      }
      return url;
    }

    // Fallback for providers without explicit affiliate programs (AWS, GCP, Azure, or long-tail cloud)
    const normalizedName = (providerName || 'cloud').trim().toLowerCase();
    if (normalizedName.includes('aws') || normalizedName.includes('amazon')) {
      return `https://aws.amazon.com/ec2/spot/?${utmTags}`;
    }
    if (normalizedName.includes('azure')) {
      return `https://azure.microsoft.com/en-us/pricing/spot/?${utmTags}`;
    }
    if (normalizedName.includes('gcp') || normalizedName.includes('google')) {
      return `https://cloud.google.com/compute/docs/instances/spot/?${utmTags}`;
    }

    return `https://data.dynep.com/?deploy_provider=${encodeURIComponent(providerName || 'cloud')}&${utmTags}`;
  }

  /**
   * Returns commission percentage for a given provider
   */
  static getCommissionPercent(providerName?: string): number {
    const partner = this.resolvePartner(providerName);
    return partner ? partner.commissionPercent : 5; // Conservative default: 5%
  }

  /**
   * Calculates monthly compute spend and estimated recurring commission
   * e.g. for an 8x H100 cluster rented 720h/month
   */
  static calculateClusterCommission(
    hourlyRate: number,
    gpuCount: number = 8,
    hoursPerMonth: number = 720,
    providerName?: string
  ): {
    hourlyRate: number;
    gpuCount: number;
    monthlySpendUsd: number;
    commissionPercent: number;
    monthlyCommissionUsd: number;
    annualCommissionUsd: number;
  } {
    const monthlySpendUsd = Math.round(hourlyRate * gpuCount * hoursPerMonth * 100) / 100;
    const commissionPercent = this.getCommissionPercent(providerName);
    const monthlyCommissionUsd = Math.round((monthlySpendUsd * (commissionPercent / 100)) * 100) / 100;
    const annualCommissionUsd = Math.round(monthlyCommissionUsd * 12 * 100) / 100;

    return {
      hourlyRate,
      gpuCount,
      monthlySpendUsd,
      commissionPercent,
      monthlyCommissionUsd,
      annualCommissionUsd,
    };
  }

  /**
   * Enriches an extracted record with tracked affiliate deployment link and hardware arbitrage metadata
   */
  static enrichRecord<T extends { data: Record<string, any> }>(record: T): T {
    const provider = record.data?.provider || 'LeaderGPU';
    const gpuTitle = record.data?.title || '';
    const deployUrl = this.getDeployUrl(provider, gpuTitle);
    const commissionPercent = this.getCommissionPercent(provider);

    return {
      ...record,
      data: {
        ...record.data,
        deploy_url: deployUrl,
        affiliate_commission_rate: `${commissionPercent}%`,
      },
    };
  }
}
