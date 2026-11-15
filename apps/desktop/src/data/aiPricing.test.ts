import { describe, expect, it } from 'vitest';
import { resolveAiPricing } from './aiPricing';
import { applyAutoPricing, DEFAULT_AI_SETTINGS } from './aiSettings';

describe('automatic model pricing', () => {
  it('resolves known models without manual price input', () => {
    const pricing = resolveAiPricing('gpt-4o-mini', 'https://api.openai.com/v1');
    expect(pricing?.input_per_million).toBe(0.15);
    expect(pricing?.output_per_million).toBe(0.6);
    expect(pricing?.currency).toBe('USD');
  });

  it('keeps unknown custom models usable without inventing a price', () => {
    const settings = applyAutoPricing({
      ...DEFAULT_AI_SETTINGS,
      base_url: 'https://example.com/v1',
      model: 'private-novel-model',
    });
    expect(settings.pricing_resolved).toBe(false);
    expect(settings.input_price_per_million).toBe(0);
    expect(settings.output_price_per_million).toBe(0);
  });
});