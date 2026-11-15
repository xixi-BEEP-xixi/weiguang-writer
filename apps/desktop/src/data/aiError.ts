interface ProviderErrorBody {
  error?: { message?: unknown } | string;
  message?: unknown;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: '请求格式被模型服务拒绝',
  401: 'API Key 无效或未通过认证',
  403: '当前 API Key 无权访问这个模型',
  404: '接口地址或模型名称不存在',
  408: '模型服务响应超时',
  409: '模型请求发生冲突，请稍后重试',
  413: '发送的上下文超过服务商限制',
  422: '模型服务无法处理本次请求参数',
  429: '请求过于频繁，或账户额度不足',
  500: '模型服务内部错误',
  502: '模型服务网关错误',
  503: '模型服务暂时不可用',
  504: '模型服务网关超时',
};

function readable(value: unknown): string {
  if (typeof value !== 'string') return '';
  const compact = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return '';
  const replacements = (compact.match(/\uFFFD/g) ?? []).length;
  const controls = (compact.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  const printable = [...compact].filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code === 9 || code === 10 || code === 13 || code >= 32;
  }).length;
  if (replacements > 1 || controls > 0 || printable / compact.length < 0.9) return '';
  return compact;
}

export function providerError(status: number, raw: string): Error {
  const fallback = STATUS_MESSAGES[status] ?? (status > 0 ? `模型请求失败 HTTP ${status}` : '模型请求失败');
  let message = '';
  try {
    const parsed = JSON.parse(raw) as ProviderErrorBody;
    if (typeof parsed.error === 'string') message = readable(parsed.error);
    else if (parsed.error && typeof parsed.error === 'object') message = readable(parsed.error.message);
    if (!message) message = readable(parsed.message);
  } catch {
    message = readable(raw.slice(0, 300));
  }
  const detail = message && message !== 'undefined' && message !== 'null' ? message : '';
  return new Error(detail ? `${fallback}：${detail}` : `${fallback}。请检查 Base URL、模型名称和 API Key。`);
}