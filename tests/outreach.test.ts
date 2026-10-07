import { describe, it, expect } from 'vitest';
import { TARGET_LEADS, OutreachSniper } from '../scripts/outreach-sniper.js';
import { AutonomousMultiAgentTeam } from '../scripts/autonomous-agent-buyer.js';

describe('B2B Sniper Outreach & Autonomous Agent Squad', () => {
  it('TARGET_LEADS contains at least 35 verified institutional target companies', () => {
    expect(TARGET_LEADS.length).toBeGreaterThanOrEqual(35);

    const companies = TARGET_LEADS.map((l) => l.company);
    expect(companies).toContain('Nous Research');
    expect(companies).toContain('Unsloth AI');
    expect(companies).toContain('Fireworks AI');
    expect(companies).toContain('Together AI');
    expect(companies).toContain('Cognition AI (Devin)');
    expect(companies).toContain('Perplexity AI');
    expect(companies).toContain('Mistral AI');

    for (const lead of TARGET_LEADS) {
      expect(lead.company).toBeDefined();
      expect(lead.email).toContain('@');
      expect(lead.primaryGpu).toMatch(/H100|A100|RTX 4090|B200/);
      expect(lead.category).toBeDefined();
      expect(lead.currentProvider).toBeDefined();
    }
  });

  it('generatePitch creates mathematical cold briefings with VIP key and affiliate tracking', async () => {
    const lead = TARGET_LEADS[0];
    const pitch = await OutreachSniper.generatePitch(lead);

    expect(pitch.subject).toContain(lead.company);
    expect(pitch.subject).toContain(lead.primaryGpu);
    expect(pitch.apiKey).toMatch(/^sk_live_/);
    expect(pitch.arbitrage.deployUrl).toContain('dynep');
    expect(pitch.arbitrage.monthlyClusterSavings8x).toBeGreaterThan(1000);
    expect(pitch.emailBodyPlain).toContain('keys@dynep.com');
    expect(pitch.emailBodyHtml).toContain(pitch.apiKey);
  });

  it('generatePitch supports sequence follow-ups (Follow-Up #1 & #2)', async () => {
    const lead = TARGET_LEADS[1];
    const pitchFollowUp1 = await OutreachSniper.generatePitch(lead, 1);
    expect(pitchFollowUp1.subject).toContain('Market Fluctuation Update');

    const pitchFollowUp2 = await OutreachSniper.generatePitch(lead, 2);
    expect(pitchFollowUp2.subject).toContain('FinOps Audit');
  });

  it('AutonomousMultiAgentTeam executes multi-agent scan across target GPUs', async () => {
    const recommendations = await AutonomousMultiAgentTeam.runScan();
    expect(recommendations.length).toBe(6);

    for (const rec of recommendations) {
      expect(rec.agent).toBe('Agent-FinOps-Broker');
      expect(rec.targetGpu).toBeDefined();
      expect(rec.netSavingsUsd).toBeGreaterThan(0);
      expect(rec.deployUrl).toContain('dynep');
      expect(rec.affiliateCommissionEarnedUsd).toBeGreaterThan(0);
    }
  });
});
