// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS } from './aiSettings';
import { calculateCost, estimateMessageTokens, estimateRequestBudget, formatAiCost, getAiUsageSummary, recordAiUsage } from './aiUsage';

describe('AI usage and budget estimates', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('counts CJK text conservatively and calculates million-token prices', () => {
    expect(estimateMessageTokens([{ content: '这是一个测试' }])).toBeGreaterThanOrEqual(6);
    const cost = calculateCost(1_000_000, 500_000, {
      ...DEFAULT_AI_SETTINGS,
      currency: 'CNY',
      input_price_per_million: 2,
      output_price_per_million: 8,
    });
    expect(cost.input_cost).toBe(2);
    expect(cost.output_cost).toBe(4);
    expect(cost.total_cost).toBe(6);
    expect(formatAiCost(6, 'CNY')).toBe('¥6.00');
  });

  it('aggregates monthly records and blocks requests over budget', () => {
    const settings = {
      ...DEFAULT_AI_SETTINGS,
      currency: 'CNY' as const,
      input_price_per_million: 10,
      output_price_per_million: 10,
      pricing_resolved: true,
      monthly_budget: 0.001,
      max_output_tokens: 100,
    };
    recordAiUsage('test-model', 50, 50, settings, new Date(2026, 9, 25));
    const summary = getAiUsageSummary(settings, new Date(2026, 9, 25));
    expect(summary.calls).toBe(1);
    expect(summary.total_cost).toBeCloseTo(0.001, 6);

    const estimate = estimateRequestBudget([{ content: '继续写下去' }], settings);
    expect(estimate.pricing_configured).toBe(true);
    expect(estimate.budget_exceeded).toBe(true);
    expect(estimate.token_budget_exceeded).toBe(false);
  });

  it('enforces a universal token budget for custom models without a reference price', () => {
    const settings = {
      ...DEFAULT_AI_SETTINGS,
      model: 'private-model',
      pricing_resolved: false,
      monthly_token_budget: 10,
      max_output_tokens: 100,
    };
    const estimate = estimateRequestBudget([{ content: '继续写下去' }], settings);
    expect(estimate.pricing_configured).toBe(false);
    expect(estimate.token_budget_exceeded).toBe(true);
  });});
