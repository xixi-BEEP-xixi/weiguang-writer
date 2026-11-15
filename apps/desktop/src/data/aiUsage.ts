import type { AiCurrency, AiSettings } from './aiSettings';

export interface AiCost {
  input_cost: number;
  output_cost: number;
  total_cost: number;
  currency: AiCurrency;
}

export interface AiUsageRecord extends AiCost {
  id: string;
  created_at: string;
  month: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
}

export interface AiUsageSummary {
  month: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  total_cost: number;
  currency: AiCurrency;
}

export interface AiRequestEstimate {
  input_tokens: number;
  output_tokens: number;
  projected_cost: AiCost;
  monthly_spent: number;
  monthly_tokens: number;
  monthly_budget: number;
  monthly_token_budget: number;
  pricing_configured: boolean;
  budget_exceeded: boolean;
  token_budget_exceeded: boolean;
}

const USAGE_KEY = 'weiguang.ai.usage.v1';
const MAX_RECORDS = 1200;

function currentMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function readRecords(): AiUsageRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AiUsageRecord => Boolean(item && typeof item === 'object' && 'total_cost' in item));
  } catch {
    return [];
  }
}

function writeRecords(records: AiUsageRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(USAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

/** Conservative token estimate: Chinese characters count as roughly one token. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let units = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const isCjk = (code >= 0x2e80 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0x20000 && code <= 0x2fa1f);
    units += isCjk ? 1 : 0.3;
  }
  return Math.max(1, Math.ceil(units));
}

export function estimateMessageTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((total, message) => total + estimateTokens(message.content) + 4, 8);
}

export function calculateCost(inputTokens: number, outputTokens: number, settings: AiSettings): AiCost {
  const inputCost = Math.max(0, inputTokens) * Math.max(0, settings.input_price_per_million) / 1_000_000;
  const outputCost = Math.max(0, outputTokens) * Math.max(0, settings.output_price_per_million) / 1_000_000;
  return {
    input_cost: inputCost,
    output_cost: outputCost,
    total_cost: inputCost + outputCost,
    currency: settings.currency,
  };
}

export function getAiUsageSummary(settings?: Pick<AiSettings, 'currency'>, date = new Date()): AiUsageSummary {
  const month = currentMonth(date);
  const currency = settings?.currency ?? 'CNY';
  const monthlyRecords = readRecords().filter((record) => record.month === month);
  const pricedRecords = monthlyRecords.filter((record) => record.currency === currency);
  const inputTokens = monthlyRecords.reduce((sum, record) => sum + record.input_tokens, 0);
  const outputTokens = monthlyRecords.reduce((sum, record) => sum + record.output_tokens, 0);
  return {
    month,
    calls: monthlyRecords.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    reasoning_tokens: monthlyRecords.reduce((sum, record) => sum + (record.reasoning_tokens ?? 0), 0),
    total_tokens: inputTokens + outputTokens,
    total_cost: pricedRecords.reduce((sum, record) => sum + record.total_cost, 0),
    currency,
  };
}

export function estimateRequestBudget(messages: Array<{ content: string }>, settings: AiSettings, outputTokens = settings.max_output_tokens): AiRequestEstimate {
  const inputTokens = estimateMessageTokens(messages);
  const projected = calculateCost(inputTokens, outputTokens, settings);
  const summary = getAiUsageSummary(settings);
  const pricingConfigured = settings.pricing_resolved;
  const projectedTokens = inputTokens + outputTokens;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    projected_cost: projected,
    monthly_spent: summary.total_cost,
    monthly_tokens: summary.total_tokens,
    monthly_budget: settings.monthly_budget,
    monthly_token_budget: settings.monthly_token_budget,
    pricing_configured: pricingConfigured,
    budget_exceeded: settings.monthly_budget > 0 && pricingConfigured && summary.total_cost + projected.total_cost > settings.monthly_budget,
    token_budget_exceeded: settings.monthly_token_budget > 0 && summary.total_tokens + projectedTokens > settings.monthly_token_budget,
  };
}

export function assertAiBudget(messages: Array<{ content: string }>, settings: AiSettings, outputTokens = settings.max_output_tokens): AiRequestEstimate {
  const estimate = estimateRequestBudget(messages, settings, outputTokens);
  if (estimate.token_budget_exceeded) {
    throw new Error(`本次请求预计超出本月 Token 上限（已用 ${estimate.monthly_tokens.toLocaleString()}，本次预计 ${(estimate.input_tokens + estimate.output_tokens).toLocaleString()}，上限 ${settings.monthly_token_budget.toLocaleString()}）。请调整 Token 上限或缩短输出。`);
  }
  if (settings.monthly_budget > 0 && !estimate.pricing_configured) {
    throw new Error('当前模型没有内置参考价，无法按金额预算拦截。请使用 Token 上限，或将金额预算设为 0。');
  }
  if (estimate.budget_exceeded) {
    throw new Error(`本次请求预计超出本月 AI 预算（已用 ${formatAiCost(estimate.monthly_spent, settings.currency)}，本次预计 ${formatAiCost(estimate.projected_cost.total_cost, settings.currency)}，预算 ${formatAiCost(settings.monthly_budget, settings.currency)}）。请调整预算或降低输出上限。`);
  }
  return estimate;
}

export function recordAiUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  settings: AiSettings,
  date = new Date(),
  reasoningTokens = 0,
): AiUsageRecord {
  const cost = calculateCost(inputTokens, outputTokens, settings);
  const record: AiUsageRecord = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${date.getTime()}-${Math.random().toString(16).slice(2)}`,
    created_at: date.toISOString(),
    month: currentMonth(date),
    model,
    input_tokens: Math.max(0, Math.round(inputTokens)),
    output_tokens: Math.max(0, Math.round(outputTokens)),
    ...(reasoningTokens > 0 ? { reasoning_tokens: Math.round(reasoningTokens) } : {}),
    ...cost,
  };
  writeRecords([record, ...readRecords()]);
  return record;
}

export function formatAiCost(amount: number, currency: AiCurrency): string {
  const symbol = currency === 'USD' ? '$' : '¥';
  if (amount === 0) return `${symbol}0`;
  if (amount < 0.0001) return `${symbol}<0.0001`;
  if (amount < 0.01) return `${symbol}${amount.toFixed(5)}`;
  if (amount < 1) return `${symbol}${amount.toFixed(4)}`;
  return `${symbol}${amount.toFixed(2)}`;
}
