import { invoke } from '@tauri-apps/api/core';
import { resolveAiPricing } from './aiPricing';

export type AiCurrency = 'USD' | 'CNY';

export interface AiSettings {
  base_url: string;
  model: string;
  temperature: number;
  max_output_tokens: number;
  stream: boolean;
  currency: AiCurrency;
  input_price_per_million: number;
  output_price_per_million: number;
  pricing_resolved: boolean;
  pricing_label: string;
  monthly_budget: number;
  monthly_token_budget: number;
  request_timeout_seconds: number;
}

export interface AiProviderPreset {
  id: string;
  name: string;
  base_url: string;
  model: string;
  note: string;
}

const SETTINGS_KEY = 'weiguang.ai.settings.v1';
const DEV_SECRET_KEY = 'weiguang.ai.key.dev';

const BASE_AI_SETTINGS: AiSettings = {
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.8,
  max_output_tokens: 2000,
  stream: true,
  currency: 'USD',
  input_price_per_million: 0,
  output_price_per_million: 0,
  pricing_resolved: false,
  pricing_label: '',
  monthly_budget: 0,
  monthly_token_budget: 0,
  request_timeout_seconds: 120,
};

export function applyAutoPricing(settings: AiSettings): AiSettings {
  const pricing = resolveAiPricing(settings.model, settings.base_url);
  return {
    ...settings,
    currency: pricing?.currency ?? settings.currency,
    input_price_per_million: pricing?.input_per_million ?? 0,
    output_price_per_million: pricing?.output_per_million ?? 0,
    pricing_resolved: Boolean(pricing),
    pricing_label: pricing?.label ?? '',
    monthly_budget: pricing ? settings.monthly_budget : 0,
  };
}

export const DEFAULT_AI_SETTINGS: AiSettings = applyAutoPricing(BASE_AI_SETTINGS);

export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', note: '需要 OpenAI API Key' },
  { id: 'deepseek', name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', note: 'OpenAI 兼容接口' },
  { id: 'bailian', name: '阿里云百炼', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', note: '需在百炼控制台创建 API Key' },
  { id: 'zhipu', name: '智谱开放平台', base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', note: 'OpenAI 兼容接口' },
  { id: 'moonshot', name: 'Moonshot', base_url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', note: 'OpenAI 兼容接口' },
  { id: 'hunyuan', name: '腾讯混元', base_url: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-lite', note: '使用混元 API Key；模型名可改为账号可用模型' },
  { id: 'qianfan', name: '百度千帆', base_url: 'https://qianfan.baidubce.com/v2', model: '', note: '填写千帆平台可用的模型 ID，例如 ernie 系列' },
  { id: 'ark', name: '火山方舟', base_url: 'https://ark.cn-beijing.volces.com/api/v3', model: '', note: '模型名填写方舟推理接入点 ID（ep- 开头）' },
  { id: 'siliconflow', name: '硅基流动', base_url: 'https://api.siliconflow.cn/v1', model: '', note: '填写硅基流动平台模型 ID，例如 Qwen 系列' },
  { id: 'openrouter', name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', note: '需要 OpenRouter API Key' },
  { id: 'groq', name: 'Groq', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', note: '需要 Groq API Key' },
  { id: 'mistral', name: 'Mistral', base_url: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', note: '需要 Mistral API Key' },
  { id: 'custom', name: '自定义 OpenAI 兼容接口', base_url: '', model: '', note: '支持以 Bearer API Key 鉴权的 /chat/completions 接口' },
];

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return applyAutoPricing({
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
      base_url: String(parsed.base_url ?? DEFAULT_AI_SETTINGS.base_url).trim(),
      model: String(parsed.model ?? DEFAULT_AI_SETTINGS.model).trim(),
      temperature: finiteNumber(parsed.temperature, DEFAULT_AI_SETTINGS.temperature, 0, 2),
      max_output_tokens: finiteNumber(parsed.max_output_tokens, DEFAULT_AI_SETTINGS.max_output_tokens, 100, 8000),
      stream: parsed.stream !== false,
      monthly_budget: finiteNumber(parsed.monthly_budget, 0, 0, 100_000_000),
      monthly_token_budget: finiteNumber(parsed.monthly_token_budget, 0, 0, 10_000_000_000),
      request_timeout_seconds: finiteNumber(parsed.request_timeout_seconds, DEFAULT_AI_SETTINGS.request_timeout_seconds, 15, 300),
    });
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): AiSettings {
  const normalized = applyAutoPricing(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function saveAiApiKey(apiKey: string): Promise<void> {
  const value = apiKey.trim();
  if (!value) throw new Error('API Key 不能为空');
  if (isTauriRuntime()) {
    await invoke('save_ai_secret', { secret: value });
    return;
  }
  sessionStorage.setItem(DEV_SECRET_KEY, value);
}

export async function hasAiApiKey(): Promise<boolean> {
  if (isTauriRuntime()) return Boolean(await invoke<boolean>('ai_secret_status'));
  return Boolean(sessionStorage.getItem(DEV_SECRET_KEY));
}

export async function loadAiApiKey(): Promise<string | null> {
  if (isTauriRuntime()) return invoke<string | null>('load_ai_secret');
  return sessionStorage.getItem(DEV_SECRET_KEY);
}

export async function clearAiApiKey(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('clear_ai_secret');
    return;
  }
  sessionStorage.removeItem(DEV_SECRET_KEY);
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function chatEndpoint(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) throw new Error('请先填写模型接口地址');
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}
