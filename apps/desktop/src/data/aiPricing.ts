import type { AiCurrency } from './aiSettings';

export interface AiModelPricing {
  input_per_million: number;
  output_per_million: number;
  currency: AiCurrency;
  label: string;
  reference: string;
}

interface PricingRule extends AiModelPricing {
  models: string[];
  hosts?: string[];
}

const REFERENCE = '内置参考价，最终以模型服务商账单为准';

const PRICING_RULES: PricingRule[] = [
  { models: ['gpt-4o-mini'], hosts: ['api.openai.com', 'openrouter.ai'], input_per_million: 0.15, output_per_million: 0.6, currency: 'USD', label: 'GPT-4o mini', reference: REFERENCE },
  { models: ['gpt-4.1-mini'], hosts: ['api.openai.com'], input_per_million: 0.4, output_per_million: 1.6, currency: 'USD', label: 'GPT-4.1 mini', reference: REFERENCE },
  { models: ['gpt-4.1'], hosts: ['api.openai.com'], input_per_million: 2, output_per_million: 8, currency: 'USD', label: 'GPT-4.1', reference: REFERENCE },
  { models: ['deepseek-chat'], hosts: ['api.deepseek.com'], input_per_million: 2, output_per_million: 8, currency: 'CNY', label: 'DeepSeek Chat', reference: REFERENCE },
  { models: ['deepseek-reasoner'], hosts: ['api.deepseek.com'], input_per_million: 4, output_per_million: 16, currency: 'CNY', label: 'DeepSeek Reasoner', reference: REFERENCE },
  { models: ['qwen-plus'], hosts: ['dashscope.aliyuncs.com'], input_per_million: 0.8, output_per_million: 2, currency: 'CNY', label: '通义千问 Plus', reference: REFERENCE },
  { models: ['qwen-turbo'], hosts: ['dashscope.aliyuncs.com'], input_per_million: 0.3, output_per_million: 0.6, currency: 'CNY', label: '通义千问 Turbo', reference: REFERENCE },
  { models: ['glm-4-flash'], hosts: ['open.bigmodel.cn'], input_per_million: 0, output_per_million: 0, currency: 'CNY', label: 'GLM-4 Flash', reference: REFERENCE },
  { models: ['moonshot-v1-8k'], hosts: ['api.moonshot.cn'], input_per_million: 12, output_per_million: 12, currency: 'CNY', label: 'Moonshot v1 8K', reference: REFERENCE },
  { models: ['hunyuan-lite'], hosts: ['api.hunyuan.cloud.tencent.com'], input_per_million: 0, output_per_million: 0, currency: 'CNY', label: '混元 Lite', reference: REFERENCE },
  { models: ['llama-3.3-70b-versatile'], hosts: ['api.groq.com'], input_per_million: 0.59, output_per_million: 0.79, currency: 'USD', label: 'Llama 3.3 70B', reference: REFERENCE },
  { models: ['mistral-small-latest'], hosts: ['api.mistral.ai'], input_per_million: 0.1, output_per_million: 0.3, currency: 'USD', label: 'Mistral Small', reference: REFERENCE },
];

function hostOf(baseUrl: string): string {
  try { return new URL(baseUrl).hostname.toLowerCase(); } catch { return ''; }
}

function modelMatches(model: string, expected: string): boolean {
  const normalized = model.toLowerCase();
  const target = expected.toLowerCase();
  return normalized === target || normalized.endsWith(`/${target}`);
}

export function resolveAiPricing(model: string, baseUrl: string): AiModelPricing | null {
  const host = hostOf(baseUrl);
  const normalized = model.trim();
  if (!normalized) return null;
  const rule = PRICING_RULES.find((item) => item.models.some((candidate) => modelMatches(normalized, candidate))
    && (!item.hosts || item.hosts.some((expectedHost) => host === expectedHost || host.endsWith(`.${expectedHost}`))));
  if (!rule) return null;
  return {
    input_per_million: rule.input_per_million,
    output_per_million: rule.output_per_million,
    currency: rule.currency,
    label: rule.label,
    reference: rule.reference,
  };
}

export function formatPricingRange(pricing: AiModelPricing | null): string {
  if (!pricing) return '暂无内置参考价';
  const symbol = pricing.currency === 'USD' ? '$' : '¥';
  return `${symbol}${pricing.input_per_million} 输入 / ${symbol}${pricing.output_per_million} 输出 · 每百万 Token`;
}